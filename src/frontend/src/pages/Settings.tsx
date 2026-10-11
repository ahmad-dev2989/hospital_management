import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  HardDrive,
  Database,
  Cpu,
  Save,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Search,
  Layers,
  Sparkles,
  UserCheck
} from 'lucide-react';
import {
  api,
  type DocumentDto,
  type DatabaseBackupDto,
  type SystemInfoDto,
  type PatientDto,
  DOCUMENT_CATEGORY_NAMES,
  type DocumentCategory,
  type ApiError
} from '../api/client';
import { UserManagement } from './UserManagement';
import { AuditLogs } from './AuditLogs';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'audit' | 'documents' | 'backups' | 'telemetry'>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // TAB 1: System Settings State
  const [settings, setSettings] = useState<Record<string, string>>({
    HospitalName: 'Mercy Community Hospital',
    HospitalAddress: '100 Healthcare Blvd, Medical District',
    HospitalPhone: '+1-555-0199',
    CurrencySymbol: '$',
    DefaultSlotDurationMinutes: '15',
    PatientIdPrefix: 'HSP',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // TAB 2: Document Repository State
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [docTotal, setDocTotal] = useState(0);
  const [docPage, setDocPage] = useState(1);
  const [docSearch, setDocSearch] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Upload modal state
  const [uploadPatientQuery, setUploadPatientQuery] = useState('');
  const [uploadPatients, setUploadPatients] = useState<PatientDto[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // TAB 3: Database Backups State
  const [backups, setBackups] = useState<DatabaseBackupDto[]>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [verifyingFile, setVerifyingFile] = useState<string | null>(null);

  // TAB 4: System Telemetry State
  const [systemInfo, setSystemInfo] = useState<SystemInfoDto | null>(null);
  const [runningMaintenance, setRunningMaintenance] = useState(false);
  const [maintenanceResult, setMaintenanceResult] = useState<string | null>(null);

  // Load functions
  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSystemSettings();
      const map: Record<string, string> = {};
      data.forEach((s) => {
        map[s.key] = s.value;
      });
      setSettings((prev) => ({ ...prev, ...map }));
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load system configuration settings.');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const cat = docCategoryFilter !== 'all' ? parseInt(docCategoryFilter, 10) : undefined;
      const res = await api.getDocuments({
        query: docSearch || undefined,
        category: cat,
        page: docPage,
        pageSize: 15,
      });
      setDocuments(res.items);
      setDocTotal(res.total);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load document records.');
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDatabaseBackups();
      setBackups(data);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load database backups list.');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSystemInfo();
      setSystemInfo(data);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load system runtime information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'profile') loadSettings();
    else if (activeTab === 'documents') loadDocuments();
    else if (activeTab === 'backups') loadBackups();
    else if (activeTab === 'telemetry') loadSystemInfo();
  }, [activeTab, docCategoryFilter, docPage]);

  // Tab 1: Save settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.batchUpdateSystemSettings(settings);
      setSuccessMsg('Hospital configuration settings saved and applied successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to save configuration settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Tab 2: Upload Document
  const searchPatientsForUpload = async (term: string) => {
    setUploadPatientQuery(term);
    if (term.trim().length >= 2) {
      try {
        const res = await api.getPatients({ query: term.trim(), page: 1, pageSize: 5 });
        setUploadPatients(res.items);
      } catch {
        setUploadPatients([]);
      }
    } else {
      setUploadPatients([]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedFile) {
      alert('Please select both a patient and a file.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('patientId', selectedPatientId);
      formData.append('category', selectedCategory.toString());
      formData.append('file', selectedFile);

      await api.uploadDocument(formData);
      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedPatientId('');
      setUploadPatientQuery('');
      setSuccessMsg('Document successfully uploaded, SHA-256 hashed, and stored.');
      setTimeout(() => setSuccessMsg(null), 3500);
      loadDocuments();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert('Upload failed: ' + (apiErr.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: DocumentDto) => {
    if (!window.confirm(`Are you sure you want to permanently delete document '${doc.fileName}'? This removes the physical file from disk and records an audit log.`)) {
      return;
    }
    try {
      await api.deleteDocument(doc.id);
      loadDocuments();
    } catch (err: any) {
      alert('Failed to delete document: ' + (err.message || 'Unknown error'));
    }
  };

  // Tab 3: Backups
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setError(null);
    try {
      const b = await api.createDatabaseBackup();
      setSuccessMsg(`Database backup '${b.fileName}' created successfully (${(b.sizeBytes / 1024).toFixed(1)} KB).`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadBackups();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to generate database backup.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleVerifyBackup = async (fileName: string) => {
    setVerifyingFile(fileName);
    try {
      const res = await api.verifyDatabaseBackup(fileName);
      alert(`Backup Verification: ${res.statusMessage}\n\nSHA-256: ${res.sha256Hash}`);
      loadBackups();
    } catch (err: any) {
      alert('Verification failed: ' + (err.message || 'Unknown error'));
    } finally {
      setVerifyingFile(null);
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete local backup archive '${fileName}'?`)) {
      return;
    }
    try {
      await api.deleteDatabaseBackup(fileName);
      loadBackups();
    } catch (err: any) {
      alert('Failed to delete backup: ' + (err.message || 'Unknown error'));
    }
  };

  // Tab 4: Maintenance
  const handleRunMaintenance = async () => {
    setRunningMaintenance(true);
    setMaintenanceResult(null);
    try {
      const res = await api.runDatabaseMaintenance();
      setMaintenanceResult(res.message);
    } catch (err: any) {
      alert('Maintenance failed: ' + (err.message || 'Unknown error'));
    } finally {
      setRunningMaintenance(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
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
              <SettingsIcon size={20} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Hospital Administration Center
            </h1>
            <span className="badge badge-info" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              Administrative Hub
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Hospital profile configuration, staff user accounts & RBAC, immutable security audit trail, and database maintenance.
          </p>
        </div>

        <button
          className="btn btn-outline"
          onClick={() => {
            if (activeTab === 'profile') loadSettings();
            else if (activeTab === 'documents') loadDocuments();
            else if (activeTab === 'backups') loadBackups();
            else if (activeTab === 'telemetry') loadSystemInfo();
          }}
          disabled={loading}
          style={{ fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
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
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'profile' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={16} />
          Hospital Profile & Config
        </button>

        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'users' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'users' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <UserCheck size={16} />
          Staff & RBAC Accounts
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'audit' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'audit' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ShieldCheck size={16} />
          Security Audit Trail
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'documents' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'documents' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'documents' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <HardDrive size={16} />
          Document Storage & Archive
        </button>

        <button
          onClick={() => setActiveTab('backups')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'backups' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'backups' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'backups' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Database size={16} />
          Database Backup & Recovery
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'telemetry' ? '3px solid #0d9488' : '3px solid transparent',
            color: activeTab === 'telemetry' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'telemetry' ? 700 : 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Cpu size={16} />
          System Telemetry & Optimization
        </button>
      </div>

      {/* Notifications */}
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

      {successMsg && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#166534',
          fontSize: '0.85rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: HOSPITAL PROFILE & CONFIGURATION */}
      {activeTab === 'profile' && (
        <div className="card" style={{ padding: '1.5rem', maxWidth: '800px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Hospital Identity & Global System Parameters
            </h3>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              These parameters dynamically brand print headers, receipts, reports, slot booking calendars, and invoice headers across all workstations.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Hospital Registered Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings['HospitalName'] || ''}
                  onChange={(e) => setSettings({ ...settings, HospitalName: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Appears on report banners & receipts</span>
              </div>

              <div className="form-group">
                <label className="form-label">Contact Phone Number *</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings['HospitalPhone'] || ''}
                  onChange={(e) => setSettings({ ...settings, HospitalPhone: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Main hospital reception line</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Physical Street Address *</label>
              <input
                type="text"
                className="form-input"
                value={settings['HospitalAddress'] || ''}
                onChange={(e) => setSettings({ ...settings, HospitalAddress: e.target.value })}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Official address for formal discharge summaries and invoices</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Currency Symbol *</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings['CurrencySymbol'] || ''}
                  onChange={(e) => setSettings({ ...settings, CurrencySymbol: e.target.value })}
                  style={{ width: '80px' }}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>e.g. $, €, £</span>
              </div>

              <div className="form-group">
                <label className="form-label">Default Consultation Slot (Minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings['DefaultSlotDurationMinutes'] || ''}
                  onChange={(e) => setSettings({ ...settings, DefaultSlotDurationMinutes: e.target.value })}
                  min="5"
                  max="120"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Standard doctor schedule slot interval</span>
              </div>

              <div className="form-group">
                <label className="form-label">Patient ID Prefix</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings['PatientIdPrefix'] || ''}
                  onChange={(e) => setSettings({ ...settings, PatientIdPrefix: e.target.value })}
                  maxLength={5}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>e.g. HSP-YYYY-XXXXX</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingSettings}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                <Save size={16} />
                {savingSettings ? 'Saving Settings...' : 'Save Hospital Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: DOCUMENT REPOSITORY & ARCHIVE */}
      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Action & Filter Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: '600px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by file name or patient number / name..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadDocuments()}
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>

              <select
                className="form-input"
                value={docCategoryFilter}
                onChange={(e) => { setDocCategoryFilter(e.target.value); setDocPage(1); }}
                style={{ width: '180px' }}
              >
                <option value="all">All Categories</option>
                <option value="0">General Document</option>
                <option value="1">Laboratory Report</option>
                <option value="2">Prescription</option>
                <option value="3">Diagnostic Scan</option>
                <option value="4">Specialist Referral</option>
                <option value="5">Identity & Insurance</option>
              </select>

              <button className="btn btn-primary" onClick={loadDocuments} style={{ padding: '0.45rem 0.85rem' }}>
                Search
              </button>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowUploadModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Upload size={16} />
              Upload Patient Document
            </button>
          </div>

          {/* Document Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing <strong>{documents.length}</strong> of <strong>{docTotal}</strong> stored attachments
              </span>
            </div>

            <div className="table-wrapper">
              <table className="desktop-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Document File</th>
                    <th>Category</th>
                    <th>File Size</th>
                    <th>SHA-256 Checksum</th>
                    <th>Uploaded By / Date</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No stored clinical documents found. Click "Upload Patient Document" to attach records.
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <strong>{doc.patientName}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.patientNumber}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <FileText size={16} color="#0d9488" />
                            <strong style={{ wordBreak: 'break-all' }}>{doc.fileName}</strong>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{doc.mimeType}</span>
                        </td>
                        <td>
                          <span className="badge badge-info">
                            {DOCUMENT_CATEGORY_NAMES[doc.category] || doc.categoryName}
                          </span>
                        </td>
                        <td>{formatBytes(doc.sizeBytes)}</td>
                        <td>
                          <code style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                            {doc.sha256Hash ? doc.sha256Hash.substring(0, 10) + '...' : 'Verified'}
                          </code>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem' }}>{doc.uploadedByUserName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(doc.createdAt).toLocaleDateString()} {new Date(doc.createdAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              className="btn btn-outline"
                              onClick={() => api.downloadDocument(doc.id, doc.fileName)}
                              title="Download document from local storage"
                              style={{ padding: '0.3rem 0.5rem' }}
                            >
                              <Download size={14} color="#0d9488" />
                            </button>
                            <button
                              className="btn btn-outline"
                              onClick={() => handleDeleteDocument(doc)}
                              title="Delete file permanently"
                              style={{ padding: '0.3rem 0.5rem', borderColor: '#fca5a5' }}
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="modal-backdrop">
              <div className="modal-card" style={{ maxWidth: '520px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
                  Upload Patient Document to Secure Local Storage
                </h3>

                <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Select Patient */}
                  <div className="form-group">
                    <label className="form-label">Search & Select Patient *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Type patient name or ID..."
                      value={uploadPatientQuery}
                      onChange={(e) => searchPatientsForUpload(e.target.value)}
                    />
                    {uploadPatients.length > 0 && (
                      <div style={{
                        marginTop: '0.25rem',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: '#ffffff',
                        maxHeight: '130px',
                        overflowY: 'auto'
                      }}>
                        {uploadPatients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPatientId(p.id);
                              setUploadPatientQuery(`${p.fullName} (${p.patientNumber})`);
                              setUploadPatients([]);
                            }}
                            style={{
                              padding: '0.45rem 0.75rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              fontSize: '0.85rem'
                            }}
                          >
                            <strong>{p.fullName}</strong> — {p.patientNumber} (DOB: {p.dateOfBirth.split('T')[0]})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Document Category */}
                  <div className="form-group">
                    <label className="form-label">Document Category *</label>
                    <select
                      className="form-input"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(parseInt(e.target.value, 10) as DocumentCategory)}
                    >
                      <option value={0}>General Clinical Document</option>
                      <option value={1}>Laboratory Report</option>
                      <option value={2}>Prescription & Medication Order</option>
                      <option value={3}>Diagnostic Scan / Imaging</option>
                      <option value={4}>Specialist Referral</option>
                      <option value={5}>Patient Identity / Insurance Card</option>
                    </select>
                  </div>

                  {/* File Selection */}
                  <div className="form-group">
                    <label className="form-label">Select File from Computer *</label>
                    <input
                      type="file"
                      className="form-input"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Supports PDF, images, DICOM, text up to 25 MB. Files are SHA-256 hashed on storage.
                    </span>
                  </div>

                  <div className="modal-actions" style={{ marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setShowUploadModal(false)}
                      disabled={uploading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={uploading || !selectedFile || !selectedPatientId}
                    >
                      {uploading ? 'Hashing & Storing...' : 'Upload & Store File'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 3: DATABASE BACKUP & RECOVERY */}
      {activeTab === 'backups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Card */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#10b981" />
                PostgreSQL Automated Backup & Disaster Recovery
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Direct native pg_dump database export with SHA-256 hash validation and offline restore readiness.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Database size={16} className={creatingBackup ? 'spin' : ''} />
              {creatingBackup ? 'Creating Native Backup...' : 'Create Instant Backup Now'}
            </button>
          </div>

          {/* Backup Archive Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
              Available Local Database Backups ({backups.length})
            </h4>

            <div className="table-wrapper">
              <table className="desktop-table">
                <thead>
                  <tr>
                    <th>Backup Archive File</th>
                    <th>Archive Size</th>
                    <th>Generated Timestamp</th>
                    <th>SHA-256 Integrity Hash</th>
                    <th style={{ textAlign: 'center' }}>Health Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No local backups generated yet. Click "Create Instant Backup Now" to safeguard your hospital database.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.fileName}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Database size={16} color="#0d9488" />
                            <strong>{b.fileName}</strong>
                          </div>
                        </td>
                        <td>{formatBytes(b.sizeBytes)}</td>
                        <td>
                          <div style={{ fontSize: '0.8rem' }}>
                            {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                            {b.sha256Hash ? b.sha256Hash.substring(0, 12) + '...' : 'Calculated'}
                          </code>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {b.isVerified ? (
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle2 size={12} /> Verified Intact
                            </span>
                          ) : (
                            <span className="badge badge-warning">Unverified</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              className="btn btn-outline"
                              onClick={() => handleVerifyBackup(b.fileName)}
                              disabled={verifyingFile === b.fileName}
                              title="Verify archive integrity and PostgreSQL header"
                              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            >
                              <ShieldCheck size={13} color="#10b981" />
                              {verifyingFile === b.fileName ? 'Checking...' : 'Verify'}
                            </button>
                            <button
                              className="btn btn-outline"
                              onClick={() => handleDeleteBackup(b.fileName)}
                              title="Delete backup archive"
                              style={{ padding: '0.3rem 0.5rem', borderColor: '#fca5a5' }}
                            >
                              <Trash2 size={13} color="#ef4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: SYSTEM TELEMETRY & OPTIMIZATION */}
      {activeTab === 'telemetry' && systemInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Telemetry KPIs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>BACKEND RUNTIME</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                {systemInfo.dotNetVersion}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                ASP.NET Core 8 Web API
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DATABASE INSTANCE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0d9488', marginTop: '0.25rem' }}>
                {systemInfo.databaseName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {systemInfo.databaseServerVersion}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DOCUMENT REPOSITORY</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6', marginTop: '0.25rem' }}>
                {systemInfo.totalStoredDocumentsCount} files
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {formatBytes(systemInfo.totalStoredDocumentsSizeBytes)} total disk footprint
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>AVAILABLE STORAGE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d', marginTop: '0.25rem' }}>
                {formatBytes(systemInfo.freeDiskSpaceBytes)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.25rem' }}>
                Local hard disk capacity
              </div>
            </div>
          </div>

          {/* Database Tables Stats & Maintenance Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem' }}>
            
            {/* Table Record Counts */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="#0d9488" />
                Active Relational Database Record Ledger
              </h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Live record counts stored in the offline PostgreSQL cluster.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '0.75rem'
              }}>
                {Object.entries(systemInfo.recordCounts).map(([table, count]) => (
                  <div key={table} style={{
                    padding: '0.75rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{table}</span>
                    <span className="badge badge-info">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimization & Maintenance Action */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="#f59e0b" />
                Database Engine Maintenance
              </h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Reclaims dead tuples, analyzes table distribution, and optimizes PostgreSQL index statistics.
              </p>

              <button
                className="btn btn-primary"
                onClick={handleRunMaintenance}
                disabled={runningMaintenance}
                style={{ width: '100%', padding: '0.65rem' }}
              >
                <RefreshCw size={15} className={runningMaintenance ? 'spin' : ''} />
                {runningMaintenance ? 'Executing VACUUM ANALYZE...' : 'Run PostgreSQL VACUUM & Re-Index'}
              </button>

              {maintenanceResult && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#166534'
                }}>
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '0.35rem' }} />
                  {maintenanceResult}
                </div>
              )}

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div><strong>Documents Directory:</strong></div>
                <code style={{ wordBreak: 'break-all' }}>{systemInfo.documentsStoragePath}</code>

                <div style={{ marginTop: '0.5rem' }}><strong>Backups Directory:</strong></div>
                <code style={{ wordBreak: 'break-all' }}>{systemInfo.backupsDirectoryPath}</code>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: STAFF & USERS (RBAC) */}
      {activeTab === 'users' && (
        <div style={{ marginTop: '0.5rem' }}>
          <UserManagement />
        </div>
      )}

      {/* TAB 3: SECURITY AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div style={{ marginTop: '0.5rem' }}>
          <AuditLogs />
        </div>
      )}

    </div>
  );
};
