# Initialize OpenTelemetry tracing first
from telemetry import tracer

import os
import json
import time
import random
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, g
from flask_cors import CORS
import redis
from datetime import datetime
import requests
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from prometheus_client import Counter
from dotenv import load_dotenv

# Import observability modules
from metrics import (
    before_request, after_request, metrics_endpoint,
    record_model_prediction, record_cache_operation,
    record_recommendation_request, record_redis_operation,
    time_function
)
from logging_config import (
    logger, RequestLogger, log_business_event, log_model_event,
    log_cache_event, log_error, log_performance_event
)

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize request logging
request_logger = RequestLogger(app)

# Register metrics handlers
app.before_request(before_request)
app.after_request(after_request)

# Configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:3001')
PORT = int(os.getenv('PORT', 3002))

# Initialize Redis (optional)
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
    logger.info("Redis connection established")
    record_redis_operation("connect", success=True)
except Exception as e:
    logger.warning("Redis connection failed", error=str(e))
    record_redis_operation("connect", success=False)
    redis_client = None

# Mock data for recommendations
MOCK_PRODUCTS = [
    {"id": 1, "name": "Laptop", "category": "Electronics", "price": 999.99, "description": "High-performance laptop"},
    {"id": 2, "name": "Smartphone", "category": "Electronics", "price": 599.99, "description": "Latest smartphone"},
    {"id": 3, "name": "Headphones", "category": "Electronics", "price": 199.99, "description": "Wireless headphones"},
    {"id": 4, "name": "Book", "category": "Books", "price": 29.99, "description": "DevOps handbook"},
    {"id": 5, "name": "Coffee Mug", "category": "Home", "price": 14.99, "description": "Programmer coffee mug"}
]

MOCK_USER_PREFERENCES = {
    1: {"interests": ["electronics", "technology", "programming"], "price_range": [0, 500]},
    2: {"interests": ["books", "learning", "coffee"], "price_range": [0, 100]},
    3: {"interests": ["electronics", "music", "entertainment"], "price_range": [100, 1000]}
}

class RecommendationEngine:
    def __init__(self):
        self.products_df = pd.DataFrame(MOCK_PRODUCTS)
        self.tfidf_vectorizer = None
        self.product_features = None
        self._train_model()
    
    @time_function('MODEL_TRAINING_DURATION')
    def _train_model(self):
        """Train a simple content-based recommendation model"""
        start_time = time.time()
        try:
            with tracer.start_as_current_span("model_training") as span:
                # Create feature vectors from product descriptions and categories
                features_text = (self.products_df['description'] + ' ' + self.products_df['category']).fillna('')
                
                self.tfidf_vectorizer = TfidfVectorizer(stop_words='english', max_features=100)
                self.product_features = self.tfidf_vectorizer.fit_transform(features_text)
                
                duration = time.time() - start_time
                
                span.set_attributes({
                    "model.type": "content_based",
                    "model.features_count": self.product_features.shape[1],
                    "model.products_count": len(self.products_df),
                    "model.training_duration": duration
                })
                
                logger.info("Recommendation model trained successfully")
                log_model_event("training_completed", "content_based", duration=duration)
                
        except Exception as e:
            duration = time.time() - start_time
            logger.error("Error training model", error=str(e))
            log_error(e, context={"operation": "model_training", "duration": duration})
            raise
    
    def get_recommendations(self, user_id, limit=5):
        """Get product recommendations for a user"""
        start_time = time.time()
        try:
            with tracer.start_as_current_span("generate_recommendations") as span:
                span.set_attributes({
                    "user.id": str(user_id),
                    "recommendation.limit": limit,
                    "recommendation.type": "content_based"
                })
                
                user_prefs = MOCK_USER_PREFERENCES.get(user_id, MOCK_USER_PREFERENCES[1])
                
                # Simple content-based filtering
                recommendations = []
                
                for _, product in self.products_df.iterrows():
                    score = self._calculate_score(product, user_prefs)
                    recommendations.append({
                        'id': product['id'],
                        'name': product['name'],
                        'category': product['category'],
                        'price': product['price'],
                        'score': round(score, 2)
                    })
                
                # Sort by score and return top N
                recommendations = sorted(recommendations, key=lambda x: x['score'], reverse=True)
                final_recommendations = recommendations[:limit]
                
                duration = time.time() - start_time
                
                # Record metrics
                record_model_prediction("content_based", user_id, duration)
                
                span.set_attributes({
                    "recommendation.count": len(final_recommendations),
                    "recommendation.duration": duration
                })
                
                log_model_event("prediction_completed", "content_based", 
                              duration=duration, user_id=user_id, 
                              recommendations_count=len(final_recommendations))
                
                return final_recommendations
                
        except Exception as e:
            duration = time.time() - start_time
            logger.error("Error generating recommendations", error=str(e), user_id=user_id)
            log_error(e, context={"operation": "generate_recommendations", "user_id": user_id, "duration": duration})
            return []
    
    def _calculate_score(self, product, user_prefs):
        """Calculate recommendation score for a product"""
        score = 0.5  # Base score
        
        # Category/interest matching
        product_category = product['category'].lower()
        product_desc = product['description'].lower()
        
        for interest in user_prefs['interests']:
            if interest in product_category or interest in product_desc:
                score += 0.2
        
        # Price preference matching
        price = product['price']
        price_min, price_max = user_prefs['price_range']
        if price_min <= price <= price_max:
            score += 0.3
        elif price > price_max:
            score -= 0.2
        
        return min(score, 1.0)  # Cap at 1.0

