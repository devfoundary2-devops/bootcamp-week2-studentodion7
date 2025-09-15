-- ShopMicro Database Initialization Script
-- This script runs when PostgreSQL container starts for the first time

-- Create database if it doesn't exist (already created by POSTGRES_DB env var)
-- CREATE DATABASE IF NOT EXISTS shopmicro;

-- Connect to shopmicro database
\c shopmicro;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    category VARCHAR(100) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    shipping_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Insert sample data
INSERT INTO products (name, description, price, category, stock, image_url) VALUES
('High-Performance Laptop', 'Latest generation laptop with fast processor and ample memory', 999.99, 'Electronics', 10, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400'),
('Smartphone Pro', 'Advanced smartphone with excellent camera and long battery life', 599.99, 'Electronics', 25, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'),
('Wireless Headphones', 'Premium noise-cancelling wireless headphones', 199.99, 'Electronics', 50, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'),
('DevOps Handbook', 'Comprehensive guide to DevOps practices and methodologies', 29.99, 'Books', 100, 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400'),
('Programming Coffee Mug', 'Perfect mug for developers - keeps coffee hot during long coding sessions', 14.99, 'Home', 75, 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400'),
('Mechanical Keyboard', 'Tactile mechanical keyboard for enhanced typing experience', 129.99, 'Electronics', 30, 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400'),
('4K Monitor', 'Ultra HD monitor perfect for development and design work', 299.99, 'Electronics', 15, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400'),
('Docker & Kubernetes Guide', 'Learn containerization and orchestration', 34.99, 'Books', 80, 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400')
ON CONFLICT DO NOTHING;

-- Insert sample users (passwords are 'password123' hashed with bcrypt)
INSERT INTO users (username, email, password_hash, role, first_name, last_name) VALUES
('admin', 'admin@shopmicro.com', '$2b$10$rOjYKJk5EK5xjJkNz1ZJkOoP7ZzJ9J6XZ8YoP5N1q6L0bN5V2K8C2', 'admin', 'Admin', 'User'),
('john_doe', 'john@example.com', '$2b$10$rOjYKJk5EK5xjJkNz1ZJkOoP7ZzJ9J6XZ8YoP5N1q6L0bN5V2K8C2', 'customer', 'John', 'Doe'),
('jane_smith', 'jane@example.com', '$2b$10$rOjYKJk5EK5xjJkNz1ZJkOoP7ZzJ9J6XZ8YoP5N1q6L0bN5V2K8C2', 'customer', 'Jane', 'Smith'),
('mike_dev', 'mike@example.com', '$2b$10$rOjYKJk5EK5xjJkNz1ZJkOoP7ZzJ9J6XZ8YoP5N1q6L0bN5V2K8C2', 'customer', 'Mike', 'Developer')
ON CONFLICT DO NOTHING;

-- Insert sample orders
INSERT INTO orders (user_id, total_amount, status, shipping_address) VALUES
(2, 1199.98, 'delivered', '123 Main St, Anytown, ST 12345'),
(3, 229.98, 'shipped', '456 Oak Ave, Another City, ST 67890'),
(4, 44.98, 'processing', '789 Pine Rd, Yet Another Town, ST 54321')
ON CONFLICT DO NOTHING;

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
(1, 1, 1, 999.99),
(1, 3, 1, 199.99),
(2, 3, 1, 199.99),
(2, 5, 2, 14.99),
(3, 4, 1, 29.99),
(3, 5, 1, 14.99)
ON CONFLICT DO NOTHING;

-- Create a view for order summaries
CREATE OR REPLACE VIEW order_summary AS
SELECT 
    o.id as order_id,
    u.username,
    u.email,
    o.total_amount,
    o.status,
    o.created_at,
    COUNT(oi.id) as item_count
FROM orders o
JOIN users u ON o.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, u.username, u.email, o.total_amount, o.status, o.created_at;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (optional, since we're using the postgres user)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Display successful initialization message
SELECT 'ShopMicro database initialized successfully!' as message;