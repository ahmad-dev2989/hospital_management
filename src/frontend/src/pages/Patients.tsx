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
  CreditCard
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
  type ApiError
} from '../api/client';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];

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
  const [chartTab, setChartTab] = useState<'summary' | 'allergies' | 'conditions' | 'encounters'>('summary');
  const [selectedPatient, setSelectedPatient] = useState<PatientDto | null>(null);

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

  const handleOpenChart = async (patient: PatientDto) => {
    setSelectedPatient(patient);
    setActivePatient(patient); // Phase 12: Synchronize globally active patient
    setChartLoading(true);
    setShowChartModal(true);
    setChartTab('summary');
    try {
      const chart = await api.getPatientChart(patient.id);
      setActiveChart(chart);
    } catch (err: any) {
      toast.error(err.message || 'Error loading clinical chart', 'Patient Chart Error');
    } finally {
      setChartLoading(false);
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
    </div>
  );
};
