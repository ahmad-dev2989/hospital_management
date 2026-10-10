import React, { useState } from 'react';
import {
  Activity,
  Lock,
  User,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  Stethoscope,
  HeartPulse,
  Receipt,
  FlaskConical,
  Pill,
  UserCheck,
  FileSearch
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ApiError } from '../api/client';

interface PresetUser {
  roleName: string;
  username: string;
  password: string;
  title: string;
  icon: any;
  badgeClass: string;
}

const PRESET_USERS: PresetUser[] = [
  { roleName: 'System Admin', username: 'admin', password: 'Admin@123', title: 'Full System Control & Audit', icon: ShieldCheck, badgeClass: 'role-admin' },
  { roleName: 'Doctor', username: 'dr.smith', password: 'Doctor@123', title: 'Consultations, SOAP Notes, Orders', icon: Stethoscope, badgeClass: 'role-doctor' },
  { roleName: 'Nurse', username: 'nurse.jane', password: 'Nurse@123', title: 'Triage, Vitals Recording, Care', icon: HeartPulse, badgeClass: 'role-nurse' },
  { roleName: 'Reception', username: 'reception', password: 'Reception@123', title: 'Patient Registration & Booking', icon: UserCheck, badgeClass: 'role-reception' },
  { roleName: 'Lab Tech', username: 'labtech', password: 'Lab@123', title: 'Specimens, Barcodes & Results', icon: FlaskConical, badgeClass: 'role-lab' },
  { roleName: 'Pharmacist', username: 'pharmacist', password: 'Pharmacy@123', title: 'FEFO Dispensing & Formularies', icon: Pill, badgeClass: 'role-pharmacy' },
  { roleName: 'Cashier', username: 'cashier', password: 'Cashier@123', title: 'Invoicing, Payments & Receipts', icon: Receipt, badgeClass: 'role-cashier' },
  { roleName: 'Auditor', username: 'auditor', password: 'Auditor@123', title: 'Immutable Security & Logs', icon: FileSearch, badgeClass: 'role-auditor' },
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both your clinical username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setErrorCode(apiErr.code || 'AUTH_ERROR');
      setErrorMsg(apiErr.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreset = (preset: PresetUser) => {
    setUsername(preset.username);
    setPassword(preset.password);
    setErrorMsg(null);
    setErrorCode(null);
  };

  return (
    <div className="login-page">
      <div className="login-card-container">
        {/* Hospital Branding Header */}
        <div className="login-header">
          <div className="login-brand-icon">
            <Activity size={32} color="#0d9488" strokeWidth={2.5} />
          </div>
          <h1 className="login-title">Mercy Community Hospital</h1>
          <p className="login-subtitle">Offline Clinical Workstation • Secure Access</p>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className={`login-alert ${errorCode === 'ACCOUNT_LOCKED' ? 'alert-danger' : 'alert-warning'}`}>
            <AlertTriangle size={20} className="alert-icon" />
            <div className="alert-content">
              <strong>{errorCode === 'ACCOUNT_LOCKED' ? 'Account Locked' : 'Authentication Error'}</strong>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Staff Username
            </label>
            <div className="input-group">
              <span className="input-icon">
                <User size={18} />
              </span>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className="form-input with-icon"
                placeholder="e.g. dr.smith or admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div className="input-group">
              <span className="input-icon">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="form-input with-icon with-trailing"
                placeholder="Enter password"
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
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="btn-loading">
                <span className="spin-dot" /> Authenticating...
              </span>
            ) : (
              'Sign In to Workstation'
            )}
          </button>
        </form>

        {/* Quick Clinical Role Switcher for Offline Deployment */}
        <div className="preset-selector-section">
          <div className="preset-divider">
            <span>Workstation Quick Switch (Offline Roles)</span>
          </div>

          <div className="preset-grid">
            {PRESET_USERS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = username === preset.username;
              return (
                <button
                  key={preset.username}
                  type="button"
                  className={`preset-btn ${isSelected ? 'preset-active' : ''}`}
                  onClick={() => handleApplyPreset(preset)}
                  title={`${preset.title} (${preset.username} / ${preset.password})`}
                >
                  <Icon size={16} />
                  <div className="preset-info">
                    <span className="preset-name">{preset.roleName}</span>
                    <span className="preset-user">@{preset.username}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Offline Security Footer */}
        <div className="login-footer">
          <div className="footer-status">
            <span className="status-dot-active" />
            <span>Air-Gapped Local Operation • 127.0.0.1:5000</span>
          </div>
          <div className="footer-copyright">
            Role-Based Access Control • BCrypt Hashing • 15m Lockout Security
          </div>
        </div>
      </div>
    </div>
  );
};