# Initialize recommendation engine
rec_engine = RecommendationEngine()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'ml-recommendation-service',
        'version': '1.0.0'
    })

@app.route('/health/ready', methods=['GET'])
def readiness_check():
    """Kubernetes readiness check"""
    try:
        # Check if model is trained
        if rec_engine.product_features is None:
            return jsonify({'status': 'not ready', 'reason': 'model not trained'}), 503
        
        return jsonify({'status': 'ready'})
    except Exception as e:
        return jsonify({'status': 'not ready', 'error': str(e)}), 503

@app.route('/health/live', methods=['GET'])
def liveness_check():
    """Kubernetes liveness check"""
    return jsonify({'status': 'alive'})

@app.route('/api/recommendations/<int:user_id>', methods=['GET'])
def get_user_recommendations(user_id):
    """Get recommendations for a specific user"""
    start_time = time.time()
    try:
        with tracer.start_as_current_span("get_user_recommendations") as span:
            limit = request.args.get('limit', 5, type=int)
            
            span.set_attributes({
                "user.id": str(user_id),
                "recommendation.limit": limit
            })
            
            # Check cache first
            cache_key = f"recommendations:user:{user_id}:limit:{limit}"
            cache_hit = False
            
            if redis_client:
                try:
                    cache_start = time.time()
                    cached = redis_client.get(cache_key)
                    cache_duration = (time.time() - cache_start) * 1000  # ms
                    
                    if cached:
                        cache_hit = True
                        record_cache_operation("get", hit=True)
                        record_redis_operation("get", success=True)
                        log_cache_event("get", cache_key, hit=True, duration=cache_duration)
                        
                        logger.info("Serving recommendations from cache", user_id=user_id)
                        
                        span.set_attributes({
                            "cache.hit": True,
                            "cache.key": cache_key
                        })
                        
                        return jsonify({
                            'recommendations': json.loads(cached), 
                            'from_cache': True,
                            'user_id': user_id,
                            'timestamp': datetime.utcnow().isoformat()
                        })
                    else:
                        record_cache_operation("get", hit=False)
                        log_cache_event("get", cache_key, hit=False, duration=cache_duration)
                        
                except Exception as e:
                    record_redis_operation("get", success=False)
                    logger.warning("Cache read error", error=str(e), cache_key=cache_key)
                    log_error(e, context={"operation": "cache_read", "key": cache_key})
            
            # Generate fresh recommendations
            record_recommendation_request(user_id, "content_based")
            recommendations = rec_engine.get_recommendations(user_id, limit)
            
            # Cache the results
            if redis_client and recommendations:
                try:
                    cache_start = time.time()
                    redis_client.setex(cache_key, 300, json.dumps(recommendations))  # Cache for 5 minutes
                    cache_duration = (time.time() - cache_start) * 1000  # ms
                    
                    record_redis_operation("setex", success=True)
                    log_cache_event("set", cache_key, duration=cache_duration)
                    
                except Exception as e:
                    record_redis_operation("setex", success=False)
                    logger.warning("Cache write error", error=str(e), cache_key=cache_key)
                    log_error(e, context={"operation": "cache_write", "key": cache_key})
            
            duration = time.time() - start_time
            
            span.set_attributes({
                "cache.hit": cache_hit,
                "recommendation.count": len(recommendations),
                "response.duration": duration
            })
            
            logger.info("Generated recommendations", 
                       user_id=user_id, 
                       count=len(recommendations),
                       duration_seconds=duration,
                       from_cache=False)
            
            log_business_event("recommendations_generated", {
                "user_id": user_id,
                "count": len(recommendations),
                "from_cache": False
            })
            
            return jsonify({
                'recommendations': recommendations,
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat(),
                'from_cache': False
            })
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error("Error getting recommendations", error=str(e), user_id=user_id, duration_seconds=duration)
        log_error(e, context={"operation": "get_recommendations", "user_id": user_id})
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/recommendations/popular', methods=['GET'])
def get_popular_products():
    """Get popular products (mock implementation)"""
    try:
        # Simulate popular products based on mock data
        popular = sorted(MOCK_PRODUCTS, key=lambda x: x['price'], reverse=True)[:3]
        
        return jsonify({
            'popular_products': popular,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting popular products: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/model/retrain', methods=['POST'])
def retrain_model():
    """Retrain the recommendation model"""
    start_time = time.time()
    try:
        with tracer.start_as_current_span("retrain_model") as span:
            logger.info("Starting model retraining")
            
            # In a real implementation, this would fetch fresh data from the backend
            rec_engine._train_model()
            
            # Clear cache
            cache_cleared = 0
            if redis_client:
                try:
                    keys = redis_client.keys("recommendations:*")
                    if keys:
                        cache_cleared = redis_client.delete(*keys)
                        record_redis_operation("delete", success=True)
                        log_cache_event("clear", "recommendations:*")
                except Exception as e:
                    record_redis_operation("delete", success=False)
                    logger.warning("Cache clear error", error=str(e))
                    log_error(e, context={"operation": "cache_clear"})
            
            duration = time.time() - start_time
            
            span.set_attributes({
                "model.retrain_duration": duration,
                "cache.keys_cleared": cache_cleared
            })
            
            logger.info("Model retrained successfully", 
                       duration_seconds=duration,
                       cache_keys_cleared=cache_cleared)
            
            log_business_event("model_retrained", {
                "duration": duration,
                "cache_keys_cleared": cache_cleared
            })
            
            return jsonify({
                'message': 'Model retrained successfully',
                'timestamp': datetime.utcnow().isoformat(),
                'duration_seconds': duration,
                'cache_keys_cleared': cache_cleared
            })
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error("Error retraining model", error=str(e), duration_seconds=duration)
        log_error(e, context={"operation": "model_retrain"})
        return jsonify({'error': 'Internal server error'}), 500

# 🥚 Easter Egg #3: Coffee Consumption Metric
coffee_consumption = Counter('shopmicro_ml_coffee_consumed_total', 
                           'Total cups of coffee consumed by ML engineers',
                           ['engineer_name', 'coffee_type'])

@app.route('/api/coffee/drink', methods=['POST'])
def drink_coffee():
    """🥚 Hidden coffee consumption tracker"""
    data = request.get_json() or {}
    engineer = data.get('engineer', 'anonymous')
    coffee_type = data.get('type', 'espresso')
    
    # Increment coffee metric
    coffee_consumption.labels(engineer_name=engineer, coffee_type=coffee_type).inc()
    
    responses = [
        f"☕ {engineer} enjoyed a delicious {coffee_type}!",
        f"🚀 {coffee_type} powers activated for {engineer}!",
        f"💡 {engineer}'s productivity increased by 42% with {coffee_type}!",
        f"🎯 {engineer} is now caffeinated and ready to debug Kubernetes!"
    ]
    
    logger.info("Coffee consumed", engineer=engineer, coffee_type=coffee_type, 
                achievement="easter_egg_3_progress")
    
    return jsonify({
        'message': random.choice(responses),
        'achievement': 'Coffee Connoisseur',
        'hint': 'Check the Grafana dashboards for your coffee metrics! ☕📊'
    })

# Prometheus metrics endpoint
@app.route('/metrics', methods=['GET'])
def prometheus_metrics():
    """Prometheus metrics endpoint"""
    return metrics_endpoint()

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get service metrics in JSON format"""
    return jsonify({
        'service': 'ml-recommendation-service',
        'model_status': 'trained' if rec_engine.product_features is not None else 'not_trained',
        'total_products': len(MOCK_PRODUCTS),
        'cache_status': 'enabled' if redis_client else 'disabled',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.errorhandler(404)
def not_found(error):
    logger.warning("404 Not Found", 
                  path=request.path, 
                  method=request.method,
                  remote_addr=request.remote_addr)
    return jsonify({
        'error': 'Endpoint not found',
        'path': request.path,
        'correlation_id': getattr(g, 'correlation_id', None)
    }), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error("500 Internal Server Error", 
                error=str(error),
                path=request.path,
                method=request.method)
    return jsonify({
        'error': 'Internal server error',
        'correlation_id': getattr(g, 'correlation_id', None)
    }), 500


if __name__ == '__main__':
    logger.info(f"Starting ML Recommendation Service on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=os.getenv('FLASK_ENV') == 'development')
