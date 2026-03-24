import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function MarketPrediction() {
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    fetchMarketData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const PORT = process.env.PORT || 5000;
      const res = await axios.get(`http://localhost:${PORT}/api/market-prices`);
      setMarketData(res.data.prices);
      // Cache for offline
      localStorage.setItem('agroai_market_data', JSON.stringify(res.data.prices));
      setError('');
    } catch (err) {
      console.error('API Error:', err);
      // Fallback to cache
      const cached = localStorage.getItem('agroai_market_data');
      if (cached) {
        setMarketData(JSON.parse(cached));
        setIsOffline(true);
      } else {
        setError('Failed to load market data and no offline cache available.');
      }
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = (past, predicted) => {
    const data = [];
    const today = new Date();
    
    // Last 7 days of past data
    const recentPast = past.slice(-7);
    recentPast.forEach((price, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (7 - i));
      data.push({
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        Actual: price,
        Predicted: null
      });
    });

    // The current day ties both lines
    data.push({
      date: 'Today',
      Actual: past[past.length - 1],
      Predicted: past[past.length - 1]
    });

    // Next 7 days predicted
    predicted.forEach((price, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i + 1);
      data.push({
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        Actual: null,
        Predicted: price
      });
    });

    return data;
  };

  if (loading) return <LoadingSpinner text="Analyzing market trends..." />;

  return (
    <div className="market-prediction">
      {isOffline && (
        <div className="offline-banner" style={{
          backgroundColor: '#fef3c7', color: '#92400e', padding: '12px', 
          borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertCircle size={20} />
          <span>You are offline – showing last available cached market data.</span>
        </div>
      )}

      {error ? (
        <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {marketData.map((crop, idx) => (
            <div key={idx} style={{
              background: 'white', borderRadius: '12px', padding: '20px', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #eee'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1f2937' }}>{crop.crop}</h3>
                <span style={{ 
                  display: 'flex', alignItems: 'center', gap: '4px',
                  color: crop.trend === 'up' ? '#10b981' : '#ef4444',
                  fontWeight: 'bold'
                }}>
                  {crop.trend === 'up' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  ₹{crop.currentPrice} / qtl
                </span>
              </div>
              
              <div style={{ height: '200px', width: '100%', marginBottom: '16px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepareChartData(crop.pastData, crop.predictions)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#6b7280'}} tickMargin={10} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#6b7280'}} tickMargin={10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="Actual" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                    <Line type="monotone" dataKey="Predicted" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={{r: 4}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{
                background: crop.recommendation === 'Sell Now' ? '#fee2e2' : '#dcfce7',
                padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${crop.recommendation === 'Sell Now' ? '#ef4444' : '#10b981'}`
              }}>
                <strong style={{ display: 'block', color: '#1f2937', marginBottom: '4px' }}>
                  Smart Decision: {crop.recommendation}
                </strong>
                <span style={{ fontSize: '0.9rem', color: '#4b5563' }}>
                  {crop.insight}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
