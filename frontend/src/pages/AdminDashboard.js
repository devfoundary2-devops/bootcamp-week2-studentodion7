import React, { useState, useEffect } from 'react';
import { getDetailedHealth, getMetrics, getProducts, getUsers } from '../services/api';

function AdminDashboard() {
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [healthData, metricsData, productsData, usersData] = await Promise.allSettled([
        getDetailedHealth(),
        getMetrics(),
        getProducts(),
        getUsers()
      ]);

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value);
      }

      if (metricsData.status === 'fulfilled') {
        setMetrics(metricsData.value);
      }

      if (productsData.status === 'fulfilled') {
        setStats(prev => ({ ...prev, totalProducts: productsData.value.products?.length || 0 }));
      }

      if (usersData.status === 'fulfilled') {
        setStats(prev => ({ ...prev, totalUsers: usersData.value.users?.length || 0 }));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Admin Dashboard</h1>
      
      <div className="dashboard">
        {/* Application Stats */}
        <div className="dashboard-card">
          <h3>Application Statistics</h3>
          <div className="metric">
            <span>Total Products</span>
            <span className="metric-value">{stats.totalProducts}</span>
          </div>
          <div className="metric">
            <span>Total Users</span>
            <span className="metric-value">{stats.totalUsers}</span>
          </div>
          <div className="metric">
            <span>Application Status</span>
            <span className="metric-value">{health?.status || 'Unknown'}</span>
          </div>
          <div className="metric">
            <span>Uptime</span>
            <span className="metric-value">
              {health?.uptime ? `${Math.floor(health.uptime / 60)}m` : 'N/A'}
            </span>
          </div>
        </div>

        {/* System Health */}
        {health && (
          <div className="dashboard-card">
            <h3>System Health</h3>
            <div className="metric">
              <span>Environment</span>
              <span className="metric-value">{health.environment}</span>
            </div>
            <div className="metric">
              <span>Memory Usage</span>
              <span className="metric-value">
                {Math.round(health.memory?.heapUsed / 1024 / 1024)}MB
              </span>
            </div>
            <div className="metric">
              <span>Database</span>
              <span className="metric-value">{health.dependencies?.database?.status}</span>
            </div>
            <div className="metric">
              <span>Redis</span>
              <span className="metric-value">{health.dependencies?.redis?.status}</span>
            </div>
          </div>
        )}

        {/* Request Metrics */}
        {metrics && (
          <div className="dashboard-card">
            <h3>Request Metrics</h3>
            <div className="metric">
              <span>Total Requests</span>
              <span className="metric-value">{metrics.requests?.total}</span>
            </div>
            <div className="metric">
              <span>Request Rate</span>
              <span className="metric-value">
                {metrics.requests?.rate?.toFixed(2)} req/sec
              </span>
            </div>
            <div className="metric">
              <span>Avg Response Time</span>
              <span className="metric-value">{metrics.response_time?.average}ms</span>
            </div>
            <div className="metric">
              <span>P95 Response Time</span>
              <span className="metric-value">{metrics.response_time?.p95}ms</span>
            </div>
            <div className="metric">
              <span>Total Errors</span>
              <span className="metric-value">{metrics.errors?.total}</span>
            </div>
          </div>
        )}

        {/* Request Methods */}
        {metrics?.requests?.by_method && (
          <div className="dashboard-card">
            <h3>Requests by Method</h3>
            {Object.entries(metrics.requests.by_method).map(([method, count]) => (
              <div key={method} className="metric">
                <span>{method}</span>
                <span className="metric-value">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Status Codes */}
        {metrics?.requests?.by_status && (
          <div className="dashboard-card">
            <h3>Responses by Status Code</h3>
            {Object.entries(metrics.requests.by_status).map(([status, count]) => (
              <div key={status} className="metric">
                <span>HTTP {status}</span>
                <span className="metric-value">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* System Info */}
        {metrics?.system && (
          <div className="dashboard-card">
            <h3>System Information</h3>
            <div className="metric">
              <span>Platform</span>
              <span className="metric-value">{metrics.system.platform}</span>
            </div>
            <div className="metric">
              <span>Node Version</span>
              <span className="metric-value">{metrics.system.node_version}</span>
            </div>
            <div className="metric">
              <span>Memory RSS</span>
              <span className="metric-value">
                {Math.round(metrics.memory?.rss / 1024 / 1024)}MB
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button 
          className="btn" 
          onClick={loadDashboardData}
        >
          Refresh Dashboard
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;