import React, { useState, useEffect } from 'react';
import { getUserProfile } from '../services/api';

function UserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Mock user ID - in real app, get from auth context
  const userId = 2;

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserProfile(userId);
      setProfile(data);
      setError(null);
    } catch (err) {
      setError('Failed to load profile');
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>User Profile</h1>
      
      <div className="dashboard">
        {/* Basic Info */}
        <div className="dashboard-card">
          <h3>Basic Information</h3>
          <div className="metric">
            <span>Username</span>
            <span className="metric-value">{profile.username}</span>
          </div>
          <div className="metric">
            <span>Email</span>
            <span className="metric-value">{profile.email}</span>
          </div>
          <div className="metric">
            <span>Role</span>
            <span className="metric-value">{profile.role}</span>
          </div>
          <div className="metric">
            <span>Member Since</span>
            <span className="metric-value">
              {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Preferences */}
        <div className="dashboard-card">
          <h3>Preferences</h3>
          <div className="metric">
            <span>Notifications</span>
            <span className="metric-value">
              {profile.preferences?.notifications ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="metric">
            <span>Theme</span>
            <span className="metric-value">{profile.preferences?.theme || 'Default'}</span>
          </div>
          <div className="metric">
            <span>Language</span>
            <span className="metric-value">{profile.preferences?.language || 'English'}</span>
          </div>
        </div>

        {/* Statistics */}
        <div className="dashboard-card">
          <h3>Activity Statistics</h3>
          <div className="metric">
            <span>Total Orders</span>
            <span className="metric-value">{profile.stats?.orders || 0}</span>
          </div>
          <div className="metric">
            <span>Wishlist Items</span>
            <span className="metric-value">{profile.stats?.wishlistItems || 0}</span>
          </div>
          <div className="metric">
            <span>Account Status</span>
            <span className="metric-value">Active</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card">
          <h3>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn">Edit Profile</button>
            <button className="btn btn-secondary">Change Password</button>
            <button className="btn btn-secondary">Manage Notifications</button>
            <button className="btn btn-secondary">View Order History</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;