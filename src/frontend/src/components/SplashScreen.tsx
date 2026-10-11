import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fullText = 'developed by Ahmad Farooq';
  const [displayedText, setDisplayedText] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTypingComplete(true);
        // Wait briefly after typing completes so the user sees the credit, then transition
        setTimeout(() => {
          onFinish();
        }, 650);
      }
    }, 55);

    return () => clearInterval(typingInterval);
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#090d16',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      {/* Centered Hospital Logo with Glowing Pulse */}
      <div
        style={{
          width: '84px',
          height: '84px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(13,148,136,0.2) 0%, rgba(15,23,42,0.8) 100%)',
          border: '1px solid rgba(13,148,136,0.4)',
          boxShadow: '0 0 35px rgba(13,148,136,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '2rem',
          animation: 'pulse 2s infinite ease-in-out',
        }}
      >
        <Activity size={44} color="#14b8a6" strokeWidth={2.4} />
      </div>

      {/* Typing Animation Text */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: '28px',
        }}
      >
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '1.15rem',
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: '#cbd5e1',
          }}
        >
          {displayedText}
        </span>
        {/* Blinking Cursor */}
        <span
          style={{
            display: 'inline-block',
            width: '2px',
            height: '1.2rem',
            backgroundColor: '#14b8a6',
            marginLeft: '4px',
            animation: 'blink 0.8s infinite',
            opacity: isTypingComplete ? 0 : 1,
            transition: 'opacity 0.2s',
          }}
        />
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 25px rgba(13,148,136,0.25); }
          50% { transform: scale(1.04); box-shadow: 0 0 40px rgba(13,148,136,0.45); }
        }
      `}</style>
    </div>
  );
};
