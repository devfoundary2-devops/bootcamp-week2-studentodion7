import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct, getRecommendations } from '../services/api';

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getProduct(id);
      setProduct(data);
      setError(null);
    } catch (err) {
      setError('Product not found');
      console.error('Error loading product:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRecommendations = useCallback(async () => {
    try {
      const data = await getRecommendations(1); // Mock user ID
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error('Error loading recommendations:', err);
    }
  }, []);

  useEffect(() => {
    if (id) {
      loadProduct();
      loadRecommendations();
    }
  }, [id, loadProduct, loadRecommendations]);

  const getStockStatus = (stock) => {
    if (stock === 0) return { text: 'Out of Stock', class: 'out' };
    if (stock < 10) return { text: `Low Stock (${stock} remaining)`, class: 'low' };
    return { text: `In Stock (${stock} available)`, class: '' };
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading product...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <Link to="/products" className="btn">← Back to Products</Link>
      </div>
    );
  }

  const stockStatus = getStockStatus(product.stock);

  return (
    <div className="container">
      <Link to="/products" className="btn btn-secondary" style={{ marginBottom: '2rem' }}>
        ← Back to Products
      </Link>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '3rem' }}>
        <div>
          <div className="product-card" style={{ height: 'fit-content' }}>
            <div className="category">{product.category}</div>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{product.name}</h1>
            <div className="price" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              ${product.price.toFixed(2)}
            </div>
            <div className={`stock ${stockStatus.class}`} style={{ marginBottom: '1rem' }}>
              {stockStatus.text}
            </div>
            <p className="description" style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
              {product.description}
            </p>
            
            <div style={{ marginTop: '2rem' }}>
              <button 
                className="btn" 
                style={{ marginRight: '1rem' }}
                disabled={product.stock === 0}
              >
                {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
              <button className="btn btn-secondary">
                Add to Wishlist
              </button>
            </div>
          </div>
        </div>
        
        <div>
          <div className="dashboard-card">
            <h3>Product Details</h3>
            <div className="metric">
              <span>Product ID</span>
              <span className="metric-value">{product.id}</span>
            </div>
            <div className="metric">
              <span>Category</span>
              <span className="metric-value">{product.category}</span>
            </div>
            <div className="metric">
              <span>Stock Level</span>
              <span className="metric-value">{product.stock}</span>
            </div>
            <div className="metric">
              <span>Price</span>
              <span className="metric-value">${product.price.toFixed(2)}</span>
            </div>
            {product.createdAt && (
              <div className="metric">
                <span>Added</span>
                <span className="metric-value">
                  {new Date(product.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="dashboard-card" style={{ marginTop: '2rem' }}>
              <h3>Recommended for You</h3>
              {recommendations.slice(0, 3).map(rec => (
                <div key={rec.id} className="metric">
                  <span>{rec.name}</span>
                  <span className="metric-value">
                    {Math.round(rec.score * 100)}% match
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;