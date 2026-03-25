import React, { useState, useRef, useCallback, useEffect } from 'react';
import { processImage } from '../utils/imagePipeline';

const Camera = ({ onCapture, onCancel, isLive = false, onFrame }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const liveIntervalRef = useRef(null);

  const startCamera = useCallback(async () => {
    setError('');
    setIsReady(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch (e) {
        // Fallback to any available camera if primary rear camera fails
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      
      setStream(mediaStream);
      if (videoRef.current) {
        // Explicitly set muted & playsInline for strict mobile browsers (iOS Safari)
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        videoRef.current.srcObject = mediaStream;
        
        videoRef.current.play().catch(e => console.warn('Play interrupted', e));

        let attempts = 0;
        const checkReady = () => {
          if (videoRef.current) {
            // Some mobile browsers lag on videoWidth, check readyState or currentTime
            const isPlaying = videoRef.current.readyState >= 2 || videoRef.current.currentTime > 0;
            if (isPlaying || videoRef.current.videoWidth > 0) {
              setCameraActive(true);
              setIsReady(true);
              return;
            }
          }
          
          if (attempts < 80) { // Try for 8 seconds (80 * 100ms)
            attempts++;
            setTimeout(checkReady, 100);
          } else {
            console.warn('Camera feed timeout check failed, forcing ready state anyway.');
            // Force it to be ready so the user gets access to the native Video element
            setCameraActive(true);
            setIsReady(true);
          }
        };
        setTimeout(checkReady, 300);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        setError('Camera permission denied. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera device found on this device.');
      } else {
        setError(`Camera error: ${err.message}`);
      }
      setCameraActive(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const captureFrameForLive = async () => {
    if (videoRef.current && isLive) {
      try {
        const dataUrl = await processImage(videoRef.current);
        if (dataUrl && onFrame) {
          onFrame(dataUrl);
        }
      } catch (err) {
        console.warn('Live capture failed:', err.message);
      }
    }
  };

  useEffect(() => {
    if (isLive && cameraActive && isScanning) {
      liveIntervalRef.current = setInterval(() => {
        captureFrameForLive();
      }, 2000);
    } else {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    }
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [isLive, cameraActive, isScanning]);

  const captureImage = async () => {
    if (videoRef.current) {
      try {
        const dataUrl = await processImage(videoRef.current);
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
          setCameraActive(false);
        }
        if (onCapture) onCapture(file);
      } catch (err) {
        setError(err.message || 'Camera not ready or image too dark');
      }
    }
  };

  const handleCancel = () => {
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    onCancel();
  };

  return (
    <div className="camera-container" style={{ 
      position: 'relative', 
      width: '100%', 
      maxWidth: '600px', 
      height: '60vh',
      minHeight: '400px',
      margin: '0 auto', 
      borderRadius: 'var(--radius-2xl)', 
      overflow: 'hidden', 
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-glow)',
      boxShadow: 'var(--glow-green-intense)'
    }}>
      {error ? (
        <div style={{ padding: 'var(--space-8)', color: 'var(--red-400)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⚠️</div>
          <p style={{ fontSize: 'var(--fs-lg)' }}>{error}</p>
          <button className="btn btn-primary" onClick={handleCancel} style={{ marginTop: 'var(--space-6)' }}>Go Back</button>
        </div>
      ) : (
        <>
          {!isReady && (
            <div style={{ 
              position: 'absolute', inset: 0,
              display: 'flex', justifyContent: 'center', alignItems: 'center', 
              backgroundColor: 'var(--bg-secondary)', color: 'var(--green-400)', 
              flexDirection: 'column', gap: '1rem', zIndex: 30 
            }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '4px solid rgba(16, 185, 129, 0.2)', 
                borderTopColor: 'var(--green-400)', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
              }}></div>
              <p>Initializing Camera...</p>
            </div>
          )}
          {cameraActive && isReady && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 10,
              border: '2px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: 'inset 0 0 40px rgba(16, 185, 129, 0.2)'
            }}>
              <div style={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderTop: '4px solid var(--green-400)', borderLeft: '4px solid var(--green-400)' }}></div>
              <div style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderTop: '4px solid var(--green-400)', borderRight: '4px solid var(--green-400)' }}></div>
              <div style={{ position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, borderBottom: '4px solid var(--cyan-400)', borderLeft: '4px solid var(--cyan-400)' }}></div>
              <div style={{ position: 'absolute', bottom: 20, right: 20, width: 40, height: 40, borderBottom: '4px solid var(--cyan-400)', borderRight: '4px solid var(--cyan-400)' }}></div>
              
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, transparent, var(--green-400), transparent)',
                boxShadow: '0 0 10px var(--green-400)',
                opacity: 0.8,
                animation: isLive ? 'scanline 2s linear infinite' : 'none'
              }}></div>
            </div>
          )}

          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted  // CRITICAL: muted allows autoPlay on mobile devices
            style={{ 
              width: '100%', 
              height: '100%', 
              minHeight: '400px', // Fallback minimum height
              display: 'block',
              objectFit: 'cover',
              position: 'absolute', // Prevents CSS collapse
              top: 0,
              left: 0,
              zIndex: 1,
              opacity: isReady ? 1 : 0
            }}
          />
          
          {cameraActive && isReady && (
            <div className="camera-controls" style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              padding: 'var(--space-6)',
              background: 'linear-gradient(to top, rgba(3, 10, 6, 0.9), transparent)',
              zIndex: 20
            }}>
              <button className="btn-secondary" onClick={handleCancel} style={{
                borderRadius: 'var(--radius-full)',
                width: '50px',
                height: '50px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
                background: 'rgba(0,0,0,0.5)'
              }}>
                ✕
              </button>
              
              {!isLive && (
                <button onClick={captureImage} style={{
                  background: 'var(--green-500)',
                  border: '4px solid rgba(255,255,255,0.8)',
                  backgroundClip: 'padding-box',
                  borderRadius: '50%',
                  width: '72px',
                  height: '72px',
                  cursor: 'pointer',
                  boxShadow: 'var(--glow-green-intense)',
                  transition: 'transform var(--transition-fast)'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                ></button>
              )}

              {isLive && (
                <button 
                  onClick={() => setIsScanning(!isScanning)}
                  style={{ 
                    color: 'white', 
                    fontSize: '1.2rem', 
                    fontWeight: 'bold', 
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                    background: isScanning ? 'var(--red-500)' : 'var(--green-500)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    border: '2px solid rgba(255,255,255,0.8)',
                    cursor: 'pointer'
                  }}>
                  {isScanning ? '⏹️ Stop' : '▶️ Start Live Scan'}
                </button>
              )}

              <div style={{ width: '50px', height: '50px' }}></div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Camera;
