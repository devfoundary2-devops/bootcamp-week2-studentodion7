import os
import json
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
import redis
import logging
from datetime import datetime
import requests
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:3001')
PORT = int(os.getenv('PORT', 3002))

# Initialize Redis (optional)
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
    logger.info("Redis connection established")
except Exception as e:
    logger.warning(f"Redis connection failed: {e}")
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
    
    def _train_model(self):
        """Train a simple content-based recommendation model"""
        try:
            # Create feature vectors from product descriptions and categories
            features_text = (self.products_df['description'] + ' ' + self.products_df['category']).fillna('')
            
            self.tfidf_vectorizer = TfidfVectorizer(stop_words='english', max_features=100)
            self.product_features = self.tfidf_vectorizer.fit_transform(features_text)
            
            logger.info("Recommendation model trained successfully")
        except Exception as e:
            logger.error(f"Error training model: {e}")
    
    def get_recommendations(self, user_id, limit=5):
        """Get product recommendations for a user"""
        try:
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
            return recommendations[:limit]
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
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
    try:
        limit = request.args.get('limit', 5, type=int)
        
        # Check cache first
        cache_key = f"recommendations:user:{user_id}:limit:{limit}"
        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Serving recommendations from cache for user {user_id}")
                    return jsonify({'recommendations': json.loads(cached), 'from_cache': True})
            except Exception as e:
                logger.warning(f"Cache read error: {e}")
        
        # Generate fresh recommendations
        recommendations = rec_engine.get_recommendations(user_id, limit)
        
        # Cache the results
        if redis_client:
            try:
                redis_client.setex(cache_key, 300, json.dumps(recommendations))  # Cache for 5 minutes
            except Exception as e:
                logger.warning(f"Cache write error: {e}")
        
        logger.info(f"Generated {len(recommendations)} recommendations for user {user_id}")
        
        return jsonify({
            'recommendations': recommendations,
            'user_id': user_id,
            'timestamp': datetime.utcnow().isoformat(),
            'from_cache': False
        })
        
    except Exception as e:
        logger.error(f"Error getting recommendations for user {user_id}: {e}")
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
    try:
        # In a real implementation, this would fetch fresh data from the backend
        rec_engine._train_model()
        
        # Clear cache
        if redis_client:
            try:
                keys = redis_client.keys("recommendations:*")
                if keys:
                    redis_client.delete(*keys)
            except Exception as e:
                logger.warning(f"Cache clear error: {e}")
        
        return jsonify({
            'message': 'Model retrained successfully',
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error retraining model: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get service metrics"""
    return jsonify({
        'service': 'ml-recommendation-service',
        'model_status': 'trained' if rec_engine.product_features is not None else 'not_trained',
        'total_products': len(MOCK_PRODUCTS),
        'cache_status': 'enabled' if redis_client else 'disabled',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    logger.info(f"Starting ML Recommendation Service on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=os.getenv('FLASK_ENV') == 'development')
