const express = require('express');
const Joi = require('joi');
const router = express.Router();

// Mock user data - in real app, this would come from database
let users = [
  { id: 1, username: 'admin', email: 'admin@shopmicro.com', role: 'admin', createdAt: '2023-01-01T00:00:00Z' },
  { id: 2, username: 'user1', email: 'user1@example.com', role: 'customer', createdAt: '2023-06-01T00:00:00Z' },
  { id: 3, username: 'user2', email: 'user2@example.com', role: 'customer', createdAt: '2023-07-01T00:00:00Z' }
];

// Validation schemas
const userSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('admin', 'customer').default('customer'),
  password: Joi.string().min(6).required()
});

// GET /api/users - Get all users (admin only in real app)
router.get('/', (req, res) => {
  try {
    // Remove sensitive information
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json({ users: safeUsers });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = users.find(u => u.id === id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove sensitive information
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// POST /api/users - Create new user (registration)
router.post('/', (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details.map(d => d.message) 
      });
    }

    // Check if username or email already exists
    const existingUser = users.find(u => 
      u.username === value.username || u.email === value.email
    );

    if (existingUser) {
      return res.status(409).json({ 
        error: 'Conflict', 
        message: 'Username or email already exists' 
      });
    }

    // In real app, hash the password
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      username: value.username,
      email: value.email,
      role: value.role,
      password: value.password, // In real app, this would be hashed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    
    // Return user without password
    const { password, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/users/:id/profile - Get user profile (simulated auth)
router.get('/:id/profile', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = users.find(u => u.id === id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Simulate user profile with additional info
    const profile = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en'
      },
      stats: {
        orders: Math.floor(Math.random() * 20),
        wishlistItems: Math.floor(Math.random() * 10)
      }
    };

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// POST /api/users/login - Simulate login (basic version)
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Username and password are required' 
      });
    }

    const user = users.find(u => 
      u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({ 
        error: 'Authentication failed', 
        message: 'Invalid credentials' 
      });
    }

    // In real app, generate JWT token
    const token = `mock-jwt-token-${user.id}-${Date.now()}`;
    const { password: _, ...safeUser } = user;

    res.json({
      message: 'Login successful',
      user: safeUser,
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

module.exports = router;