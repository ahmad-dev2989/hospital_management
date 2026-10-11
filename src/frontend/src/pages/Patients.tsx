import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Activity,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  FolderHeart,
  Droplet,
  UserCheck,
  UserX,
  ShieldAlert,
  Calendar,
  FileText,
  CreditCard,
  Upload,
  Download,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import {
  api,
  type PatientDto,
  type PatientChartDto,
  type CreatePatientRequest,
  type UpdatePatientRequest,
  type AddAllergyRequest,
  type AddConditionRequest,
  type DuplicateMatchDto,
  type AllergySeverity,
  type DocumentDto,
  type DocumentCategory,
  DOCUMENT_CATEGORY_NAMES,
  type ApiError
} from '../api/client';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];

const formatDocBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const Patients: React.FC = () => {
  const {
    activePatient,
    setActivePatient,
    workflowAction,
    clearWorkflowAction,
    navigateWithWorkflow
  } = useNavigation();
  const toast = useToast();

  const [patients, setPatients] = useState<PatientDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddAllergyModal, setShowAddAllergyModal] = useState(false);
  const [showAddConditionModal, setShowAddConditionModal] = useState(false);

  // Active chart & selection
  const [activeChart, setActiveChart] = useState<PatientChartDto | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartTab, setChartTab] = useState<'summary' | 'allergies' | 'conditions' | 'encounters' | 'documents'>('summary');
  const [selectedPatient, setSelectedPatient] = useState<PatientDto | null>(null);

  // Patient Chart Documents State
  const [patientDocs, setPatientDocs] = useState<DocumentDto[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ doc: DocumentDto; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showChartUploadModal, setShowChartUploadModal] = useState(false);
  const [chartDocTitle, setChartDocTitle] = useState('');
  const [chartDocCategory, setChartDocCategory] = useState<DocumentCategory>(3);
  const [chartDocFile, setChartDocFile] = useState<File | null>(null);
  const [chartUploading, setChartUploading] = useState(false);

  // Duplicate warning state
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatchDto[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Forms
  const [registerForm, setRegisterForm] = useState<CreatePatientRequest>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    bloodGroup: 'O+',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bypassDuplicateWarning: false,
  });

  const [editForm, setEditForm] = useState<UpdatePatientRequest>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    bloodGroup: '',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const [allergyForm, setAllergyForm] = useState<AddAllergyRequest>({
    allergen: '',
    reaction: '',
    severity: 2, // Severe
  });

  const [conditionForm, setConditionForm] = useState<AddConditionRequest>({
    conditionName: '',
    status: 'Active',
    diagnosedDate: '',
  });

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.getPatients({
        query: search.trim() || undefined,
        gender: genderFilter || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        pageSize: 100,
      });
      setPatients(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [genderFilter, statusFilter]);

  // Phase 12: Handle cross-module workflow actions
  useEffect(() => {
    if (workflowAction) {
      if (workflowAction.action === 'register-patient') {
        setShowRegisterModal(true);
        clearWorkflowAction();
      } else if (workflowAction.action === 'view-chart' && activePatient) {
        handleOpenChart(activePatient);
        clearWorkflowAction();
      }
    }
  }, [workflowAction, activePatient]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients();
  };

  const loadPatientDocs = async (patientId: string) => {
    setLoadingDocs(true);
    try {
      const res = await api.getDocuments({ patientId, pageSize: 100 });
      setPatientDocs(res.items);
    } catch (err: any) {
      console.error('Failed to load patient documents', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleOpenChart = async (patient: PatientDto) => {
    setSelectedPatient(patient);
    setActivePatient(patient); // Phase 12: Synchronize globally active patient
    setChartLoading(true);
    setShowChartModal(true);
    setChartTab('summary');
    loadPatientDocs(patient.id);
    try {
      const chart = await api.getPatientChart(patient.id);
      setActiveChart(chart);
    } catch (err: any) {
      toast.error(err.message || 'Error loading clinical chart', 'Patient Chart Error');
    } finally {
      setChartLoading(false);
    }
  };

  const handlePreviewDocument = async (doc: DocumentDto) => {
    setPreviewLoading(true);
    setPreviewDoc({ doc, url: '' });
    try {
      const url = await api.getDocumentBlobUrl(doc.id);
      setPreviewDoc({ doc, url });
    } catch (err: any) {
      toast.error(err.message || 'Failed to stream document preview', 'Preview Error');
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeletePatientDoc = async (doc: DocumentDto) => {
    if (!window.confirm(`Permanently remove document "${doc.fileName}" from this patient's records?`)) {
      return;
    }
    try {
      await api.deleteDocument(doc.id);
      toast.success('Document deleted successfully.');
      if (selectedPatient) {
        await loadPatientDocs(selectedPatient.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete document', 'Delete Error');
    }
  };

  const handleChartUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !chartDocFile || !chartDocTitle.trim()) {
      toast.error('Please specify document name and select a file', 'Upload Error');
      return;
    }

    setChartUploading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let ext = '';
      if (chartDocFile.name.includes('.')) {
        ext = '.' + chartDocFile.name.split('.').pop();
      }
      const titlePart = chartDocTitle.trim();
      const formattedFileName = `${titlePart} - ${today}${ext}`;

      const formData = new FormData();
      formData.append('patientId', selectedPatient.id);
      formData.append('category', chartDocCategory.toString());
      formData.append('file', chartDocFile, formattedFileName);

      await api.uploadDocument(formData);
      toast.success(`Document "${formattedFileName}" added to chart!`);
      setShowChartUploadModal(false);
      setChartDocTitle('');
      setChartDocFile(null);
      await loadPatientDocs(selectedPatient.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document', 'Upload Error');
    } finally {
      setChartUploading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent, bypass = false) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    const payload = {
      ...registerForm,
      bypassDuplicateWarning: bypass,
      dateOfBirth: new Date(registerForm.dateOfBirth).toISOString(),
    };

    try {
      const created = await api.createPatient(payload);
      setShowRegisterModal(false);
      setShowDuplicateWarning(false);
      setToastMessage(`Patient ${created.fullName} (${created.patientNumber}) registered successfully.`);
      fetchPatients();
      handleOpenChart(created);
    } catch (err: any) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'POTENTIAL_DUPLICATE') {
        // Run duplicate check to display candidate matches to operator
        try {
          const dupRes = await api.checkDuplicates({
            ...registerForm,
            dateOfBirth: new Date(registerForm.dateOfBirth).toISOString(),
          });
          setDuplicateMatches(dupRes.matches);
          setShowDuplicateWarning(true);
        } catch {
          setModalError(apiErr.message);
        }
      } else {
        setModalError(apiErr.message || 'Registration failed.');
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenEdit = (patient: PatientDto) => {
    setSelectedPatient(patient);
    setEditForm({
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth.split('T')[0],
      gender: patient.gender,
      bloodGroup: patient.bloodGroup || '',
      phone: patient.phone,
      email: patient.email || '',
      address: patient.address || '',
      emergencyContactName: patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergencyContactPhone || '',
    });
    setModalError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setModalLoading(true);
    setModalError(null);

    try {
      const updated = await api.updatePatient(selectedPatient.id, {
        ...editForm,
        dateOfBirth: new Date(editForm.dateOfBirth).toISOString(),
      });
      setShowEditModal(false);
      setToastMessage(`Updated demographics for ${updated.patientNumber}.`);
      fetchPatients();
      if (activeChart && activeChart.demographics.id === updated.id) {
        handleOpenChart(updated);
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to update demographics.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleActive = async (patient: PatientDto) => {
    const action = patient.isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} patient ${patient.fullName} (${patient.patientNumber})?`)) {
      return;
    }

    try {
      const res = await api.togglePatientActive(patient.id);
      setToastMessage(res.message);
      fetchPatients();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddAllergySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setModalLoading(true);
    setModalError(null);

    try {
      await api.addAllergy(selectedPatient.id, allergyForm);
      setShowAddAllergyModal(false);
      setAllergyForm({ allergen: '', reaction: '', severity: 2 });
      setToastMessage(`Allergy added to ${selectedPatient.fullName}'s clinical chart.`);
      // Refresh chart
      const chart = await api.getPatientChart(selectedPatient.id);
      setActiveChart(chart);
      fetchPatients();
    } catch (err: any) {
      setModalError(err.message || 'Failed to record allergy.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRemoveAllergy = async (allergyId: string) => {
    if (!selectedPatient) return;
    if (!confirm('Remove this allergy record from patient chart?')) return;

    try {
      await api.removeAllergy(selectedPatient.id, allergyId);
      const chart = await api.getPatientChart(selectedPatient.id);
      setActiveChart(chart);
      fetchPatients();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddConditionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setModalLoading(true);
    setModalError(null);

    try {
      await api.addCondition(selectedPatient.id, {
        ...conditionForm,
        diagnosedDate: conditionForm.diagnosedDate ? new Date(conditionForm.diagnosedDate).toISOString() : null,
      });
      setShowAddConditionModal(false);
      setConditionForm({ conditionName: '', status: 'Active', diagnosedDate: '' });
      setToastMessage(`Condition recorded for ${selectedPatient.fullName}.`);
      const chart = await api.getPatientChart(selectedPatient.id);
      setActiveChart(chart);
    } catch (err: any) {
      setModalError(err.message || 'Failed to record condition.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRemoveCondition = async (conditionId: string) => {
    if (!selectedPatient) return;
    if (!confirm('Resolve or remove this condition from patient chart?')) return;

    try {
      await api.removeCondition(selectedPatient.id, conditionId);
      const chart = await api.getPatientChart(selectedPatient.id);
      setActiveChart(chart);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getAllergySeverityBadge = (severity: AllergySeverity) => {
    switch (severity) {
      case 3:
        return { label: 'Life-Threatening', bg: '#fef2f2', color: '#b91c1c' };
      case 2:
        return { label: 'Severe', bg: '#fff1f2', color: '#e11d48' };
      case 1:
        return { label: 'Moderate', bg: '#fff7ed', color: '#c2410c' };
      case 0:
      default:
        return { label: 'Mild', bg: '#f0fdf4', color: '#15803d' };
    }
  };

  return (
    <div className="patients-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-banner">
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toastMessage}</span>
          <button className="toast-close" onClick={() => setToastMessage(null)}>×</button>
        </div>
      )}

      {/* Header Row */}
      <div className="page-header-row">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Patient Management Directory</h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Search records, register new clinical demographics, and review electronic medical charts ({total} total patients).
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setModalError(null);
            setShowDuplicateWarning(false);
            setRegisterForm({
              firstName: '',
              lastName: '',
              dateOfBirth: '',
              gender: 'Male',
              bloodGroup: 'O+',
              phone: '',
              email: '',
              address: '',
              emergencyContactName: '',
              emergencyContactPhone: '',
              bypassDuplicateWarning: false,
            });
            setShowRegisterModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <UserPlus size={16} />
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="filter-card">
        <form onSubmit={handleSearchSubmit} className="search-row">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by Patient ID (HSP-YYYY-XXXXX), Name, or Contact Phone..."
              className="form-input search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Gender:</label>
            <select
              className="form-input select-filter"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Status:</label>
            <select
              className="form-input select-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Records</option>
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

      {/* Patients Table */}
      <div className="table-wrapper card" style={{ marginTop: '1rem', padding: 0 }}>
        <table className="desktop-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Patient Demographics</th>
              <th>Age / Gender</th>
              <th>Blood Group</th>
              <th>Contact Phone</th>
              <th>Clinical Alerts</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && patients.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading patient records...
                </td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No patient records found matching query.
                </td>
              </tr>
            ) : (
              patients.map((p) => {
                return (
                  <tr key={p.id} className={!p.isActive ? 'row-deactivated' : ''}>
                    <td>
                      <code style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f766e' }}>
                        {p.patientNumber}
                      </code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          className="avatar-circle"
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: p.gender === 'Female' ? '#fce7f3' : '#e0f2fe',
                            color: p.gender === 'Female' ? '#be185d' : '#0369a1',
                            fontWeight: 700,
                          }}
                        >
                          {p.firstName[0]}
                          {p.lastName[0]}
                        </div>
                        <div>
                          <strong>{p.fullName}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            DOB: {new Date(p.dateOfBirth).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span>{p.age} yrs</span> • <span style={{ color: 'var(--text-muted)' }}>{p.gender}</span>
                    </td>
                    <td>
                      {p.bloodGroup ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                          }}
                        >
                          <Droplet size={11} />
                          {p.bloodGroup}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <Phone size={13} color="var(--text-muted)" />
                        <span>{p.phone}</span>
                      </div>
                    </td>
                    <td>
                      {p.hasHighRiskAllergy ? (
                        <span
                          className="badge badge-danger"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          title="Patient has documented severe or life-threatening drug/substance allergies"
                        >
                          <ShieldAlert size={12} />
                          High-Risk Allergy
                        </span>
                      ) : p.allergiesCount > 0 ? (
                        <span className="badge badge-warning">
                          {p.allergiesCount} Known {p.allergiesCount === 1 ? 'Allergy' : 'Allergies'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None Recorded</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenChart(p)}
                          title="Open Clinical Chart"
                        >
                          <FolderHeart size={14} />
                          <span>Chart</span>
                        </button>

                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Demographics"
                        >
                          <span>Edit</span>
                        </button>

                        <button
                          className={`btn btn-sm ${p.isActive ? 'btn-danger-outline' : 'btn-success-outline'}`}
                          onClick={() => handleToggleActive(p)}
                          title={p.isActive ? 'Deactivate Record' : 'Activate Record'}
                        >
                          {p.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
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

      {/* REGISTER PATIENT MODAL */}
      {showRegisterModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserPlus size={20} color="#0d9488" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Register New Patient</h3>
              </div>
              <button className="modal-close" onClick={() => setShowRegisterModal(false)}>×</button>
            </div>

            {modalError && (
              <div className="login-alert alert-warning" style={{ margin: '1rem 0' }}>
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            {/* DUPLICATE WARNING MODAL OVERLAY */}
            {showDuplicateWarning && (
              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '1rem', margin: '1rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c2410c', fontWeight: 700 }}>
                  <AlertTriangle size={20} />
                  <span>Potential Duplicate Patients Detected</span>
                </div>
                <p style={{ fontSize: '0.825rem', color: '#9a3412', marginTop: '0.35rem' }}>
                  The entered demographics match existing hospital patient records. Review before registering:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {duplicateMatches.map((m) => (
                    <div key={m.patientId} style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #fed7aa' }}>
                      <strong>{m.fullName}</strong> (<code>{m.patientNumber}</code>) • Phone: {m.phone} • DOB: {new Date(m.dateOfBirth).toLocaleDateString()}
                      <div style={{ color: '#ea580c', fontWeight: 600, fontSize: '0.75rem', marginTop: '2px' }}>
                        Reason: {m.matchReason} [{m.confidenceScore} Confidence]
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowDuplicateWarning(false)}
                  >
                    Adjust Form Details
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#c2410c' }}
                    onClick={(e) => handleRegisterSubmit(e, true)}
                  >
                    Register Anyway (Confirm Duplicate)
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={(e) => handleRegisterSubmit(e, false)} style={{ marginTop: '1rem' }}>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. John"
                    value={registerForm.firstName}
                    onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Doe"
                    value={registerForm.lastName}
                    onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Date of Birth *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={registerForm.dateOfBirth}
                    onChange={(e) => setRegisterForm({ ...registerForm, dateOfBirth: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender *</label>
                  <select
                    className="form-input"
                    value={registerForm.gender}
                    onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Primary Contact Phone *</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +1-555-0123"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select
                    className="form-input"
                    value={registerForm.bloodGroup || ''}
                    onChange={(e) => setRegisterForm({ ...registerForm, bloodGroup: e.target.value || null })}
                  >
                    <option value="">Unknown / Not Tested</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. patient@example.local"
                  value={registerForm.email || ''}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Residential Address</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Street, City, Postal Code"
                  value={registerForm.address || ''}
                  onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Emergency Contact Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Mary Doe (Spouse)"
                    value={registerForm.emergencyContactName || ''}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergencyContactName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +1-555-0199"
                    value={registerForm.emergencyContactPhone || ''}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergencyContactPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Validating...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PATIENT DEMOGRAPHICS MODAL */}
      {showEditModal && selectedPatient && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Demographics: {selectedPatient.patientNumber}</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>

            {modalError && (
              <div className="login-alert alert-warning" style={{ margin: '1rem 0' }}>
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ marginTop: '1rem' }}>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select
                    className="form-input"
                    value={editForm.bloodGroup || ''}
                    onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value || null })}
                  >
                    <option value="">Unknown</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Update Demographics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE PATIENT CHART MODAL */}
      {showChartModal && selectedPatient && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '840px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FolderHeart size={22} color="#0d9488" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                    {selectedPatient.fullName}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Patient ID: <strong>{selectedPatient.patientNumber}</strong> • Registered: {new Date(selectedPatient.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowChartModal(false)}>×</button>
            </div>

            {/* CRITICAL ALLERGY BANNER IF HIGH RISK */}
            {activeChart?.demographics?.hasHighRiskAllergy && (
              <div style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '6px', margin: '0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldAlert size={22} />
                <div>
                  <strong>CRITICAL CLINICAL ALERT: HIGH-RISK ALLERGIES RECORDED</strong>
                  <div style={{ fontSize: '0.8rem' }}>
                    Patient has verified severe or life-threatening drug sensitivities. Review allergy tab before administering medications.
                  </div>
                </div>
              </div>
            )}

            {/* Patient Header Summary Pills */}
            <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-info">Age: {selectedPatient.age} yrs</span>
              <span className="badge badge-info">Gender: {selectedPatient.gender}</span>
              {selectedPatient.bloodGroup && <span className="badge badge-danger">Blood: {selectedPatient.bloodGroup}</span>}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phone: {selectedPatient.phone}</span>
              {selectedPatient.emergencyContactName && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ICE: {selectedPatient.emergencyContactName} ({selectedPatient.emergencyContactPhone})
                </span>
              )}
            </div>

            {/* Phase 12: Cross-Module Clinical Workflow Actions Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Fast Actions:
                </span>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0d9488', borderColor: '#99f6e4', backgroundColor: '#f0fdfa' }}
                  onClick={() => {
                    setShowChartModal(false);
                    navigateWithWorkflow('appointments', selectedPatient, 'book-appointment');
                  }}
                  title="Schedule a clinical appointment for this patient"
                >
                  <Calendar size={13} />
                  <span>Book Appointment</span>
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb', borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}
                  onClick={() => {
                    setShowChartModal(false);
                    navigateWithWorkflow('clinical', selectedPatient, 'start-encounter');
                  }}
                  title="Open clinical workstation to record SOAP encounter note"
                >
                  <FileText size={13} />
                  <span>Start Encounter</span>
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#7c3aed', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff' }}
                  onClick={() => {
                    setShowChartModal(false);
                    navigateWithWorkflow('billing', selectedPatient, 'view-invoices');
                  }}
                  title="View invoices and outstanding billing balance"
                >
                  <CreditCard size={13} />
                  <span>View Invoices</span>
                </button>
              </div>
            </div>

            {/* Chart Sub Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', padding: '0.5rem 0' }}>
              <button
                className={`btn btn-sm ${chartTab === 'summary' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setChartTab('summary')}
              >
                Medical Summary
              </button>
              <button
                className={`btn btn-sm ${chartTab === 'allergies' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setChartTab('allergies')}
              >
                Allergies ({activeChart?.allergies?.length ?? 0})
              </button>
              <button
                className={`btn btn-sm ${chartTab === 'conditions' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setChartTab('conditions')}
              >
                Conditions ({activeChart?.conditions?.length ?? 0})
              </button>
              <button
                className={`btn btn-sm ${chartTab === 'encounters' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setChartTab('encounters')}
              >
                Visits & Encounters ({activeChart?.recentEncounters?.length ?? 0})
              </button>
              <button
                className={`btn btn-sm ${chartTab === 'documents' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setChartTab('documents');
                  if (selectedPatient) loadPatientDocs(selectedPatient.id);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <FileText size={13} />
                <span>Documents & Scans ({patientDocs.length})</span>
              </button>
            </div>

            {/* Chart Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0' }}>
              {chartLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Activity size={24} className="spin" color="#0d9488" />
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading clinical chart...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: SUMMARY */}
                  {chartTab === 'summary' && activeChart && (
                    <div>
                      <div className="grid-3" style={{ marginBottom: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ENCOUNTERS</span>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {activeChart.recentEncounters?.length ?? 0}
                          </div>
                        </div>
                        <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CHRONIC CONDITIONS</span>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {activeChart.conditions?.length ?? 0}
                          </div>
                        </div>
                        <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OUTSTANDING BALANCE</span>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: ((activeChart.totalOutstandingBalance ?? activeChart.outstandingBalance ?? 0) > 0) ? '#b91c1c' : '#15803d' }}>
                            ${(activeChart.totalOutstandingBalance ?? activeChart.outstandingBalance ?? 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Recent Vitals */}
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>Latest Recorded Vitals</h4>
                      {(activeChart.recentVitals?.length ?? 0) === 0 ? (
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>No vitals recorded yet.</p>
                      ) : (
                        <div className="table-wrapper" style={{ marginTop: 0 }}>
                          <table className="desktop-table">
                            <thead>
                              <tr>
                                <th>Date / Time</th>
                                <th>Blood Pressure</th>
                                <th>Heart Rate</th>
                                <th>Temperature</th>
                                <th>SpO2</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeChart.recentVitals ?? []).map((v) => (
                                <tr key={v.id}>
                                  <td>{new Date(v.recordedAt).toLocaleString()}</td>
                                  <td>{v.bloodPressure}</td>
                                  <td>{v.heartRate ? `${v.heartRate} bpm` : '—'}</td>
                                  <td>{v.temperature ? `${v.temperature} °C` : '—'}</td>
                                  <td>{v.oxygenSaturation ? `${v.oxygenSaturation} %` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ALLERGIES */}
                  {chartTab === 'allergies' && activeChart && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Documented adverse sensitivities and reactions:
                        </span>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setModalError(null);
                            setShowAddAllergyModal(true);
                          }}
                        >
                          <Plus size={14} /> Add Allergy
                        </button>
                      </div>

                      {(activeChart.allergies?.length ?? 0) === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                          No drug or food allergies documented for this patient.
                        </div>
                      ) : (
                        <div className="table-wrapper" style={{ marginTop: 0 }}>
                          <table className="desktop-table">
                            <thead>
                              <tr>
                                <th>Allergen Substance</th>
                                <th>Clinical Reaction</th>
                                <th>Severity</th>
                                <th>Documented</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeChart.allergies ?? []).map((a) => {
                                const badge = getAllergySeverityBadge(a.severity);
                                return (
                                  <tr key={a.id}>
                                    <td><strong>{a.allergen}</strong></td>
                                    <td>{a.reaction}</td>
                                    <td>
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '4px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          backgroundColor: badge.bg,
                                          color: badge.color,
                                        }}
                                      >
                                        {badge.label}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                      {new Date(a.recordedAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button
                                        className="btn btn-danger-outline btn-sm"
                                        onClick={() => handleRemoveAllergy(a.id)}
                                        title="Delete Allergy"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: CONDITIONS */}
                  {chartTab === 'conditions' && activeChart && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Chronic conditions and active diagnoses:
                        </span>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setModalError(null);
                            setShowAddConditionModal(true);
                          }}
                        >
                          <Plus size={14} /> Add Condition
                        </button>
                      </div>

                      {(activeChart.conditions?.length ?? 0) === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                          No chronic medical conditions recorded.
                        </div>
                      ) : (
                        <div className="table-wrapper" style={{ marginTop: 0 }}>
                          <table className="desktop-table">
                            <thead>
                              <tr>
                                <th>Condition</th>
                                <th>Status</th>
                                <th>Diagnosed Date</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeChart.conditions ?? []).map((c) => (
                                <tr key={c.id}>
                                  <td><strong>{c.conditionName}</strong></td>
                                  <td><span className="badge badge-info">{c.status}</span></td>
                                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {c.diagnosedDate ? new Date(c.diagnosedDate).toLocaleDateString() : 'Historical'}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      onClick={() => handleRemoveCondition(c.id)}
                                    >
                                      Resolve
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: ENCOUNTERS */}
                  {chartTab === 'encounters' && activeChart && (
                    <div>
                      {(activeChart.recentEncounters?.length ?? 0) === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                          No prior encounters recorded for this patient.
                        </div>
                      ) : (
                        <div className="table-wrapper" style={{ marginTop: 0 }}>
                          <table className="desktop-table">
                            <thead>
                              <tr>
                                <th>Encounter Date</th>
                                <th>Doctor</th>
                                <th>Department</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeChart.recentEncounters ?? []).map((e) => (
                                <tr key={e.id}>
                                  <td>{new Date(e.encounterDate).toLocaleDateString()}</td>
                                  <td><strong>{e.doctorName}</strong></td>
                                  <td>{e.departmentName}</td>
                                  <td><span className="badge badge-success">{e.status}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: DOCUMENTS & SCANS */}
                  {chartTab === 'documents' && selectedPatient && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                            Patient Medical Documentation & Diagnostic Scans
                          </h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Radiology scans, lab reports, MRIs, X-rays, pathology and clinical records
                          </span>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setChartDocTitle('');
                            setChartDocFile(null);
                            setShowChartUploadModal(true);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <Upload size={14} />
                          <span>+ Attach Document / Scan</span>
                        </button>
                      </div>

                      {loadingDocs ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                          <RefreshCw size={24} className="spin" color="#0d9488" />
                          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading patient documents...</p>
                        </div>
                      ) : patientDocs.length === 0 ? (
                        <div style={{
                          padding: '3rem 1.5rem',
                          textAlign: 'center',
                          backgroundColor: '#f8fafc',
                          borderRadius: '12px',
                          border: '2px dashed #cbd5e1'
                        }}>
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            backgroundColor: '#e0f2fe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem auto'
                          }}>
                            <ImageIcon size={28} color="#0284c7" />
                          </div>
                          <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem' }}>No Documents or Scans Attached</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}>
                            Attach MRI scan pictures, chest X-rays, CT scans, blood test sheets, discharge summaries, or identity cards.
                          </p>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setChartDocTitle('');
                              setChartDocFile(null);
                              setShowChartUploadModal(true);
                            }}
                          >
                            <Upload size={14} style={{ marginRight: '0.35rem' }} />
                            Add Patient Document
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                          gap: '1rem'
                        }}>
                          {patientDocs.map((doc) => {
                            const isImage = doc.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(doc.fileName);
                            const isPdf = doc.mimeType === 'application/pdf' || /\.pdf$/i.test(doc.fileName);
                            const ext = doc.fileName.includes('.') ? doc.fileName.split('.').pop() : 'FILE';

                            return (
                              <div
                                key={doc.id}
                                onClick={() => handlePreviewDocument(doc)}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  textAlign: 'center',
                                  padding: '1rem 0.85rem',
                                  borderRadius: '12px',
                                  border: '1.5px solid #e2e8f0',
                                  background: '#ffffff',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-3px)';
                                  e.currentTarget.style.borderColor = '#0d9488';
                                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(13,148,136,0.12)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'none';
                                  e.currentTarget.style.borderColor = '#e2e8f0';
                                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
                                }}
                              >
                                {/* Square Icon/Thumbnail Container */}
                                <div style={{
                                  width: '72px',
                                  height: '72px',
                                  borderRadius: '10px',
                                  backgroundColor: isImage ? '#f0fdf4' : isPdf ? '#fef2f2' : '#f0f9ff',
                                  border: `1.5px solid ${isImage ? '#bbf7d0' : isPdf ? '#fecaca' : '#bae6fd'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginBottom: '0.75rem',
                                  position: 'relative'
                                }}>
                                  {isImage ? (
                                    <ImageIcon size={34} color="#16a34a" />
                                  ) : (
                                    <FileText size={34} color={isPdf ? '#dc2626' : '#0284c7'} />
                                  )}
                                  <span style={{
                                    position: 'absolute',
                                    bottom: '-5px',
                                    right: '-5px',
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    backgroundColor: '#0f172a',
                                    color: '#ffffff',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                                  }}>
                                    {ext}
                                  </span>
                                </div>

                                {/* Document Name */}
                                <strong style={{
                                  fontSize: '0.85rem',
                                  lineHeight: '1.25',
                                  color: '#0f172a',
                                  marginBottom: '0.35rem',
                                  wordBreak: 'break-word',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  minHeight: '2.1rem'
                                }} title={doc.fileName}>
                                  {doc.fileName}
                                </strong>

                                {/* Upload Date Tag */}
                                <div style={{
                                  fontSize: '0.72rem',
                                  color: '#64748b',
                                  marginBottom: '0.4rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}>
                                  <Calendar size={11} />
                                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                </div>

                                {/* Category & Size Badge */}
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                                  <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                    {DOCUMENT_CATEGORY_NAMES[doc.category] || doc.categoryName}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                    {formatDocBytes(doc.sizeBytes)}
                                  </span>
                                </div>

                                {/* Quick Action Bar */}
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '0.35rem',
                                    marginTop: '0.75rem',
                                    paddingTop: '0.5rem',
                                    borderTop: '1px solid #f1f5f9',
                                    width: '100%',
                                    justifyContent: 'center'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() => handlePreviewDocument(doc)}
                                    title="View Image / Scan"
                                    style={{ padding: '0.25rem 0.45rem', fontSize: '0.7rem', color: '#0d9488', borderColor: '#99f6e4' }}
                                  >
                                    <Eye size={12} />
                                    <span style={{ marginLeft: '2px' }}>View</span>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() => api.downloadDocument(doc.id, doc.fileName)}
                                    title="Download File"
                                    style={{ padding: '0.25rem 0.45rem', fontSize: '0.7rem' }}
                                  >
                                    <Download size={12} color="#0284c7" />
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() => handleDeletePatientDoc(doc)}
                                    title="Delete Record"
                                    style={{ padding: '0.25rem 0.45rem', fontSize: '0.7rem', borderColor: '#fecaca' }}
                                  >
                                    <Trash2 size={12} color="#ef4444" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowChartModal(false)}>
                Close Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ALLERGY MODAL */}
      {showAddAllergyModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Record Allergy / Sensitivity</h3>
              <button className="modal-close" onClick={() => setShowAddAllergyModal(false)}>×</button>
            </div>

            {modalError && (
              <div className="login-alert alert-warning" style={{ margin: '1rem 0' }}>
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddAllergySubmit} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Allergen Substance *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Penicillin, Codeine, Peanuts"
                  value={allergyForm.allergen}
                  onChange={(e) => setAllergyForm({ ...allergyForm, allergen: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Reaction *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Anaphylaxis, hives, bronchospasm"
                  value={allergyForm.reaction}
                  onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Severity Level</label>
                <select
                  className="form-input"
                  value={allergyForm.severity}
                  onChange={(e) => setAllergyForm({ ...allergyForm, severity: parseInt(e.target.value) as AllergySeverity })}
                >
                  <option value={0}>Mild (Minor rash / discomfort)</option>
                  <option value={1}>Moderate (Urticaria, gastrointestinal)</option>
                  <option value={2}>Severe (Facial edema, bronchospasm)</option>
                  <option value={3}>Life-Threatening (Anaphylactic shock)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddAllergyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Add Allergy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CONDITION MODAL */}
      {showAddConditionModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Record Chronic Condition</h3>
              <button className="modal-close" onClick={() => setShowAddConditionModal(false)}>×</button>
            </div>

            {modalError && (
              <div className="login-alert alert-warning" style={{ margin: '1rem 0' }}>
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddConditionSubmit} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Condition Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Type 2 Diabetes, Hypertension"
                  value={conditionForm.conditionName}
                  onChange={(e) => setConditionForm({ ...conditionForm, conditionName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Status</label>
                <select
                  className="form-input"
                  value={conditionForm.status}
                  onChange={(e) => setConditionForm({ ...conditionForm, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Controlled">Controlled</option>
                  <option value="In Remission">In Remission</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Diagnosed Date (Optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={conditionForm.diagnosedDate || ''}
                  onChange={(e) => setConditionForm({ ...conditionForm, diagnosedDate: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddConditionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Record Condition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ATTACH PATIENT DOCUMENT / SCAN MODAL */}
      {showChartUploadModal && selectedPatient && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Attach Patient Documentation or Scan</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Patient: <strong>{selectedPatient.fullName}</strong> ({selectedPatient.patientNumber})
                </span>
              </div>
              <button className="modal-close" onClick={() => setShowChartUploadModal(false)}>×</button>
            </div>

            <form onSubmit={handleChartUploadSubmit} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Document Name / Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Brain MRI Scan, Chest X-Ray, Blood Chemistry Report"
                  value={chartDocTitle}
                  onChange={(e) => setChartDocTitle(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Stored name will include today's date: <strong>{chartDocTitle.trim() ? `${chartDocTitle.trim()} - ${new Date().toISOString().split('T')[0]}` : `[Document Name] - ${new Date().toISOString().split('T')[0]}`}</strong>
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-input"
                  value={chartDocCategory}
                  onChange={(e) => setChartDocCategory(parseInt(e.target.value, 10) as DocumentCategory)}
                >
                  <option value={3}>Diagnostic Scan / Imaging (MRI, X-Ray, CT, Ultrasound)</option>
                  <option value={1}>Laboratory Report (Blood, Pathology, Urine)</option>
                  <option value={0}>General Clinical Document</option>
                  <option value={2}>Prescription & Medication Order</option>
                  <option value={4}>Specialist Referral</option>
                  <option value={5}>Patient Identity & Insurance Card</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select File / Scan Image from Computer *</label>
                <input
                  type="file"
                  className="form-input"
                  accept="image/*,application/pdf,.dicom,.dcm,text/plain"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const file = e.target.files[0];
                      setChartDocFile(file);
                      if (!chartDocTitle.trim()) {
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                        setChartDocTitle(nameWithoutExt);
                      }
                    }
                  }}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Supports JPEG, PNG, WEBP, PDF, DICOM up to 25 MB.
                </span>
              </div>

              <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowChartUploadModal(false)}
                  disabled={chartUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={chartUploading || !chartDocFile || !chartDocTitle.trim()}
                >
                  {chartUploading ? 'Uploading & Hashing...' : 'Upload & Save to Chart'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PATIENT DOCUMENT / SCAN IMAGE LIGHTBOX PREVIEW MODAL */}
      {previewDoc && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '880px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={22} color="#0d9488" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', wordBreak: 'break-all' }}>
                    {previewDoc.doc.fileName}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Patient: <strong>{previewDoc.doc.patientName}</strong> • Date Added: <strong>{new Date(previewDoc.doc.createdAt).toLocaleDateString()}</strong> • Category: {DOCUMENT_CATEGORY_NAMES[previewDoc.doc.category] || previewDoc.doc.categoryName}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => api.downloadDocument(previewDoc.doc.id, previewDoc.doc.fileName)}
                  title="Download file"
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                <button className="modal-close" onClick={() => setPreviewDoc(null)}>×</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', textAlign: 'center', background: '#0f172a', borderRadius: '8px', minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewLoading ? (
                <div style={{ padding: '3rem', color: '#94a3b8' }}>
                  <RefreshCw size={26} className="spin" color="#0d9488" />
                  <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>Streaming scan image from storage...</p>
                </div>
              ) : previewDoc.url ? (
                previewDoc.doc.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(previewDoc.doc.fileName) ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.doc.fileName}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '68vh',
                      objectFit: 'contain',
                      borderRadius: '6px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                    }}
                  />
                ) : previewDoc.doc.mimeType === 'application/pdf' || /\.pdf$/i.test(previewDoc.doc.fileName) ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.doc.fileName}
                    style={{ width: '100%', height: '68vh', border: 'none', borderRadius: '6px', background: '#ffffff' }}
                  />
                ) : (
                  <div style={{ padding: '3rem', background: '#ffffff', borderRadius: '8px', maxWidth: '420px', margin: '0 auto' }}>
                    <FileText size={48} color="#0d9488" style={{ marginBottom: '1rem' }} />
                    <h4 style={{ color: '#0f172a' }}>{previewDoc.doc.fileName}</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Binary file format ({previewDoc.doc.mimeType}) requires direct download.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => api.downloadDocument(previewDoc.doc.id, previewDoc.doc.fileName)}
                    >
                      <Download size={16} /> Download File ({formatDocBytes(previewDoc.doc.sizeBytes)})
                    </button>
                  </div>
                )
              ) : (
                <div style={{ color: '#94a3b8' }}>
                  Preview stream is not available for this record.
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Size: <strong>{formatDocBytes(previewDoc.doc.sizeBytes)}</strong> • Checksum: <code>{previewDoc.doc.sha256Hash?.substring(0, 16)}...</code>
              </span>
              <button className="btn btn-outline" onClick={() => setPreviewDoc(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
