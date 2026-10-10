import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
  Key,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  UserCheck,
  UserX
} from 'lucide-react';
import { api, type UserDto, type CreateUserRequest, type ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: 0, label: 'System Administrator' },
  { value: 1, label: 'Hospital Administrator' },
  { value: 2, label: 'Receptionist' },
  { value: 3, label: 'Doctor' },
  { value: 4, label: 'Nurse' },
  { value: 5, label: 'Lab Technician' },
  { value: 6, label: 'Pharmacist' },
  { value: 7, label: 'Cashier' },
  { value: 8, label: 'Auditor' },
];

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 3, // Default: Doctor
  });
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers({
        search: search.trim() || undefined,
        role: roleFilter !== 'all' ? parseInt(roleFilter) : undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        pageSize: 100,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      await api.createUser(createForm);
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        fullName: '',
        email: '',
        password: '',
        role: 3,
      });
      setToastMessage(`Staff account @${createForm.username} created successfully.`);
      fetchUsers();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setModalError(apiErr.message || 'Failed to create user account.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setModalError(null);
    setModalLoading(true);

    try {
      await api.resetPassword(selectedUser.id, resetPasswordValue);
      setShowResetModal(false);
      setResetPasswordValue('');
      setToastMessage(`Password for @${selectedUser.username} has been reset.`);
      fetchUsers();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setModalError(apiErr.message || 'Failed to reset user password.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleActive = async (targetUser: UserDto) => {
    if (currentUser?.id === targetUser.id) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }

    const actionText = targetUser.isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${actionText} staff user @${targetUser.username}?`)) {
      return;
    }

    try {
      const res = await api.toggleUserActive(targetUser.id);
      setToastMessage(res.message);
      fetchUsers();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(`Error: ${apiErr.message}`);
    }
  };

  const getRoleBadgeStyle = (roleName: string) => {
    switch (roleName) {
      case 'SystemAdministrator':
      case 'HospitalAdministrator':
        return { bg: '#ede9fe', color: '#6d28d9', label: 'Admin' };
      case 'Doctor':
        return { bg: '#e0f2fe', color: '#0369a1', label: 'Doctor' };
      case 'Nurse':
        return { bg: '#fce7f3', color: '#be185d', label: 'Nurse' };
      case 'Receptionist':
        return { bg: '#fef3c7', color: '#b45309', label: 'Reception' };
      case 'LabTechnician':
        return { bg: '#ecfdf5', color: '#047857', label: 'Lab Tech' };
      case 'Pharmacist':
        return { bg: '#f0fdf4', color: '#15803d', label: 'Pharmacy' };
      case 'Cashier':
        return { bg: '#fff7ed', color: '#c2410c', label: 'Cashier' };
      case 'Auditor':
        return { bg: '#f1f5f9', color: '#334155', label: 'Auditor' };
      default:
        return { bg: '#f1f5f9', color: '#475569', label: roleName };
    }
  };

  return (
    <div className="users-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-banner">
          <CheckCircle size={18} color="#10b981" />
          <span>{toastMessage}</span>
          <button className="toast-close" onClick={() => setToastMessage(null)}>×</button>
        </div>
      )}

      {/* Action Header */}
      <div className="page-header-row">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Staff & RBAC Administration</h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Manage local hospital operator credentials, assigned roles, and access controls ({total} registered staff).
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setModalError(null);
            setShowCreateModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <UserPlus size={16} />
          <span>Create New Staff Account</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-card">
        <form onSubmit={handleSearchSubmit} className="search-row">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by username, full name, or email..."
              className="form-input search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Role:</label>
            <select
              className="form-input select-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Status:</label>
            <select
              className="form-input select-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Deactivated Only</option>
            </select>
          </div>

          <button type="submit" className="btn btn-outline" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Filter
          </button>
        </form>
      </div>

      {/* Staff Accounts Table */}
      <div className="table-wrapper card" style={{ marginTop: '1rem', padding: 0 }}>
        <table className="desktop-table">
          <thead>
            <tr>
              <th>Operator</th>
              <th>Username</th>
              <th>Contact Email</th>
              <th>Clinical Role</th>
              <th>Status</th>
              <th>Last Sign In</th>
              <th style={{ textAlign: 'right' }}>Security Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading staff accounts...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No staff accounts matched the filter criteria.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const roleBadge = getRoleBadgeStyle(u.roleName);
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className={!u.isActive ? 'row-deactivated' : ''}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          className="avatar-circle"
                          style={{
                            width: '32px',
                            height: '32px',
                            fontSize: '0.8rem',
                            backgroundColor: roleBadge.bg,
                            color: roleBadge.color,
                          }}
                        >
                          {u.fullName ? u.fullName.slice(0, 2).toUpperCase() : u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong>{u.fullName}</strong>
                          {isSelf && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#0d9488', fontWeight: 600 }}>
                              (You)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.85rem' }}>@{u.username}</code>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: roleBadge.bg,
                          color: roleBadge.color,
                        }}
                      >
                        {roleBadge.label}
                      </span>
                    </td>
                    <td>
                      {u.isActive ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Deactivated</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setSelectedUser(u);
                            setResetPasswordValue('');
                            setModalError(null);
                            setShowResetModal(true);
                          }}
                          title="Reset Password"
                        >
                          <Key size={14} />
                          <span>Reset Key</span>
                        </button>

                        <button
                          className={`btn btn-sm ${u.isActive ? 'btn-danger-outline' : 'btn-success-outline'}`}
                          onClick={() => handleToggleActive(u)}
                          disabled={isSelf}
                          title={u.isActive ? 'Deactivate staff account' : 'Reactivate account'}
                        >
                          {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content card">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserPlus size={20} color="#0d9488" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Create Staff Account</h3>
              </div>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            {modalError && (
              <div className="login-alert alert-warning" style={{ margin: '1rem 0' }}>
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dr. Jennifer Adams, MD"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. dr.adams"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. adams@hospital.local"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Clinical / Admin Role</label>
                  <select
                    className="form-input"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: parseInt(e.target.value) })}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Min 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Creating Operator...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && selectedUser && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Key size={20} color="#0d9488" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Reset Password</h3>
              </div>
              <button className="modal-close" onClick={() => setShowResetModal(false)}>×</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Reset administrative password for <strong>{selectedUser.fullName}</strong> (<code>@{selectedUser.username}</code>). Any active lockout will also be cleared.
            </p>

            {modalError && (
              <div className="login-alert alert-warning" style={{ margin: '1rem 0' }}>
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new password (min 6 chars)"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowResetModal(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Updating Key...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
