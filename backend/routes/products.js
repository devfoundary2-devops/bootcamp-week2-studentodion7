const express = require('express');
const Joi = require('joi');
const router = express.Router();

// Mock data - in real app, this would come from database
let products = [
  { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics', stock: 10, description: 'High-performance laptop' },
  { id: 2, name: 'Smartphone', price: 599.99, category: 'Electronics', stock: 25, description: 'Latest smartphone' },
  { id: 3, name: 'Headphones', price: 199.99, category: 'Electronics', stock: 50, description: 'Wireless headphones' },
  { id: 4, name: 'Book', price: 29.99, category: 'Books', stock: 100, description: 'DevOps handbook' },
  { id: 5, name: 'Coffee Mug', price: 14.99, category: 'Home', stock: 75, description: 'Programmer coffee mug' }
];

// Validation schemas
const productSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  price: Joi.number().positive().required(),
  category: Joi.string().min(1).max(50).required(),
  stock: Joi.number().integer().min(0).required(),
  description: Joi.string().max(500).optional()
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  price: Joi.number().positive().optional(),
  category: Joi.string().min(1).max(50).optional(),
  stock: Joi.number().integer().min(0).optional(),
  description: Joi.string().max(500).optional()
}).min(1);

// GET /api/products - Get all products with pagination
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category;
    const search = req.query.search;

    let filteredProducts = [...products];

    // Filter by category
    if (category) {
      filteredProducts = filteredProducts.filter(p => 
        p.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Search in name and description
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    res.json({
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total: filteredProducts.length,
        pages: Math.ceil(filteredProducts.length / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = products.find(p => p.id === id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// POST /api/products - Create new product
router.post('/', (req, res) => {
  try {
    const { error, value } = productSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details.map(d => d.message) 
      });
    }

    const newProduct = {
      id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
      ...value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === id);

    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { error, value } = updateProductSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details.map(d => d.message) 
      });
    }

    products[productIndex] = {
      ...products[productIndex],
      ...value,
      updatedAt: new Date().toISOString()
    };

    res.json(products[productIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === id);

    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const deletedProduct = products.splice(productIndex, 1)[0];
    res.json({ message: 'Product deleted successfully', product: deletedProduct });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/products/categories - Get all categories
router.get('/meta/categories', (req, res) => {
  try {
    const categories = [...new Set(products.map(p => p.category))];
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

module.exports = router;