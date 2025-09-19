# Multi-stage build for Python ML service
FROM python:3.12-slim AS base

# Install system dependencies and security updates
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        && rm -rf /var/lib/apt/lists/* && \
    pip install --upgrade pip setuptools wheel

# Create app directory and user
WORKDIR /usr/src/app
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /usr/src/app

# Development stage
FROM base AS development
USER app
COPY --chown=app:app requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt
COPY --chown=app:app . .
EXPOSE 3002
CMD ["python", "app.py"]

# Production stage
FROM base AS production
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

USER app

# Install Python dependencies
COPY --chown=app:app requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY --chown=app:app app.py .
COPY --chown=app:app .env* ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

EXPOSE 3002

# Use gunicorn for production
CMD ["python", "-m", "gunicorn", "--bind", "0.0.0.0:3002", "--workers", "2", "--threads", "4", "--worker-class", "gthread", "app:app"]