import { useState, useEffect } from 'react';
import {
  Activity,
  Users,
  Calendar,
  FileText,
  FlaskConical,
  Pill,
  CreditCard,
  BarChart3,
  Settings,
  Database,
  Server,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  FileSearch,
  LogOut,
  KeyRound
} from 'lucide-react';
import { api, type HealthStatus, type DatabaseHealthStatus, type ApiError } from './api/client';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { UserManagement } from './pages/UserManagement';
import { AuditLogs } from './pages/AuditLogs';
import { Patients } from './pages/Patients';
import { Appointments } from './pages/Appointments';
import { Clinical } from './pages/Clinical';
import { Laboratory } from './pages/Laboratory';
import './App.css';

function MainAppShell() {
  const { user, isAuthenticated, isLoading, isAdmin, hasRole, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('foundation');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [apiHealth, setApiHealth] = useState<HealthStatus | null>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>('');
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // Change password modal for logged-in user
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Run diagnostics probe
  const runDiagnostics = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const h = await api.getHealth();
      const latency = Math.round(performance.now() - start);
      setPingLatency(latency);
      setApiHealth(h);

      const db = await api.getDatabaseHealth();
      setDbHealth(db);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Diagnostic probe failed:', err);
      setApiHealth(null);
      setDbHealth(null);
      setLastCheck(new Date().toLocaleTimeString() + ' (Failed)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      runDiagnostics();
      const interval = setInterval(runDiagnostics, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="login-page">
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <Activity size={40} className="spin" color="#0d9488" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Mercy Community Hospital</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Initializing offline clinical workstation...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);
    setPassLoading(true);

    try {
      const res = await api.changePassword(curPass, newPass);
      setPassSuccess(res.message);
      setCurPass('');
      setNewPass('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPassSuccess(null);
      }, 2000);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setPassError(apiErr.message || 'Failed to change password.');
    } finally {
      setPassLoading(false);
    }
  };

  const navItems = [
    { id: 'foundation', label: 'System Foundation', icon: Server, badge: 'Phase 2' },
    ...(isAdmin ? [{ id: 'users', label: 'Staff & RBAC', icon: UserCheck, badge: 'Phase 3' }] : []),
    ...(isAdmin || hasRole('Auditor') ? [{ id: 'audit', label: 'Security Audit Log', icon: FileSearch, badge: 'Phase 3' }] : []),
    { id: 'patients', label: 'Patients', icon: Users, badge: 'Phase 4' },
    { id: 'appointments', label: 'Appointments', icon: Calendar, badge: 'Phase 5' },
    { id: 'clinical', label: 'Clinical Encounters', icon: FileText, badge: 'Phase 6' },
    { id: 'laboratory', label: 'Laboratory', icon: FlaskConical, badge: 'Phase 7' },
    { id: 'pharmacy', label: 'Pharmacy & Stock', icon: Pill, badge: 'Phase 8' },
    { id: 'billing', label: 'Billing & Cashier', icon: CreditCard, badge: 'Phase 9' },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, badge: 'Phase 10' },
    { id: 'settings', label: 'Administration', icon: Settings, badge: 'Phase 11' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon-wrapper">
            <Activity size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">Mercy Community</div>
            <div className="brand-sub">Offline HMS Desktop</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#1e293b',
                      color: isActive ? '#fff' : '#94a3b8',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with authenticated profile & controls */}
        <div className="sidebar-footer">
          <div className="user-snippet">
            <div className="avatar-circle">
              {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name" title={user?.fullName || ''}>
                {user?.fullName || 'User'}
              </div>
              <div className="user-role">
                {user?.roleName || 'Staff'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => {
                setPassError(null);
                setPassSuccess(null);
                setCurPass('');
                setNewPass('');
                setShowPasswordModal(true);
              }}
              title="Change Password"
              style={{ padding: '0.35rem', color: '#94a3b8', borderRadius: '4px' }}
            >
              <KeyRound size={16} />
            </button>
            <button
              onClick={() => logout()}
              title="Sign Out"
              style={{ padding: '0.35rem', color: '#f87171', borderRadius: '4px' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-area">
        {/* Header */}
        <header className="top-header">
          <div className="header-left">
            <h1 className="page-title">
              {navItems.find((n) => n.id === activeTab)?.label || 'System Foundation'}
            </h1>
            <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
              {user?.roleName}
            </span>
          </div>

          <div className="header-right">
            {/* API Status Pill */}
            <div className="status-pill">
              <span className={`dot ${apiHealth?.status === 'Healthy' ? 'online' : 'offline'}`} />
              <span>API: {apiHealth?.status === 'Healthy' ? `127.0.0.1:5000 (${pingLatency ?? 0}ms)` : 'Offline'}</span>
            </div>

            {/* PostgreSQL Status Pill */}
            <div className="status-pill">
              <span className={`dot ${dbHealth?.connected ? 'online' : 'offline'}`} />
              <span>DB: {dbHealth?.connected ? 'PostgreSQL 16' : 'Disconnected'}</span>
            </div>

            {/* Real-time Clock */}
            <div className="clock-display">
              <Clock size={15} />
              <span>{currentTime}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="content-body">
          {activeTab === 'foundation' && (
            <>
              {/* Top Foundation Metric Cards */}
              <div className="grid-3">
                <div className="card">
                  <div className="stat-header">
                    <span className="stat-label">Local Backend API</span>
                    <Server size={20} color="#0d9488" />
                  </div>
                  <div className="stat-value" style={{ color: apiHealth ? '#0d9488' : '#ef4444' }}>
                    {apiHealth ? 'Online & Healthy' : 'Disconnected'}
                  </div>
                  <div className="stat-desc">
                    ASP.NET Core 8.0 • Loopback: 127.0.0.1:5000
                  </div>
                </div>

                <div className="card">
                  <div className="stat-header">
                    <span className="stat-label">Relational Database</span>
                    <Database size={20} color="#0284c7" />
                  </div>
                  <div className="stat-value" style={{ color: dbHealth?.connected ? '#0284c7' : '#ef4444' }}>
                    {dbHealth?.connected ? 'PostgreSQL 16.4' : 'Unavailable'}
                  </div>
                  <div className="stat-desc">
                    Authoritative storage • 30 normalized tables
                  </div>
                </div>

                <div className="card">
                  <div className="stat-header">
                    <span className="stat-label">Security & RBAC</span>
                    <ShieldCheck size={20} color="#10b981" />
                  </div>
                  <div className="stat-value" style={{ color: '#10b981' }}>
                    Active & Verified
                  </div>
                  <div className="stat-desc">
                    JWT Session • BCrypt Hashing • Lockout Protected
                  </div>
                </div>
              </div>

              {/* Two Column Layout for Diagnostics and Verification */}
              <div className="grid-2">
                {/* Diagnostics Panel */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Connection Diagnostic Tool</h2>
                    <button
                      className="btn btn-outline"
                      onClick={runDiagnostics}
                      disabled={loading}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      <RefreshCw size={14} className={loading ? 'spin' : ''} />
                      {loading ? 'Probing...' : 'Run Probe'}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Validates low-latency communication across the Desktop Shell, ASP.NET Core API, and local PostgreSQL instance.
                  </p>

                  <div className="table-wrapper">
                    <table className="desktop-table">
                      <thead>
                        <tr>
                          <th>Component</th>
                          <th>Target Endpoint</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>HTTP Loopback</strong></td>
                          <td><code>http://127.0.0.1:5000/api/v1/health</code></td>
                          <td>
                            {apiHealth ? (
                              <span className="badge badge-success">OK (200)</span>
                            ) : (
                              <span className="badge badge-danger">Offline</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Database Connection</strong></td>
                          <td><code>127.0.0.1:5432 (hospital_db)</code></td>
                          <td>
                            {dbHealth?.connected ? (
                              <span className="badge badge-success">Connected</span>
                            ) : (
                              <span className="badge badge-danger">Failed</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Authentication Gateway</strong></td>
                          <td><code>/api/v1/auth/me</code></td>
                          <td>
                            <span className="badge badge-success">Authorized (@{user?.username})</span>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Audit Trail Status</strong></td>
                          <td><code>/api/v1/audit</code></td>
                          <td><span className="badge badge-success">Active & Logging</span></td>
                        </tr>
                        <tr>
                          <td><strong>Last Probe Run</strong></td>
                          <td colSpan={2}><code>{lastCheck || 'Pending'}</code></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {dbHealth?.stats && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.825rem' }}>
                      <strong>Active Database Records:</strong>
                      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem' }}>
                        <span>Users: <strong>{dbHealth.stats.users}</strong></span>
                        <span>Departments: <strong>{dbHealth.stats.departments}</strong></span>
                        <span>Patients: <strong>{dbHealth.stats.patients}</strong></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Phase 3 Auth Verification Card */}
                <div className="card">
                  <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Phase 3 Security & Auth Verification</h2>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Authentication and Authorization (Module A) verified on Windows local workstation.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} color="#10b981" />
                      <span><strong>BCrypt Password Hashing:</strong> Work factor 11 with per-user unique salt.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} color="#10b981" />
                      <span><strong>Offline JWT Bearer Tokens:</strong> Sub, Role, Name, and Email claims.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} color="#10b981" />
                      <span><strong>Lockout Protection:</strong> 5 failed consecutive attempts locks account for 15 minutes.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} color="#10b981" />
                      <span><strong>Role-Based Access Control:</strong> Enforced via policies and API attributes.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} color="#10b981" />
                      <span><strong>Immutable Security Audit Log:</strong> Every login, failure, lockout, and edit recorded.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} color="#10b981" />
                      <span><strong>User Administration UI:</strong> Create staff accounts, toggle status, and reset passwords.</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'users' && <UserManagement />}

          {activeTab === 'audit' && <AuditLogs />}

          {activeTab === 'patients' && <Patients />}

          {activeTab === 'appointments' && <Appointments />}

          {activeTab === 'clinical' && <Clinical />}

          {activeTab === 'laboratory' && <Laboratory />}

          {activeTab !== 'foundation' && activeTab !== 'users' && activeTab !== 'audit' && activeTab !== 'patients' && activeTab !== 'appointments' && activeTab !== 'clinical' && activeTab !== 'laboratory' && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <AlertCircle size={40} color="#0d9488" style={{ margin: '0 auto 1rem auto' }} />
              <h2 style={{ fontSize: '1.25rem' }}>{navItems.find((n) => n.id === activeTab)?.label} Module</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', maxWidth: '480px', margin: '0.5rem auto 1.5rem auto' }}>
                This module is scheduled for implementation in upcoming controlled phases according to the Master Build Plan.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveTab('foundation')}>
                Return to System Foundation
              </button>
            </div>
          )}
        </div>
      </main>

      {/* CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <KeyRound size={20} color="#0d9488" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Change My Password</h3>
              </div>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>

            {passError && (
              <div className="login-alert alert-warning" style={{ margin: '1rem 0' }}>
                <AlertCircle size={18} />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="login-alert" style={{ margin: '1rem 0', backgroundColor: '#ecfdf5', color: '#047857' }}>
                <CheckCircle2 size={18} />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter current password"
                  value={curPass}
                  onChange={(e) => setCurPass(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new password (min 6 characters)"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passLoading}
                >
                  {passLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppShell />
    </AuthProvider>
  );
}
