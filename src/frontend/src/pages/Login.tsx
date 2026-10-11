import React, { useState } from 'react';
import {
  Activity,
  Lock,
  User,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ApiError } from '../api/client';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setErrorMsg(apiErr.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card-container" style={{ maxWidth: '380px' }}>
        {/* Logo Centered on Top */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(13,148,136,0.05) 100%)',
              border: '1px solid rgba(13,148,136,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={32} color="#0d9488" strokeWidth={2.5} />
          </div>
        </div>

        {/* Error Alert if Authentication Fails */}
        {errorMsg && (
          <div className="login-alert alert-warning" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={18} className="alert-icon" />
            <div className="alert-content">
              <p style={{ margin: 0, fontSize: '0.85rem' }}>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Login Form: Username, Password (with eye toggle), Login Button */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <div className="input-group">
              <span className="input-icon">
                <User size={18} />
              </span>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className="form-input with-icon"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <div className="input-group">
              <span className="input-icon">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="form-input with-icon with-trailing"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="trailing-button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit-btn"
            disabled={isLoading}
            style={{ width: '100%', padding: '0.75rem', fontWeight: 600, fontSize: '0.95rem' }}
          >
            {isLoading ? (
              <span className="btn-loading">
                <span className="spin-dot" /> Logging in...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
