import React, { useState, useRef, useCallback, useEffect } from 'react';

const Camera = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // Default to back camera
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState('');

  const startCamera = useCallback(async () => {
    setError('');
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access the camera. Please allow permissions.');
      setCameraActive(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Compress image
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          
          // Stop camera stream after capture
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setCameraActive(false);
          }
          onCapture(file);
        }
      }, 'image/jpeg', 0.8); // 80% quality
    }
  };

  const handleCancel = () => {
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
      margin: '0 auto', 
      borderRadius: 'var(--radius-2xl)', 
      overflow: 'hidden', 
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-glow)',
      boxShadow: 'var(--glow-green-intense)'
    }}>
      {error ? (
        <div style={{ padding: 'var(--space-8)', color: 'var(--red-400)', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⚠️</div>
          <p style={{ fontSize: 'var(--fs-lg)' }}>{error}</p>
          <button className="btn btn-primary" onClick={onCancel} style={{ marginTop: 'var(--space-6)' }}>Go Back</button>
        </div>
      ) : (
        <>
          {/* Overlay elements */}
          {cameraActive && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 10,
              border: '2px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: 'inset 0 0 40px rgba(16, 185, 129, 0.2)'
            }}>
              {/* Corner brackets for scanner effect */}
              <div style={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderTop: '4px solid var(--green-400)', borderLeft: '4px solid var(--green-400)' }}></div>
              <div style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderTop: '4px solid var(--green-400)', borderRight: '4px solid var(--green-400)' }}></div>
              <div style={{ position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, borderBottom: '4px solid var(--cyan-400)', borderLeft: '4px solid var(--cyan-400)' }}></div>
              <div style={{ position: 'absolute', bottom: 20, right: 20, width: 40, height: 40, borderBottom: '4px solid var(--cyan-400)', borderRight: '4px solid var(--cyan-400)' }}></div>
              
              {/* Scanline animation placeholder */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, transparent, var(--green-400), transparent)',
                boxShadow: '0 0 10px var(--green-400)',
                opacity: 0.6,
                transform: 'translateY(-50%)' // would normally animate up and down
              }}></div>
            </div>
          )}

          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            style={{ 
              width: '100%', 
              height: 'auto', 
              display: cameraActive ? 'block' : 'none',
              objectFit: 'cover',
              aspectRatio: '4/3',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' 
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          
          {cameraActive && (
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

              <button className="btn-secondary" onClick={toggleCamera} style={{
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
                🔄
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Camera;
