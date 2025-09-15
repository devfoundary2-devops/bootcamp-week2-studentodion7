import React from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand">
          ShopMicro
        </Link>
        <ul className="navbar-nav">
          <li><Link to="/products">Products</Link></li>
          <li><Link to="/profile">Profile</Link></li>
          <li><Link to="/admin">Admin</Link></li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;