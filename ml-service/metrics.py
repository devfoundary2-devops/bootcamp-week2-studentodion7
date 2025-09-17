import time
import functools
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from flask import request, g
from opentelemetry import trace

# Create metrics registry
REQUEST_COUNT = Counter(
    'shopmicro_ml_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'shopmicro_ml_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'status_code'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10]
)

REQUEST_SIZE = Histogram(
    'shopmicro_ml_http_request_size_bytes',
    'HTTP request size in bytes',
    ['method', 'endpoint'],
    buckets=[100, 1000, 10000, 100000, 1000000]
)

RESPONSE_SIZE = Histogram(
    'shopmicro_ml_http_response_size_bytes',
    'HTTP response size in bytes',
    ['method', 'endpoint', 'status_code'],
    buckets=[100, 1000, 10000, 100000, 1000000]
)

ACTIVE_REQUESTS = Gauge(
    'shopmicro_ml_active_requests',
    'Number of active requests'
)

# ML-specific metrics
MODEL_PREDICTIONS = Counter(
    'shopmicro_ml_model_predictions_total',
    'Total number of model predictions',
    ['model_type', 'user_id']
)

MODEL_PREDICTION_DURATION = Histogram(
    'shopmicro_ml_model_prediction_duration_seconds',
    'Model prediction duration in seconds',
    ['model_type'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
)

CACHE_OPERATIONS = Counter(
    'shopmicro_ml_cache_operations_total',
    'Total cache operations',
    ['operation', 'result']
)

CACHE_HIT_RATIO = Gauge(
    'shopmicro_ml_cache_hit_ratio',
    'Cache hit ratio'
)

RECOMMENDATION_REQUESTS = Counter(
    'shopmicro_ml_recommendation_requests_total',
    'Total recommendation requests',
    ['user_id', 'recommendation_type']
)

MODEL_TRAINING_DURATION = Histogram(
    'shopmicro_ml_model_training_duration_seconds',
    'Model training duration in seconds',
    buckets=[1, 5, 10, 30, 60, 300, 600]
)

REDIS_OPERATIONS = Counter(
    'shopmicro_ml_redis_operations_total',
    'Total Redis operations',
    ['operation', 'status']
)

# Cache statistics tracking
cache_stats = {
    'hits': 0,
    'misses': 0,
    'total': 0
}

def before_request():
    """Before request handler to start timing and increment active requests"""
    # Note: g.start_time is used for metrics (float timestamp)
    # g.start_time_datetime is used for logging (datetime object)
    g.start_time = time.time()
    ACTIVE_REQUESTS.inc()
    
    # Add trace context to request
    span = trace.get_current_span()
    if span:
        span_context = span.get_span_context()
        g.trace_id = format(span_context.trace_id, '032x')
        g.span_id = format(span_context.span_id, '016x')

def after_request(response):
    """After request handler to record metrics"""
    request_duration = time.time() - g.start_time
    endpoint = request.endpoint or 'unknown'
    method = request.method
    status_code = str(response.status_code)
    
    # Record basic HTTP metrics
    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
    REQUEST_DURATION.labels(method=method, endpoint=endpoint, status_code=status_code).observe(request_duration)
    
    # Record request size
    request_size = request.content_length or 0
    if request_size > 0:
        REQUEST_SIZE.labels(method=method, endpoint=endpoint).observe(request_size)
    
    # Record response size
    response_size = len(response.get_data())
    if response_size > 0:
        RESPONSE_SIZE.labels(method=method, endpoint=endpoint, status_code=status_code).observe(response_size)
    
    ACTIVE_REQUESTS.dec()
    
    # Add trace headers to response
    if hasattr(g, 'trace_id'):
        response.headers['X-Trace-Id'] = g.trace_id
    
    return response

def record_model_prediction(model_type, user_id, duration):
    """Record model prediction metrics"""
    MODEL_PREDICTIONS.labels(model_type=model_type, user_id=str(user_id)).inc()
    MODEL_PREDICTION_DURATION.labels(model_type=model_type).observe(duration)

def record_cache_operation(operation, hit=False):
    """Record cache operation metrics"""
    result = 'hit' if hit else 'miss'
    CACHE_OPERATIONS.labels(operation=operation, result=result).inc()
    
    # Update cache statistics
    cache_stats['total'] += 1
    if hit:
        cache_stats['hits'] += 1
    else:
        cache_stats['misses'] += 1
    
    # Update hit ratio
    if cache_stats['total'] > 0:
        hit_ratio = cache_stats['hits'] / cache_stats['total']
        CACHE_HIT_RATIO.set(hit_ratio)

def record_recommendation_request(user_id, recommendation_type):
    """Record recommendation request metrics"""
    RECOMMENDATION_REQUESTS.labels(user_id=str(user_id), recommendation_type=recommendation_type).inc()

def record_model_training(duration):
    """Record model training metrics"""
    MODEL_TRAINING_DURATION.observe(duration)

def record_redis_operation(operation, success=True):
    """Record Redis operation metrics"""
    status = 'success' if success else 'error'
    REDIS_OPERATIONS.labels(operation=operation, status=status).inc()

def metrics_endpoint():
    """Endpoint to expose Prometheus metrics"""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

# Decorator for timing functions
def time_function(metric_name=None):
    """Decorator to time function execution"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                
                # Record timing based on function name or provided metric name
                if metric_name:
                    if hasattr(globals()[metric_name], 'observe'):
                        globals()[metric_name].observe(duration)
                
                return result
            except Exception as e:
                duration = time.time() - start_time
                # Could record error metrics here
                raise
        return wrapper
    return decorator

# Decorator for counting function calls
def count_calls(counter_name):
    """Decorator to count function calls"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                if hasattr(globals()[counter_name], 'inc'):
                    globals()[counter_name].inc()
                return result
            except Exception as e:
                # Could record error metrics here
                raise
        return wrapper
    return decorator
