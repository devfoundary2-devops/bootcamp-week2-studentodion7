import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import RouteTracker from './components/RouteTracker';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import UserProfile from './pages/UserProfile';
import AdminDashboard from './pages/AdminDashboard';
import { useMonitoring } from './hooks/useMonitoring';
import monitoringService from './services/monitoring';
import './App.css';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Report error to monitoring service
    if (window.reportReactError) {
      window.reportReactError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <p>We're sorry, but something unexpected happened. Please refresh the page or try again later.</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 🥚 Easter Egg #2: Konami Code Detection
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
];

function App() {
  const { recordBusinessEvent } = useMonitoring();
  const [konamiMode, setKonamiMode] = useState(false);
  const [konamiSequence, setKonamiSequence] = useState([]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      const newSequence = [...konamiSequence, event.code].slice(-10);
      setKonamiSequence(newSequence);

      if (JSON.stringify(newSequence) === JSON.stringify(KONAMI_CODE)) {
        setKonamiMode(true);
        recordBusinessEvent('konami_code_activated', {
          timestamp: new Date().toISOString(),
          achievement: 'easter_egg_2_found'
        });
        
        // Show celebration
        alert('🎮 KONAMI CODE ACTIVATED! 🎮\n\n🏆 Developer Mode Unlocked!\n✨ Extra metrics enabled!\n🎊 Achievement: Code Master!');
        
        // Add special CSS class for visual effects
        document.body.classList.add('konami-mode');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [konamiSequence, recordBusinessEvent]);

  useEffect(() => {
    // Record app initialization
    recordBusinessEvent('app_initialized', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      konamiMode: konamiMode
    });

    // Set up performance observer for additional metrics
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            monitoringService.recordMetric('navigation_timing', {
              name: entry.name,
              duration: entry.duration,
              loadEventEnd: entry.loadEventEnd,
              domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
              timestamp: new Date().toISOString()
            });
          } else if (entry.entryType === 'resource') {
            monitoringService.recordMetric('resource_timing', {
              name: entry.name,
              duration: entry.duration,
              transferSize: entry.transferSize,
              encodedBodySize: entry.encodedBodySize,
              decodedBodySize: entry.decodedBodySize,
              timestamp: new Date().toISOString()
            });
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['navigation', 'resource'] });
      } catch (e) {
        console.warn('Performance observer not supported:', e);
      }
    }

    // Clean up on unmount
    return () => {
      recordBusinessEvent('app_unmounted', {
        timestamp: new Date().toISOString()
      });
    };
  }, [recordBusinessEvent, konamiMode]);

  return (
    <ErrorBoundary>
      <Router>
        <RouteTracker />
        <div className="App">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<ProductList />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          <footer className="footer">
            <div className="container">
              <p>&copy; {new Date().getFullYear()} ShopMicro - DevOps Bootcamp Demo</p>
            </div>
          </footer>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;