import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  FlaskConical,
  Pill,
  Clock,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Activity,
  Users,
  Building2,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import {
  api,
  type OperationalDashboardDto,
  type FinancialReportDto,
  type LaboratoryReportDto,
  type PharmacyValuationReportDto,
  type ApiError
} from '../api/client';

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'financial' | 'laboratory' | 'pharmacy'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Date filters for financial and lab reports
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [financialFromDate, setFinancialFromDate] = useState<string>(thirtyDaysAgoStr);
  const [financialToDate, setFinancialToDate] = useState<string>(todayStr);

  const [labFromDate, setLabFromDate] = useState<string>(thirtyDaysAgoStr);
  const [labToDate, setLabToDate] = useState<string>(todayStr);

  // Data states
  const [dashboardData, setDashboardData] = useState<OperationalDashboardDto | null>(null);
  const [financialData, setFinancialData] = useState<FinancialReportDto | null>(null);
  const [labData, setLabData] = useState<LaboratoryReportDto | null>(null);
  const [pharmacyData, setPharmacyData] = useState<PharmacyValuationReportDto | null>(null);

  // Export states
  const [exportingCsv, setExportingCsv] = useState(false);

  // Fetch functions
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOperationalDashboard();
      setDashboardData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load executive operational dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialReport = async (from = financialFromDate, to = financialToDate) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getFinancialReport({
        fromDate: from ? `${from}T00:00:00Z` : undefined,
        toDate: to ? `${to}T23:59:59Z` : undefined
      });
      setFinancialData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load financial reconciliation report.');
    } finally {
      setLoading(false);
    }
  };

  const loadLaboratoryReport = async (from = labFromDate, to = labToDate) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLaboratoryReport({
        fromDate: from ? `${from}T00:00:00Z` : undefined,
        toDate: to ? `${to}T23:59:59Z` : undefined
      });
      setLabData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load laboratory workload and TAT report.');
    } finally {
      setLoading(false);
    }
  };

  const loadPharmacyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPharmacyValuationReport();
      setPharmacyData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load pharmacy valuation and expiry schedule.');
    } finally {
      setLoading(false);
    }
  };

  // Initial tab fetch
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'financial') {
      loadFinancialReport();
    } else if (activeTab === 'laboratory') {
      loadLaboratoryReport();
    } else if (activeTab === 'pharmacy') {
      loadPharmacyReport();
    }
  }, [activeTab]);

  // CSV Exporters
  const handleExportFinancialCsv = async () => {
    setExportingCsv(true);
    try {
      await api.exportFinancialCsv({
        fromDate: financialFromDate ? `${financialFromDate}T00:00:00Z` : undefined,
        toDate: financialToDate ? `${financialToDate}T23:59:59Z` : undefined
      });
    } catch (err: any) {
      alert('Failed to export financial CSV: ' + (err.message || 'Unknown error'));
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportLabCsv = async () => {
    setExportingCsv(true);
    try {
      await api.exportLaboratoryCsv({
        fromDate: labFromDate ? `${labFromDate}T00:00:00Z` : undefined,
        toDate: labToDate ? `${labToDate}T23:59:59Z` : undefined
      });
    } catch (err: any) {
      alert('Failed to export laboratory CSV: ' + (err.message || 'Unknown error'));
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPharmacyCsv = async () => {
    setExportingCsv(true);
    try {
      await api.exportPharmacyValuationCsv();
    } catch (err: any) {
      alert('Failed to export pharmacy CSV: ' + (err.message || 'Unknown error'));
    } finally {
      setExportingCsv(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Preset date helpers
  const applyFinancialPreset = (days: number) => {
    const end = todayStr;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFinancialFromDate(start);
    setFinancialToDate(end);
    loadFinancialReport(start, end);
  };

  const applyLabPreset = (days: number) => {
    const end = todayStr;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setLabFromDate(start);
    setLabToDate(end);
    loadLaboratoryReport(start, end);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-container" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#0d9488',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BarChart3 size={20} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Reports & Executive Analytics
            </h1>
            <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              Live Analytics
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-time operational dashboard, financial collections, laboratory turnaround, and pharmacy valuation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={13} /> Updated: {lastRefreshed}
            </span>
          )}

          <button
            className="btn btn-outline"
            onClick={() => {
              if (activeTab === 'dashboard') loadDashboard();
              else if (activeTab === 'financial') loadFinancialReport();
              else if (activeTab === 'laboratory') loadLaboratoryReport();
              else if (activeTab === 'pharmacy') loadPharmacyReport();
            }}
            disabled={loading}
            style={{ fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            className="btn btn-outline"
            onClick={handlePrint}
            style={{ fontSize: '0.85rem' }}
          >
            <Printer size={14} />
            Print Report
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid var(--border)',
        gap: '0.5rem',
        background: 'var(--bg-surface)',
        borderRadius: '8px 8px 0 0',
        padding: '0.5rem 0.5rem 0 0.5rem'
      }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'dashboard' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'dashboard' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'dashboard' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Activity size={16} />
          Executive Dashboard
        </button>

        <button
          onClick={() => setActiveTab('financial')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'financial' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'financial' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'financial' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <DollarSign size={16} />
          Financial & Revenue Reconciliation
        </button>

        <button
          onClick={() => setActiveTab('laboratory')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'laboratory' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'laboratory' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'laboratory' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <FlaskConical size={16} />
          Laboratory Workload & TAT
        </button>

        <button
          onClick={() => setActiveTab('pharmacy')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'pharmacy' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'pharmacy' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'pharmacy' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Pill size={16} />
          Pharmacy Stock Valuation & Aging
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#b91c1c',
          fontSize: '0.85rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton Card for Dashboard */}
      {loading && !dashboardData && activeTab === 'dashboard' && (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <Activity size={36} className="spin" color="#0d9488" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Executive Operational Dashboard...</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Aggregating census, appointment flow, departmental workloads, and inventory alerts.
          </p>
        </div>
      )}

      {/* TAB 1: EXECUTIVE OPERATIONAL DASHBOARD */}
      {activeTab === 'dashboard' && dashboardData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Key Clinical & Patient KPIs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL REGISTERED PATIENTS</span>
                <Users size={18} color="#0d9488" />
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {(dashboardData.totalPatientsCount ?? 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ArrowUpRight size={13} /> +{dashboardData.newPatientsTodayCount ?? 0} registered today
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TODAY'S ENCOUNTERS</span>
                <Activity size={18} color="#3b82f6" />
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {dashboardData.totalEncountersTodayCount ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={13} /> {dashboardData.activeEncountersCount ?? 0} currently in-progress
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>APPOINTMENTS TODAY</span>
                <Calendar size={18} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {dashboardData.appointmentsTodayTotal ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {dashboardData.appointmentsCompletedCount ?? 0} completed · {dashboardData.appointmentsWaitingCount ?? 0} waiting
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>CLINICAL BOTTLENECKS</span>
                <ShieldAlert size={18} color="#ef4444" />
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 700, color: (dashboardData.criticalLabResultsCount ?? 0) > 0 ? '#ef4444' : 'var(--text-main)' }}>
                {(dashboardData.criticalLabResultsCount ?? 0) + (dashboardData.lowStockDrugsCount ?? 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                {dashboardData.criticalLabResultsCount ?? 0} critical lab alerts · {dashboardData.lowStockDrugsCount ?? 0} low stock drugs
              </div>
            </div>
          </div>

          {/* Appointment Queue Flow Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  Today's Patient Flow & Appointment Queue
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Real-time status breakdown of registered clinic appointments scheduled for today.
                </p>
              </div>
              <span className="badge badge-info">{dashboardData.appointmentsTodayTotal ?? 0} Total Scheduled</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              marginTop: '0.5rem'
            }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Waiting in Lobby
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.25rem' }}>
                  {dashboardData.appointmentsWaitingCount ?? 0}
                </div>
                <span className="badge badge-warning" style={{ marginTop: '0.35rem', fontSize: '0.7rem' }}>Arrived</span>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  In Consultation
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#3b82f6', marginTop: '0.25rem' }}>
                  {dashboardData.appointmentsInConsultationCount ?? 0}
                </div>
                <span className="badge badge-info" style={{ marginTop: '0.35rem', fontSize: '0.7rem' }}>With Doctor</span>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Completed
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem' }}>
                  {dashboardData.appointmentsCompletedCount ?? 0}
                </div>
                <span className="badge badge-success" style={{ marginTop: '0.35rem', fontSize: '0.7rem' }}>Discharged</span>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  No-Show / Missed
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>
                  {dashboardData.appointmentsNoShowCount ?? 0}
                </div>
                <span className="badge" style={{ marginTop: '0.35rem', fontSize: '0.7rem', background: '#e2e8f0', color: '#475569' }}>Absent</span>
              </div>
            </div>
          </div>

          {/* Department Workloads & Operational Alerts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            
            {/* Department Workload Table */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={18} color="#0d9488" />
                    Clinical Department Workloads
                  </h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Active medical staff count and today's clinical volume per specialty.
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="desktop-table">
                  <thead>
                    <tr>
                      <th>Department Name</th>
                      <th style={{ textAlign: 'center' }}>Active Doctors</th>
                      <th style={{ textAlign: 'center' }}>Appointments Today</th>
                      <th style={{ textAlign: 'center' }}>Encounters Today</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboardData.departmentWorkloads ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                          No clinical departments active.
                        </td>
                      </tr>
                    ) : (
                      (dashboardData.departmentWorkloads ?? []).map((dept) => (
                        <tr key={dept.departmentId}>
                          <td><strong>{dept.departmentName}</strong></td>
                          <td style={{ textAlign: 'center' }}>{dept.activeDoctorsCount}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-info">{dept.todayAppointmentsCount}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-success">{dept.todayEncountersCount}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {dept.todayAppointmentsCount > 5 ? (
                              <span className="badge badge-warning">High Load</span>
                            ) : dept.todayAppointmentsCount > 0 ? (
                              <span className="badge badge-success">Active</span>
                            ) : (
                              <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Normal</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Real-time Operational Alerts */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} color="#f59e0b" />
                Operational Attention Queue
              </h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                System-monitored queues requiring staff intervention.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '6px',
                  backgroundColor: (dashboardData.criticalLabResultsCount ?? 0) > 0 ? '#fef2f2' : '#f8fafc',
                  border: (dashboardData.criticalLabResultsCount ?? 0) > 0 ? '1px solid #fecaca' : '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <AlertTriangle size={18} color={(dashboardData.criticalLabResultsCount ?? 0) > 0 ? '#ef4444' : '#64748b'} />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: (dashboardData.criticalLabResultsCount ?? 0) > 0 ? '#991b1b' : 'var(--text-main)' }}>
                        Abnormal / Critical Lab Results
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Flagged tests requiring physician sign-off
                      </div>
                    </div>
                  </div>
                  <span className={(dashboardData.criticalLabResultsCount ?? 0) > 0 ? 'badge badge-danger' : 'badge'}>
                    {dashboardData.criticalLabResultsCount ?? 0}
                  </span>
                </div>

                <div style={{
                  padding: '0.85rem',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <FlaskConical size={18} color="#0284c7" />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        Pending Laboratory Orders
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Specimens awaiting processing & verification
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-info">{dashboardData.pendingLabOrdersCount ?? 0}</span>
                </div>

                <div style={{
                  padding: '0.85rem',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Pill size={18} color="#8b5cf6" />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        Unfulfilled Prescriptions
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Signed prescriptions awaiting pharmacy dispensing
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-warning">{dashboardData.pendingPrescriptionsCount ?? 0}</span>
                </div>

                <div style={{
                  padding: '0.85rem',
                  borderRadius: '6px',
                  backgroundColor: (dashboardData.lowStockDrugsCount ?? 0) > 0 ? '#fffbeb' : '#f8fafc',
                  border: (dashboardData.lowStockDrugsCount ?? 0) > 0 ? '1px solid #fde68a' : '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <AlertTriangle size={18} color={(dashboardData.lowStockDrugsCount ?? 0) > 0 ? '#d97706' : '#64748b'} />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: (dashboardData.lowStockDrugsCount ?? 0) > 0 ? '#92400e' : 'var(--text-main)' }}>
                        Low Stock Formulary Drugs
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Inventory units below reorder threshold
                      </div>
                    </div>
                  </div>
                  <span className={(dashboardData.lowStockDrugsCount ?? 0) > 0 ? 'badge badge-warning' : 'badge'}>
                    {dashboardData.lowStockDrugsCount ?? 0}
                  </span>
                </div>

                <div style={{
                  padding: '0.85rem',
                  borderRadius: '6px',
                  backgroundColor: (dashboardData.expiringBatchesCount ?? 0) > 0 ? '#fdf4ff' : '#f8fafc',
                  border: (dashboardData.expiringBatchesCount ?? 0) > 0 ? '1px solid #f5d0fe' : '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Clock size={18} color="#c026d3" />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: (dashboardData.expiringBatchesCount ?? 0) > 0 ? '#86198f' : 'var(--text-main)' }}>
                        Batches Expiring (Next 90 Days)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        FEFO rotation priority batches
                      </div>
                    </div>
                  </div>
                  <span className="badge" style={{ background: '#f5d0fe', color: '#86198f' }}>
                    {dashboardData.expiringBatchesCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: FINANCIAL & REVENUE RECONCILIATION */}
      {activeTab === 'financial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filter Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} color="var(--text-muted)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Period:</span>
                <input
                  type="date"
                  className="form-input"
                  value={financialFromDate}
                  onChange={(e) => setFinancialFromDate(e.target.value)}
                  style={{ width: '140px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  value={financialToDate}
                  onChange={(e) => setFinancialToDate(e.target.value)}
                  style={{ width: '140px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => loadFinancialReport(financialFromDate, financialToDate)}
                  disabled={loading}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
                >
                  Apply
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button className="btn btn-outline" onClick={() => applyFinancialPreset(0)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>Today</button>
                <button className="btn btn-outline" onClick={() => applyFinancialPreset(7)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>7 Days</button>
                <button className="btn btn-outline" onClick={() => applyFinancialPreset(30)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>30 Days</button>
                <button className="btn btn-outline" onClick={() => applyFinancialPreset(90)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>90 Days</button>
              </div>
            </div>

            <button
              className="btn btn-outline"
              onClick={handleExportFinancialCsv}
              disabled={exportingCsv}
              style={{ fontSize: '0.85rem' }}
            >
              <Download size={14} />
              {exportingCsv ? 'Exporting...' : 'Export Financial CSV'}
            </button>
          </div>

          {/* Loading Skeleton Card for Financial */}
          {loading && !financialData && (
            <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <Activity size={36} className="spin" color="#0d9488" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Financial Reconciliation...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Compiling revenue ledger, billing collections, and cashier tender channels.
              </p>
            </div>
          )}

          {financialData && (
            <>
              {/* Financial Summary KPI Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL INVOICED</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                    {formatCurrency(financialData.totalInvoiced ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {financialData.totalInvoicesIssued ?? 0} invoices issued
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>GROSS COLLECTED</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem' }}>
                    {formatCurrency(financialData.totalCollected ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {financialData.totalPaymentsCaptured ?? 0} receipts recorded
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL REFUNDS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444', marginTop: '0.25rem' }}>
                    {formatCurrency(financialData.totalRefunded ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
                    {financialData.totalRefundsProcessed ?? 0} refund authorizations
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700 }}>NET REVENUE COLLECTED</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#15803d', marginTop: '0.25rem' }}>
                    {formatCurrency(financialData.netCollected ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.25rem' }}>
                    Cashier & bank net retained
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OUTSTANDING BALANCE</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.25rem' }}>
                    {formatCurrency(financialData.totalOutstandingReceivables ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                    Unsettled patient balances
                  </div>
                </div>
              </div>

              {/* Revenue Channel Distribution & Tax/Discount Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem' }}>
                
                {/* Payment Methods Breakdown */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    Collections Breakdown by Payment Method
                  </h3>
                  <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Distribution of incoming monetary streams across tender categories.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(financialData.revenueByPaymentMethod ?? []).map((item) => (
                      <div key={item.methodName} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600 }}>
                            {item.methodName} ({item.transactionsCount ?? 0} tx)
                          </span>
                          <span style={{ fontWeight: 700 }}>
                            {formatCurrency(item.amount ?? 0)} ({(item.percentageOfTotal ?? 0).toFixed(1)}%)
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          backgroundColor: '#e2e8f0',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(100, Math.max(0, item.percentageOfTotal ?? 0))}%`,
                            height: '100%',
                            backgroundColor: item.methodName.toLowerCase().includes('cash')
                              ? '#10b981'
                              : item.methodName.toLowerCase().includes('card')
                              ? '#3b82f6'
                              : item.methodName.toLowerCase().includes('bank')
                              ? '#8b5cf6'
                              : item.methodName.toLowerCase().includes('insurance')
                              ? '#f59e0b'
                              : '#0d9488',
                            borderRadius: '4px'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fiscal Summary Card */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    Fiscal Adjustments & Deductions
                  </h3>
                  <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Reconciliation of clinical fee discounts and collected taxes.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Discounts Conceded:</span>
                      <strong style={{ fontSize: '0.9rem', color: '#ef4444' }}>{formatCurrency(financialData.totalDiscountsGranted ?? 0)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sales Tax / VAT:</span>
                      <strong style={{ fontSize: '0.9rem', color: '#3b82f6' }}>{formatCurrency(financialData.totalTaxCollected ?? 0)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Collection Efficiency:</span>
                      <strong style={{ fontSize: '0.9rem', color: '#10b981' }}>
                        {(financialData.totalInvoiced ?? 0) > 0
                          ? (((financialData.totalCollected ?? 0) / financialData.totalInvoiced) * 100).toFixed(1) + '%'
                          : '100%'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reconciled Status:</span>
                      <span className="badge badge-success">Balanced & Offline Verified</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Daily Revenue Trend Table */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                  Daily Financial Trend Ledger
                </h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Chronological breakdown of invoiced versus collected figures during the selected reporting window.
                </p>

                <div className="table-wrapper">
                  <table className="desktop-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th style={{ textAlign: 'center' }}>Invoices</th>
                        <th style={{ textAlign: 'right' }}>Invoiced Amount</th>
                        <th style={{ textAlign: 'center' }}>Receipts</th>
                        <th style={{ textAlign: 'right' }}>Collected</th>
                        <th style={{ textAlign: 'right' }}>Refunded</th>
                        <th style={{ textAlign: 'right' }}>Net Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(financialData.dailyTrend ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                            No financial records in this timeframe.
                          </td>
                        </tr>
                      ) : (
                        (financialData.dailyTrend ?? []).map((row) => (
                          <tr key={row.date}>
                            <td><strong>{row.date}</strong></td>
                            <td style={{ textAlign: 'center' }}>{row.invoicesCount ?? 0}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(row.invoicedAmount ?? 0)}</td>
                            <td style={{ textAlign: 'center' }}>{row.paymentsCount ?? 0}</td>
                            <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                              {formatCurrency(row.collectedAmount ?? 0)}
                            </td>
                            <td style={{ textAlign: 'right', color: (row.refundedAmount ?? 0) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                              {formatCurrency(row.refundedAmount ?? 0)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {formatCurrency(row.netCollectedAmount ?? 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      )}

      {/* TAB 3: LABORATORY WORKLOAD & TURNAROUND TIME */}
      {activeTab === 'laboratory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filter Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} color="var(--text-muted)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Period:</span>
                <input
                  type="date"
                  className="form-input"
                  value={labFromDate}
                  onChange={(e) => setLabFromDate(e.target.value)}
                  style={{ width: '140px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  value={labToDate}
                  onChange={(e) => setLabToDate(e.target.value)}
                  style={{ width: '140px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => loadLaboratoryReport(labFromDate, labToDate)}
                  disabled={loading}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
                >
                  Apply
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button className="btn btn-outline" onClick={() => applyLabPreset(0)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>Today</button>
                <button className="btn btn-outline" onClick={() => applyLabPreset(7)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>7 Days</button>
                <button className="btn btn-outline" onClick={() => applyLabPreset(30)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>30 Days</button>
                <button className="btn btn-outline" onClick={() => applyLabPreset(90)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>90 Days</button>
              </div>
            </div>

            <button
              className="btn btn-outline"
              onClick={handleExportLabCsv}
              disabled={exportingCsv}
              style={{ fontSize: '0.85rem' }}
            >
              <Download size={14} />
              {exportingCsv ? 'Exporting...' : 'Export Laboratory CSV'}
            </button>
          </div>

          {/* Loading Skeleton Card for Laboratory */}
          {loading && !labData && (
            <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <Activity size={36} className="spin" color="#0d9488" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Laboratory Workload & TAT...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Analyzing specimen logs, diagnostic test volumes, and abnormality rates.
              </p>
            </div>
          )}

          {labData && (
            <>
              {/* Lab KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '1rem'
              }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL LAB ORDERS</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                    {labData.totalOrdersCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {labData.totalTestsCount ?? 0} individual test items
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>AVERAGE TURNAROUND TIME</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0d9488', marginTop: '0.25rem' }}>
                    {(labData.averageTurnaroundTimeHours ?? 0).toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#0d9488', marginTop: '0.25rem' }}>
                    {(labData.averageTurnaroundTimeHours ?? 0) <= 3.0 ? 'Optimal efficiency' : 'Acceptable range'}
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMPLETED & RELEASED</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem' }}>
                    {labData.completedOrdersCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {labData.pendingOrdersCount ?? 0} orders currently in worklist
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ABNORMAL RESULTS</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: (labData.abnormalResultsCount ?? 0) > 0 ? '#ef4444' : '#10b981', marginTop: '0.25rem' }}>
                    {labData.abnormalResultsCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: (labData.abnormalResultsCount ?? 0) > 0 ? '#ef4444' : '#10b981', marginTop: '0.25rem' }}>
                    {(labData.totalTestsCount ?? 0) > 0
                      ? (((labData.abnormalResultsCount ?? 0) / labData.totalTestsCount) * 100).toFixed(1) + '% test abnormality rate'
                      : '0% abnormality'}
                  </div>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                  Diagnostic Category Workload & Revenue Breakdown
                </h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Workload volume, abnormal test detections, and billable revenue generated per lab department.
                </p>

                <div className="table-wrapper">
                  <table className="desktop-table">
                    <thead>
                      <tr>
                        <th>Diagnostic Category</th>
                        <th style={{ textAlign: 'center' }}>Orders Count</th>
                        <th style={{ textAlign: 'center' }}>Total Tests</th>
                        <th style={{ textAlign: 'center' }}>Abnormal Findings</th>
                        <th style={{ textAlign: 'right' }}>Total Billable Revenue</th>
                        <th style={{ textAlign: 'center' }}>Share of Workload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(labData.categoryBreakdown ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                            No laboratory test records found in this window.
                          </td>
                        </tr>
                      ) : (
                        (labData.categoryBreakdown ?? []).map((cat) => (
                          <tr key={cat.category}>
                            <td><strong>{cat.category}</strong></td>
                            <td style={{ textAlign: 'center' }}>{cat.ordersCount ?? 0}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-info">{cat.testsCount ?? 0}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {(cat.abnormalTestsCount ?? 0) > 0 ? (
                                <span className="badge badge-danger">{cat.abnormalTestsCount}</span>
                              ) : (
                                <span className="badge badge-success">0</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatCurrency(cat.totalRevenue ?? 0)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {(labData.totalTestsCount ?? 0) > 0
                                ? (((cat.testsCount ?? 0) / labData.totalTestsCount) * 100).toFixed(1) + '%'
                                : '0%'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      )}

      {/* TAB 4: PHARMACY STOCK VALUATION & EXPIRY AGING */}
      {activeTab === 'pharmacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Loading Skeleton Card for Pharmacy */}
          {loading && !pharmacyData && (
            <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <Activity size={36} className="spin" color="#0d9488" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Pharmacy Valuation & Expiry Aging...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Evaluating active formulary inventory, acquisition costs, margins, and FEFO expiry schedules.
              </p>
            </div>
          )}

          {pharmacyData && (
            <>
              {/* Action Header */}
              <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Inventory Valuation Timestamp:</span>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {pharmacyData.generatedAt ? new Date(pharmacyData.generatedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>

                <button
                  className="btn btn-outline"
                  onClick={handleExportPharmacyCsv}
                  disabled={exportingCsv}
                  style={{ fontSize: '0.85rem' }}
                >
                  <Download size={14} />
                  {exportingCsv ? 'Exporting...' : 'Export Pharmacy Valuation CSV'}
                </button>
              </div>

              {/* Financial Valuation KPI Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '1rem'
              }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE FORMULARY STOCK</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                    {(pharmacyData.totalUnitsOnHand ?? 0).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>units</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {pharmacyData.totalFormularyDrugsCount ?? 0} drugs across {pharmacyData.totalActiveBatchesCount ?? 0} batches
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ACQUISITION COST</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#3b82f6', marginTop: '0.25rem' }}>
                    {formatCurrency(pharmacyData.totalInventoryCostValue ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Capital tied up in pharmaceutical stock
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ESTIMATED RETAIL VALUE</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem' }}>
                    {formatCurrency(pharmacyData.totalInventoryRetailValue ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                    Projected gross revenue at full dispensing
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700 }}>PROJECTED GROSS MARGIN</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#15803d', marginTop: '0.25rem' }}>
                    {formatCurrency(pharmacyData.projectedGrossMarginValue ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.25rem' }}>
                    Margin: {(pharmacyData.projectedGrossMarginPercentage ?? 0).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Wastage & Loss Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <AlertTriangle size={18} color="#ef4444" />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#991b1b', fontWeight: 700 }}>
                      Expired Medication Wastage Loss
                    </h4>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c' }}>
                    {formatCurrency(pharmacyData.expiredWastageCostValue ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#991b1b', marginTop: '0.25rem' }}>
                    {pharmacyData.expiredWastageUnits ?? 0} units marked as expired & disposed
                  </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <AlertCircle size={18} color="#d97706" />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#92400e', fontWeight: 700 }}>
                      Damaged & Spoilage Wastage Loss
                    </h4>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b45309' }}>
                    {formatCurrency(pharmacyData.damagedWastageCostValue ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.25rem' }}>
                    {pharmacyData.damagedWastageUnits ?? 0} units written off due to clinical damage
                  </div>
                </div>
              </div>

              {/* Expiry Aging Schedule Table */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                  FEFO Expiry Aging Schedule (Horizon Breakdown)
                </h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Stock grouped by days remaining until expiration. First-Expired-First-Out prioritization protocol.
                </p>

                <div className="table-wrapper">
                  <table className="desktop-table">
                    <thead>
                      <tr>
                        <th>Expiry Horizon</th>
                        <th style={{ textAlign: 'center' }}>Batches Count</th>
                        <th style={{ textAlign: 'center' }}>Total Units</th>
                        <th style={{ textAlign: 'right' }}>Cost Value</th>
                        <th style={{ textAlign: 'right' }}>Retail Value</th>
                        <th style={{ textAlign: 'center' }}>Risk Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pharmacyData.expiryAgingSchedule ?? []).map((horizon) => {
                        const isPast = horizon.horizonLabel?.includes('Past') ?? false;
                        const is0to30 = horizon.horizonLabel?.includes('0 - 30') ?? false;
                        const is31to90 = horizon.horizonLabel?.includes('31 - 90') ?? false;
                        
                        return (
                          <tr key={horizon.horizonLabel} style={{
                            backgroundColor: isPast ? '#fff1f2' : is0to30 ? '#fffbeb' : 'inherit'
                          }}>
                            <td>
                              <strong>{horizon.horizonLabel}</strong>
                            </td>
                            <td style={{ textAlign: 'center' }}>{horizon.batchesCount ?? 0}</td>
                            <td style={{ textAlign: 'center' }}>{horizon.totalUnits ?? 0}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(horizon.costValue ?? 0)}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(horizon.retailValue ?? 0)}</td>
                            <td style={{ textAlign: 'center' }}>
                              {isPast ? (
                                <span className="badge badge-danger">Expired</span>
                              ) : is0to30 ? (
                                <span className="badge badge-danger">Immediate Risk</span>
                              ) : is31to90 ? (
                                <span className="badge badge-warning">High Priority</span>
                              ) : (
                                <span className="badge badge-success">Good Stock</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      )}

    </div>
  );
};
