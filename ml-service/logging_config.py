import os
import sys
import json
import uuid
import logging
import structlog
from datetime import datetime
from flask import request, g, has_request_context
from opentelemetry import trace

def add_correlation_id(logger, method_name, event_dict):
    """Add correlation ID to log entries"""
    if has_request_context():
        # Try to get correlation ID from request headers or generate one
        correlation_id = getattr(g, 'correlation_id', None)
        if not correlation_id:
            correlation_id = request.headers.get('X-Correlation-Id', str(uuid.uuid4()))
            g.correlation_id = correlation_id
        event_dict['correlation_id'] = correlation_id
    return event_dict

def add_trace_context(logger, method_name, event_dict):
    """Add OpenTelemetry trace context to log entries"""
    span = trace.get_current_span()
    if span:
        span_context = span.get_span_context()
        if span_context.trace_id != 0:  # Valid trace context
            event_dict['trace_id'] = format(span_context.trace_id, '032x')
            event_dict['span_id'] = format(span_context.span_id, '016x')
    return event_dict

def add_service_context(logger, method_name, event_dict):
    """Add service context information"""
    event_dict.update({
        'service': 'shopmicro-ml-service',
        'version': '1.0.0',
        'environment': os.getenv('FLASK_ENV', 'development'),
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    })
    return event_dict

def add_request_context(logger, method_name, event_dict):
    """Add request context information"""
    if has_request_context():
        event_dict.update({
            'method': request.method,
            'url': request.url,
            'path': request.path,
            'remote_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', 'unknown'),
            'content_type': request.headers.get('Content-Type'),
            'content_length': request.headers.get('Content-Length')
        })
        
        # Add user context if available
        if hasattr(g, 'user_id'):
            event_dict['user_id'] = g.user_id
    
    return event_dict

def configure_logging():
    """Configure structured logging with structlog"""
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            add_service_context,
            add_correlation_id,
            add_trace_context,
            add_request_context,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper())
    )
    
    # Get structured logger
    logger = structlog.get_logger()
    
    return logger

# Initialize logger
logger = configure_logging()

class RequestLogger:
    """Request logging middleware"""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        app.before_request(self.before_request)
        app.after_request(self.after_request)
    
    def before_request(self):
        """Log request start"""
        g.start_time_datetime = datetime.utcnow()
        
        # Generate or extract correlation ID
        correlation_id = request.headers.get('X-Correlation-Id', str(uuid.uuid4()))
        g.correlation_id = correlation_id
        
        logger.info(
            "Request started",
            method=request.method,
            path=request.path,
            remote_addr=request.remote_addr,
            user_agent=request.headers.get('User-Agent', 'unknown')
        )
    
    def after_request(self, response):
        """Log request completion"""
        # Use defensive programming to handle missing start_time_datetime
        if hasattr(g, 'start_time_datetime'):
            duration = (datetime.utcnow() - g.start_time_datetime).total_seconds() * 1000  # milliseconds
        else:
            duration = 0  # fallback if start_time_datetime is missing
        
        # Add correlation ID to response headers
        response.headers['X-Correlation-Id'] = g.correlation_id
        
        log_data = {
            'method': request.method,
            'path': request.path,
            'status_code': response.status_code,
            'duration_ms': round(duration, 2),
            'response_size': len(response.get_data())
        }
        
        if response.status_code >= 400:
            logger.warning("Request completed with error", **log_data)
        else:
            logger.info("Request completed", **log_data)
        
        return response

def log_business_event(event_type, data, user_id=None):
    """Log business events"""
    logger.info(
        "Business event",
        event_type=event_type,
        event_data=data,
        user_id=user_id
    )

def log_model_event(event_type, model_name, duration=None, accuracy=None, **kwargs):
    """Log ML model events"""
    log_data = {
        'event_type': event_type,
        'model_name': model_name,
        **kwargs
    }
    
    if duration is not None:
        log_data['duration_seconds'] = duration
    
    if accuracy is not None:
        log_data['accuracy'] = accuracy
    
    logger.info("Model event", **log_data)

def log_cache_event(operation, key, hit=None, duration=None):
    """Log cache events"""
    log_data = {
        'operation': operation,
        'cache_key': key
    }
    
    if hit is not None:
        log_data['cache_hit'] = hit
    
    if duration is not None:
        log_data['duration_ms'] = duration
    
    logger.info("Cache event", **log_data)

def log_error(error, context=None):
    """Log errors with context"""
    log_data = {
        'error_type': type(error).__name__,
        'error_message': str(error)
    }
    
    if context:
        log_data['context'] = context
    
    logger.error("Application error", **log_data, exc_info=True)

def log_security_event(event_type, details, severity='medium'):
    """Log security events"""
    logger.warning(
        "Security event",
        event_type=event_type,
        details=details,
        severity=severity
    )

def log_performance_event(operation, duration, threshold=None, **metadata):
    """Log performance events"""
    log_data = {
        'operation': operation,
        'duration_seconds': duration,
        **metadata
    }
    
    if threshold and duration > threshold:
        logger.warning("Performance threshold exceeded", **log_data)
    else:
        logger.info("Performance event", **log_data)

# Export the configured logger and helper functions
__all__ = [
    'logger',
    'RequestLogger',
    'log_business_event',
    'log_model_event',
    'log_cache_event',
    'log_error',
    'log_security_event',
    'log_performance_event'
]
