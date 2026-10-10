import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { api, type AuditEventDto } from '../api/client';

export const AuditLogs: React.FC = () => {
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [actorSearch, setActorSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditEvents({
        action: actionFilter.trim() || undefined,
        actorUsername: actorSearch.trim() || undefined,
        pageSize: 100,
      });
      setEvents(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getActionBadge = (action: string) => {
    if (action.includes('Success')) {
      return { bg: '#ecfdf5', color: '#047857', icon: CheckCircle2 };
    }
    if (action.includes('Failed') || action.includes('Deactivated')) {
      return { bg: '#fef2f2', color: '#b91c1c', icon: AlertTriangle };
    }
    if (action.includes('Locked')) {
      return { bg: '#fff7ed', color: '#c2410c', icon: Lock };
    }
    if (action.includes('User.')) {
      return { bg: '#e0f2fe', color: '#0369a1', icon: User };
    }
    return { bg: '#f1f5f9', color: '#334155', icon: ShieldCheck };
  };

  return (
    <div className="audit-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>System Security Audit Trail</h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Authoritative, append-only security logs tracking logins, authorization failures, and administrative actions ({total} events logged).
          </p>
        </div>

        <button
          className="btn btn-outline"
          onClick={fetchLogs}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Audit Stream</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="filter-card">
        <form onSubmit={handleSearchSubmit} className="search-row">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by actor username (e.g. admin or dr.smith)..."
              className="form-input search-input"
              value={actorSearch}
              onChange={(e) => setActorSearch(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Action Type:</label>
            <select
              className="form-input select-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Security Events</option>
              <option value="Auth.LoginSuccess">Login Success</option>
              <option value="Auth.LoginFailed">Login Failed</option>
              <option value="Auth.AccountLocked">Account Locked</option>
              <option value="User.Created">User Created</option>
              <option value="User.Updated">User Updated</option>
              <option value="User.PasswordReset">Password Reset</option>
            </select>
          </div>

          <button type="submit" className="btn btn-outline" disabled={loading}>
            Apply Filters
          </button>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="table-wrapper card" style={{ marginTop: '1rem', padding: 0 }}>
        <table className="desktop-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action Category</th>
              <th>Actor</th>
              <th>Target Entity</th>
              <th>Event Details</th>
              <th>Workstation IP</th>
            </tr>
          </thead>
          <tbody>
            {loading && events.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading immutable audit log...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No audit events recorded under this filter.
                </td>
              </tr>
            ) : (
              events.map((evt) => {
                const badge = getActionBadge(evt.action);
                const Icon = badge.icon;
                return (
                  <tr key={evt.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.825rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={13} color="var(--text-muted)" />
                        <code>{new Date(evt.timestamp).toLocaleString()}</code>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: badge.bg,
                          color: badge.color,
                        }}
                      >
                        <Icon size={12} />
                        {evt.action}
                      </span>
                    </td>
                    <td>
                      <strong>@{evt.actorUsername || 'System'}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {evt.entityName}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>{evt.details || '—'}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{evt.ipAddress}</code>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
