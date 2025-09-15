const express = require('express');
const router = express.Router();

// Basic health check
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const healthcheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    dependencies: {
      database: await checkDatabase(),
      redis: await checkRedis()
    }
  };

  const allHealthy = Object.values(healthcheck.dependencies).every(dep => dep.status === 'healthy');
  
  res.status(allHealthy ? 200 : 503).json(healthcheck);
});

// Readiness check for Kubernetes
router.get('/ready', async (req, res) => {
  try {
    const dbStatus = await checkDatabase();
    const redisStatus = await checkRedis();
    
    if (dbStatus.status === 'healthy' && redisStatus.status === 'healthy') {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready', dependencies: { dbStatus, redisStatus } });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Liveness check for Kubernetes
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

async function checkDatabase() {
  try {
    // Mock database check - in real app, ping actual database
    return {
      status: 'healthy',
      responseTime: Math.random() * 10,
      message: 'Database connection successful'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message
    };
  }
}

async function checkRedis() {
  try {
    // Mock Redis check - in real app, ping actual Redis
    return {
      status: 'healthy',
      responseTime: Math.random() * 5,
      message: 'Redis connection successful'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message
    };
  }
}

module.exports = router;