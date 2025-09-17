import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories } from '../services/api';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    page: 1
  });

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getProducts(filters);
      setProducts(data.products);
      setError(null);
    } catch (err) {
      setError('Failed to load products');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data.categories);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [filters, loadProducts, loadCategories]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  const getStockStatus = (stock) => {
    if (stock === 0) return { text: 'Out of Stock', class: 'out' };
    if (stock < 10) return { text: `Low Stock (${stock})`, class: 'low' };
    return { text: `In Stock (${stock})`, class: '' };
  };

  if (loading && products.length === 0) {
    return (
      <div className="container">
        <div className="loading">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Products</h1>
      
      {/* Search and Filters */}
      <div className="search-filters">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="search">Search Products</label>
            <input
              type="text"
              id="search"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search products..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <button 
              className="btn"
              onClick={() => setFilters({ search: '', category: '', page: 1 })}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Product Grid */}
      <div className="product-grid">
        {products.length === 0 && !loading ? (
          <div className="error">No products found</div>
        ) : (
          products.map(product => {
            const stockStatus = getStockStatus(product.stock);
            return (
              <div key={product.id} className="product-card">
                <div className="category">{product.category}</div>
                <h3>{product.name}</h3>
                <div className="price">${product.price.toFixed(2)}</div>
                <p className="description">{product.description}</p>
                <div className={`stock ${stockStatus.class}`}>
                  {stockStatus.text}
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <Link to={`/products/${product.id}`} className="btn">
                    View Details
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {loading && products.length > 0 && (
        <div className="loading">Loading more products...</div>
      )}
    </div>
  );
}

export default ProductList;