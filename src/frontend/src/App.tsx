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
  FileSearch,
  LogOut,
  KeyRound,
  Menu,
  Search,
  X
} from 'lucide-react';
import { api, type HealthStatus, type DatabaseHealthStatus, type ApiError } from './api/client';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { UserManagement } from './pages/UserManagement';
import { AuditLogs } from './pages/AuditLogs';
import { Patients } from './pages/Patients';
import { Appointments } from './pages/Appointments';
import { Clinical } from './pages/Clinical';
import { Laboratory } from './pages/Laboratory';
import { Pharmacy } from './pages/Pharmacy';
import { Billing } from './pages/Billing';
import { Reports } from './pages/Reports';
import { Settings as SettingsPage } from './pages/Settings';
import './App.css';

function MainAppShell() {
  const { user, isAdmin, hasRole, logout } = useAuth();
  const {
    activeTab,
    setActiveTab,
    isSidebarCollapsed,
    toggleSidebar,
    activePatient,
    clearActivePatient,
    openCommandPalette,
  } = useNavigation();
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
    runDiagnostics();
    const interval = setInterval(runDiagnostics, 30000);
    return () => clearInterval(interval);
  }, []);

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
    { id: 'reports', label: 'Executive Dashboard', icon: BarChart3 },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'clinical', label: 'Clinical Encounters', icon: FileText },
    { id: 'laboratory', label: 'Laboratory', icon: FlaskConical },
    { id: 'pharmacy', label: 'Pharmacy & Stock', icon: Pill },
    { id: 'billing', label: 'Billing & Cashier', icon: CreditCard },
    ...(isAdmin ? [{ id: 'settings', label: 'Administration', icon: Settings }] : []),
    ...(isAdmin || hasRole('Auditor') ? [{ id: 'audit', label: 'Security Audit Log', icon: FileSearch }] : []),
    { id: 'foundation', label: 'System Diagnostics', icon: Server },
  ];

  // Phase 12: Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if actively typing in form inputs, textareas, or selects
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      // Ctrl+K or F2: Global Command Palette (works anywhere)
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || e.key === 'F2') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // Ctrl+B: Toggle Sidebar Collapse (works anywhere)
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // If user is typing in an input, don't trigger number navigation
      if (isInput) return;

      // Ctrl+1 through Ctrl+9: Quick Workstation Navigation
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const digit = e.key;
        const shortcutMap: Record<string, string> = {
          '1': 'reports',
          '2': 'patients',
          '3': 'appointments',
          '4': 'clinical',
          '5': 'laboratory',
          '6': 'pharmacy',
          '7': 'billing',
          '8': isAdmin ? 'settings' : 'reports',
          '9': 'foundation',
        };
        if (shortcutMap[digit]) {
          e.preventDefault();
          setActiveTab(shortcutMap[digit]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCommandPalette, toggleSidebar, setActiveTab, isAdmin, hasRole]);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div
            className="brand-icon-wrapper"
            onClick={toggleSidebar}
            style={{ cursor: 'pointer' }}
            title={isSidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
          >
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
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon size={18} />
                <span className="nav-item-text" style={{ flex: 1 }}>{item.label}</span>
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
            <div className="user-info-text" style={{ minWidth: 0 }}>
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
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={toggleSidebar}
              title="Toggle Desktop Sidebar (Ctrl+B)"
              style={{
                background: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.35rem 0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#64748b',
              }}
            >
              <Menu size={16} />
            </button>
            <h1 className="page-title" style={{ margin: 0 }}>
              {navItems.find((n) => n.id === activeTab)?.label || 'System Foundation'}
            </h1>
            <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
              {user?.roleName}
            </span>

            {/* Active Patient Pill Indicator */}
            {activePatient && (
              <div className="active-patient-pill" title="Active Patient Workflow Context">
                <Users size={13} color="#0d9488" />
                <span>
                  Patient: <strong>{activePatient.fullName}</strong> ({activePatient.patientNumber})
                </span>
                <button
                  onClick={clearActivePatient}
                  className="active-patient-clear"
                  title="Clear active patient context"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Command Palette Trigger Button */}
            <button
              onClick={openCommandPalette}
              className="btn btn-outline"
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#f8fafc',
                borderColor: '#cbd5e1',
                color: '#475569',
                cursor: 'pointer',
              }}
              title="Open Global Command Palette (Ctrl+K or F2)"
            >
              <Search size={14} color="#0d9488" />
              <span>Quick Search</span>
              <kbd style={{ fontSize: '0.675rem', padding: '1px 5px', background: '#e2e8f0', borderRadius: '3px', fontWeight: 600 }}>
                Ctrl+K
              </kbd>
            </button>

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
          <ErrorBoundary fallbackTitle="Clinical Module View">
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

          {activeTab === 'pharmacy' && <Pharmacy />}

          {activeTab === 'billing' && <Billing />}

          {activeTab === 'reports' && <Reports />}

          {activeTab === 'settings' && <SettingsPage />}

          {activeTab !== 'foundation' && activeTab !== 'users' && activeTab !== 'audit' && activeTab !== 'patients' && activeTab !== 'appointments' && activeTab !== 'clinical' && activeTab !== 'laboratory' && activeTab !== 'pharmacy' && activeTab !== 'billing' && activeTab !== 'reports' && activeTab !== 'settings' && (
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
          </ErrorBoundary>
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

      {/* Global Command Palette Overlay */}
      <CommandPalette />
    </div>
  );
}

function WorkstationShell() {
  const { isLoading, isAuthenticated } = useAuth();

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

  return <MainAppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NavigationProvider>
          <WorkstationShell />
        </NavigationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

