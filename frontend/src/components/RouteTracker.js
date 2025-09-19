import { useEffect } from 'react';
import { useMonitoringWithRoutes } from '../hooks/useMonitoring';

const RouteTracker = () => {
  // This component uses the route-aware monitoring hook
  useMonitoringWithRoutes();
  
  return null; // This component doesn't render anything
};

export default RouteTracker;
