"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { analyzeImage } from '../../services/aiService';
import { uploadImage, saveUploadRecord, saveResult, getHistory, getLocalImageUrl } from '../../services/uploadService';
import { getNotifications, getDefaultNotifications, getSeasonalAdvice } from '../../services/notificationService';
import LoadingSpinner from '../../components/LoadingSpinner';
import MarketPrediction from '../../components/MarketPrediction';
import ProtectedRoute from '../../components/ProtectedRoute';
import CameraCapture from '../../components/CameraCapture';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

function Dashboard() {
  const { user, userProfile } = useAuth();
  const { t, language } = useLanguage();
  const fileInputRef = useRef(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('upload');

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Result state
  const [result, setResult] = useState(null);
  const [resultError, setResultError] = useState('');

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState([]);

  // Advice
  const advice = getSeasonalAdvice(language);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const data = await getHistory(user.id);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
      // Use demo history if Supabase not configured
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotifications(user.id);
      if (data.length === 0) {
        setNotifications(getDefaultNotifications());
      } else {
        setNotifications(data);
      }
    } catch {
      setNotifications(getDefaultNotifications());
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
    loadNotifications();
  }, [loadHistory, loadNotifications]);

  // File handling
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setResultError('Please select a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setResultError('Image must be less than 10MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(getLocalImageUrl(file));
    setResult(null);
    setResultError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragover(true);
  };

  const handleDragLeave = () => {
    setDragover(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setResultError('');
    setShowCamera(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraCapture = (file) => {
    setShowCamera(false);
    processFile(file);
    if (!navigator.onLine) {
      setResultError('You are currently offline. Image saved locally. Analysis will run when connection is restored.');
      // Offline fallback: save upload locally without AI process yet
      if (user) {
        uploadImage(file, user.id).then(imageUrl => {
          saveUploadRecord(user.id, imageUrl);
        });
      }
    }
  };

  // Analyze image
  const handleAnalyze = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setResultError('');
    setResult(null);

    try {
      let imageUrl = previewUrl;

      // Try to upload to Supabase if configured
      try {
        if (user) {
          imageUrl = await uploadImage(selectedFile, user.id);
          const upload = await saveUploadRecord(user.id, imageUrl);

          // Analyze with AI
          const aiResult = await analyzeImage(imageUrl, language);
          
          // Save result to DB
          await saveResult(upload.id, aiResult);
          
          setResult(aiResult);
          loadHistory();
          return;
        }
      } catch (supabaseErr) {
        console.warn('Supabase not configured, using demo mode:', supabaseErr);
      }

      // Fallback: analyze without Supabase (demo mode)
      const aiResult = await analyzeImage(imageUrl, language);
      setResult(aiResult);

    } catch (err) {
      if (!navigator.onLine) {
         setResultError('You are offline. Please reconnect to internet for AI analysis.');
      } else {
         setResultError(err.message || 'Analysis failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const viewHistoryItem = (item) => {
    if (item.results && item.results.length > 0) {
      const r = item.results[0];
      setResult({
        disease: r.disease,
        symptoms: r.symptoms,
        severity: r.severity,
        remedy_chemical: r.remedy_chemical,
        remedy_organic: r.remedy_organic,
        prevention: r.prevention,
        confidence: r.confidence
      });
      setPreviewUrl(item.image_url);
      setSelectedFile(null); // Assuming viewing history
      setActiveTab('upload');
    }
  };

  const tabs = [
    { id: 'upload', icon: '📤', label: t('dash_upload') },
    { id: 'market', icon: '📈', label: 'Market Prices' },
    { id: 'history', icon: '📚', label: t('dash_history') },
    { id: 'notifications', icon: '🔔', label: t('dash_notifications') },
    { id: 'advice', icon: '🌾', label: t('dash_advice') },
  ];

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="dashboard">
      <div className="container">
        <div className="dashboard-grid">
          {/* Sidebar */}
          <aside className="dashboard-sidebar">
            <div style={{ 
              padding: 'var(--space-4)', 
              borderBottom: '1px solid var(--border-color)',
              marginBottom: 'var(--space-4)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-2)'
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, var(--green-600), var(--cyan-500))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700
                }}>
                  {(userProfile?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                    {userProfile?.name || 'Farmer'}
                  </p>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    {user?.email || ''}
                  </p>
                </div>
              </div>
            </div>
            <nav className="sidebar-nav">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`sidebar-link ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="icon">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="dashboard-main">
            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <div>
                <div className="dashboard-header">
                  <h2>📤 {t('dash_upload_title')}</h2>
                  <p>{t('dash_upload_desc')}</p>
                </div>

                {/* Upload Zone & Camera */}
                {showCamera ? (
                  <CameraCapture onCapture={handleCameraCapture} onCancel={() => setShowCamera(false)} />
                ) : !previewUrl ? (
                  <div
                    className={`upload-zone ${dragover ? 'dragover' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      id="file-upload"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
                      <div style={{
                        width: '80px', height: '80px', borderRadius: 'var(--radius-full)', background: 'linear-gradient(135deg, var(--green-600), var(--cyan-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', boxShadow: 'var(--glow-green)'
                      }}>
                        📸
                      </div>
                      <h3 style={{ fontSize: 'var(--fs-2xl)', marginTop: 'var(--space-2)' }}>Live Camera Detection</h3>
                      <p style={{ color: 'var(--text-secondary)' }}>Instantly diagnose your crops offline or online.</p>
                      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowCamera(true)}>
                          Open Camera
                        </button>
                        <button className="btn btn-secondary btn-lg" onClick={() => fileInputRef.current?.click()}>
                          Upload Image
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="upload-zone">
                    <div className="upload-preview" onClick={e => e.stopPropagation()}>
                      <img src={previewUrl} alt="Crop preview" />
                      <button className="remove-btn" onClick={removeFile}>✕</button>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                        <button className="btn btn-secondary" onClick={removeFile}>
                          Retake Photo
                        </button>
                    </div>
                  </div>
                )}

                {/* Analyze Button */}
                {selectedFile && !uploading && (
                  <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
                    <button 
                      className="btn btn-primary btn-lg"
                      onClick={handleAnalyze}
                      disabled={uploading}
                    >
                      🤖 {t('dash_analyze')}
                    </button>
                  </div>
                )}

                {/* Loading */}
                {uploading && (
                  <LoadingSpinner text={t('dash_analyzing')} />
                )}

                {/* Error */}
                {resultError && (
                  <div style={{
                    marginTop: 'var(--space-6)',
                    padding: 'var(--space-4) var(--space-6)',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid var(--red-400)',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--red-400)',
                    fontSize: 'var(--fs-sm)'
                  }}>
                    ⚠️ {resultError}
                  </div>
                )}

                {/* Result */}
                {result && (
                  <div style={{ marginTop: 'var(--space-6)' }}>
                    <div className="result-card">
                      <div className="result-header">
                        <div>
                          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            {t('result_disease')}
                          </p>
                          <h3 className="result-disease">
                            {result.disease === 'Healthy' ? `✅ ${t('result_healthy')}` : `🔍 ${result.disease}`}
                          </h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {result.confidence && (
                            <span className="result-confidence">
                              📊 {result.confidence}%
                            </span>
                          )}
                          {result.severity && result.disease !== 'Healthy' && (
                            <span style={{
                              background: result.severity === 'High' ? 'rgba(239,68,68,0.2)' : result.severity === 'Medium' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)',
                              color: result.severity === 'High' ? 'var(--red-400)' : result.severity === 'Medium' ? 'var(--yellow-400)' : 'var(--green-400)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {t('result_severity')}: {result.severity}
                            </span>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if ('speechSynthesis' in window) {
                                window.speechSynthesis.cancel();
                                const text = `${result.disease}. ${result.symptoms}. ${t('result_chemical_remedy')}: ${result.remedy_chemical || result.remedy}. ${t('result_organic_remedy')}: ${result.remedy_organic || result.remedy}`;
                                const msg = new SpeechSynthesisUtterance(text);
                                msg.lang = language === 'ta' ? 'ta-IN' : 'en-US';
                                window.speechSynthesis.speak(msg);
                              }
                            }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', marginTop: '4px', padding: '4px'
                            }}
                            title="Listen"
                          >
                            🔊
                          </button>
                        </div>
                      </div>

                      {result.disease === 'Healthy' ? (
                        <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>🎉</div>
                          <p style={{ color: 'var(--green-400)', fontSize: 'var(--fs-lg)' }}>
                            {t('result_healthy_msg')}
                          </p>
                        </div>
                      ) : (
                        <div className="result-sections">
                          <div className="result-section">
                            <div className="result-section-icon symptoms">⚠️</div>
                            <div className="result-section-content">
                              <h4>{t('result_symptoms')}</h4>
                              <p>{result.symptoms}</p>
                            </div>
                          </div>

                          <div className="result-section">
                            <div className="result-section-icon remedy">🧪</div>
                            <div className="result-section-content">
                              <h4>{t('result_chemical_remedy')}</h4>
                              <p>{result.remedy_chemical || result.remedy}</p>
                            </div>
                          </div>
                          
                          <div className="result-section">
                            <div className="result-section-icon remedy">🌿</div>
                            <div className="result-section-content">
                              <h4>{t('result_organic_remedy')}</h4>
                              <p>{result.remedy_organic || result.remedy}</p>
                            </div>
                          </div>

                          <div className="result-section">
                            <div className="result-section-icon prevention">🛡️</div>
                            <div className="result-section-content">
                              <h4>{t('result_prevention')}</h4>
                              <p>{result.prevention}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Market Prices Tab */}
            {activeTab === 'market' && (
              <div>
                <div className="dashboard-header">
                  <h2>📈 Market Trends & Predictions</h2>
                  <p>AI-powered insights for best selling time and price forecasting.</p>
                </div>
                <MarketPrediction />
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <div className="dashboard-header">
                  <h2>📚 {t('dash_history_title')}</h2>
                  <p>{t('dash_history_desc')}</p>
                </div>

                {historyLoading ? (
                  <LoadingSpinner />
                ) : history.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>{t('dash_no_history')}</h3>
                    <p>{t('dash_no_history_desc')}</p>
                    <button 
                      className="btn btn-primary" 
                      style={{ marginTop: 'var(--space-4)' }}
                      onClick={() => setActiveTab('upload')}
                    >
                      📤 {t('dash_upload')}
                    </button>
                  </div>
                ) : (
                  <div className="history-list">
                    {history.map((item) => (
                      <div 
                        className="history-item" 
                        key={item.id}
                        onClick={() => viewHistoryItem(item)}
                      >
                        <img 
                          src={item.image_url} 
                          alt="Crop" 
                          onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect fill="%23064e3b" width="80" height="80"/><text x="40" y="45" text-anchor="middle" fill="%2310b981" font-size="24">🌿</text></svg>'; }}
                        />
                        <div className="history-info">
                          <h4>{item.results?.[0]?.disease || 'Analysis'}</h4>
                          <p>{item.results?.[0]?.symptoms?.substring(0, 100) || 'View details'}...</p>
                          <p className="history-date">{formatDate(item.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div>
                <div className="dashboard-header">
                  <h2>🔔 {t('dash_notif_title')}</h2>
                  <p>{t('dash_notif_desc')}</p>
                </div>

                {notifications.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔕</div>
                    <h3>{t('dash_no_notif')}</h3>
                    <p>{t('dash_no_notif_desc')}</p>
                  </div>
                ) : (
                  <div>
                    {notifications.map((notif) => (
                      <div className="notification-item" key={notif.id}>
                        <div className="notification-dot"></div>
                        <div className="notification-content">
                          <p>{notif.message}</p>
                          <p className="notification-time">{formatDate(notif.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Advice Tab */}
            {activeTab === 'advice' && (
              <div>
                <div className="dashboard-header">
                  <h2>🌾 {t('dash_advice_title')}</h2>
                  <p>{t('dash_advice_desc')}</p>
                </div>

                <div className="grid-2">
                  {advice.map((item) => (
                    <div className="advice-card" key={item.id}>
                      <span className="advice-category">{item.category}</span>
                      <h4>{item.title}</h4>
                      <p>{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
