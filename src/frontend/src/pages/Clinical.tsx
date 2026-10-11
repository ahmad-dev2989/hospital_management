import React, { useState, useEffect } from 'react';
import {
  FileText,
  Activity,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Lock,
  Pill,
  Save,
  Tag
} from 'lucide-react';
import {
  api,
  type EncounterDto,
  type EncounterStatus,
  type DoctorDto,
  type PatientDto,
  type DrugDto,
  type Icd10CatalogItemDto,
  type ApiError
} from '../api/client';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';

export const Clinical: React.FC = () => {
  const {
    activePatient,
    setActivePatient,
    workflowAction,
    clearWorkflowAction
  } = useNavigation();
  const toast = useToast();

  const [encounters, setEncounters] = useState<EncounterDto[]>([]);
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Lookups
  const [doctors, setDoctors] = useState<DoctorDto[]>([]);
  const [formularyDrugs, setFormularyDrugs] = useState<DrugDto[]>([]);
  const [icdCatalog, setIcdCatalog] = useState<Icd10CatalogItemDto[]>([]);

  // Modals state
  const [showStartModal, setShowStartModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showRxModal, setShowRxModal] = useState(false);
  const [showAddendumModal, setShowAddendumModal] = useState(false);

  // Active Workstation Tab
  const [workstationTab, setWorkstationTab] = useState<'soap' | 'vitals' | 'diagnoses' | 'prescriptions'>('soap');

  // Start Encounter Form
  const [patientSearch, setPatientSearch] = useState('');
  const [matchingPatients, setMatchingPatients] = useState<PatientDto[]>([]);
  const [newEncPatient, setNewEncPatient] = useState<PatientDto | null>(null);
  const [newEncDoctorId, setNewEncDoctorId] = useState('');
  const [newEncComplaint, setNewEncComplaint] = useState('');

  // SOAP Note Form
  const [soapComplaint, setSoapComplaint] = useState('');
  const [soapHpi, setSoapHpi] = useState('');
  const [soapExam, setSoapExam] = useState('');
  const [soapAssessment, setSoapAssessment] = useState('');
  const [soapPlan, setSoapPlan] = useState('');
  const [soapSaving, setSoapSaving] = useState(false);

  // Addendum Form
  const [addendumReason, setAddendumReason] = useState('');
  const [addendumComplaint, setAddendumComplaint] = useState('');
  const [addendumHpi, setAddendumHpi] = useState('');
  const [addendumExam, setAddendumExam] = useState('');
  const [addendumAssessment, setAddendumAssessment] = useState('');
  const [addendumPlan, setAddendumPlan] = useState('');

  // Vitals Form
  const [sysBp, setSysBp] = useState<string>('');
  const [diaBp, setDiaBp] = useState<string>('');
  const [hrBpm, setHrBpm] = useState<string>('');
  const [rrBpm, setRrBpm] = useState<string>('');
  const [tempC, setTempC] = useState<string>('');
  const [spo2Pct, setSpo2Pct] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');

  // Diagnosis Form
  const [diagCode, setDiagCode] = useState('');
  const [diagDesc, setDiagDesc] = useState('');
  const [diagIsPrimary, setDiagIsPrimary] = useState(false);

  // Prescription Form
  const [rxDrugId, setRxDrugId] = useState('');
  const [rxDosage, setRxDosage] = useState('500mg');
  const [rxFrequency, setRxFrequency] = useState('TDS (Three times daily)');
  const [rxRoute, setRxRoute] = useState('Oral');
  const [rxDuration, setRxDuration] = useState('7');
  const [rxQty, setRxQty] = useState('21');
  const [rxInstructions, setRxInstructions] = useState('Take with food');
  const [rxAllergyWarning, setRxAllergyWarning] = useState<string | null>(null);

  // Feedback Toast
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => {
    toast.success(msg);
  };

  // 1. Initial lookups
  useEffect(() => {
    const initLookups = async () => {
      try {
        const [docs, drugs, icd] = await Promise.all([
          api.getDoctors(),
          api.getFormularyDrugs(),
          api.getIcd10Catalog(),
        ]);
        setDoctors(docs);
        setFormularyDrugs(drugs);
        setIcdCatalog(icd);
        if (docs.length > 0) setNewEncDoctorId(docs[0].id);
        if (drugs.length > 0) setRxDrugId(drugs[0].id);
      } catch (err) {
        console.error('Failed to load clinical lookups:', err);
      }
    };
    initLookups();
  }, []);

  // 2. Fetch encounters list
  const fetchEncounters = async () => {
    setLoading(true);
    try {
      let st: EncounterStatus | undefined = undefined;
      if (statusFilter === 'active') st = 1; // InProgress
      else if (statusFilter === 'signed') st = 3; // Signed
      else if (statusFilter === 'amended') st = 5; // AmendedByAddendum

      const res = await api.getEncounters({
        date: selectedDate || undefined,
        status: st,
        query: searchQuery.trim() || undefined,
        pageSize: 50,
      });

      setEncounters(res.items);
      if (res.items.length > 0 && !selectedEncounter) {
        loadEncounterDetails(res.items[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch encounters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEncounters();
  }, [statusFilter, selectedDate]);

  // Phase 12: Handle cross-module workflow actions
  useEffect(() => {
    if (workflowAction) {
      if (workflowAction.action === 'start-encounter') {
        if (activePatient) {
          setNewEncPatient(activePatient);
          setPatientSearch(`${activePatient.fullName} (${activePatient.patientNumber})`);
        }
        setShowStartModal(true);
        clearWorkflowAction();
      }
    }
  }, [workflowAction, activePatient]);

  const handleOpenStartModal = () => {
    if (activePatient && !newEncPatient) {
      setNewEncPatient(activePatient);
      setPatientSearch(`${activePatient.fullName} (${activePatient.patientNumber})`);
    }
    setShowStartModal(true);
  };

  // 3. Load full encounter details
  const loadEncounterDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const full = await api.getEncounterById(id);
      setSelectedEncounter(full);
      // Phase 12: Synchronize globally active patient context
      const pDto: PatientDto = {
        id: full.patientId,
        patientNumber: full.patientNumber,
        firstName: full.patientName.split(' ')[0] || '',
        lastName: full.patientName.split(' ').slice(1).join(' ') || '',
        fullName: full.patientName,
        dateOfBirth: '',
        age: full.patientAge,
        gender: full.patientGender,
        bloodGroup: full.patientBloodGroup ?? null,
        phone: '',
        email: null,
        address: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        isActive: true,
        allergiesCount: full.patientAllergies?.length ?? 0,
        hasHighRiskAllergy: full.patientHasHighRiskAllergy,
        createdAt: '',
        updatedAt: ''
      };
      setActivePatient(pDto);

      // Sync SOAP form with latest note
      const latestNote = full.notes.length > 0 ? full.notes[full.notes.length - 1] : null;
      if (latestNote) {
        setSoapComplaint(latestNote.chiefComplaint || '');
        setSoapHpi(latestNote.historyOfPresentIllness || '');
        setSoapExam(latestNote.examinationFindings || '');
        setSoapAssessment(latestNote.assessment || '');
        setSoapPlan(latestNote.treatmentPlan || '');
      } else {
        setSoapComplaint('');
        setSoapHpi('');
        setSoapExam('');
        setSoapAssessment('');
        setSoapPlan('');
      }
    } catch (err) {
      console.error('Failed to load encounter details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // 4. Patient search for start encounter
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patientSearch.trim().length >= 2) {
        try {
          const res = await api.getPatients({ query: patientSearch.trim(), pageSize: 6 });
          setMatchingPatients(res.items);
        } catch {
          setMatchingPatients([]);
        }
      } else {
        setMatchingPatients([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // 5. Check prescription drug for patient allergy
  useEffect(() => {
    if (!selectedEncounter || !rxDrugId) {
      setRxAllergyWarning(null);
      return;
    }

    const drug = formularyDrugs.find((d) => d.id === rxDrugId);
    if (!drug) return;

    const match = selectedEncounter.patientAllergies.find((a) =>
      a.toLowerCase().includes(drug.genericName.toLowerCase()) ||
      drug.genericName.toLowerCase().includes(a.toLowerCase()) ||
      a.toLowerCase().includes(drug.brandName.toLowerCase())
    );

    if (match) {
      setRxAllergyWarning(`CRITICAL ALLERGY ALERT: Patient is allergic to "${match}". Prescribing ${drug.brandName} (${drug.genericName}) may cause an adverse reaction!`);
    } else {
      setRxAllergyWarning(null);
    }
  }, [rxDrugId, selectedEncounter]);

  // Actions
  const handleStartEncounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEncPatient) {
      alert('Please select a patient.');
      return;
    }
    if (!newEncDoctorId) {
      alert('Please select an attending doctor.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.startEncounter({
        patientId: newEncPatient.id,
        doctorId: newEncDoctorId,
        chiefComplaint: newEncComplaint.trim() || undefined,
      });

      showToast(`Encounter started for ${newEncPatient.fullName}.`);
      setShowStartModal(false);
      setNewEncPatient(null);
      setPatientSearch('');
      setNewEncComplaint('');
      await fetchEncounters();
      loadEncounterDetails(res.id);
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to start encounter.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSoapNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncounter) return;
    if (!soapComplaint.trim()) {
      alert('Chief Complaint is required.');
      return;
    }

    setSoapSaving(true);
    try {
      await api.saveClinicalNote(selectedEncounter.id, {
        chiefComplaint: soapComplaint.trim(),
        historyOfPresentIllness: soapHpi.trim() || undefined,
        examinationFindings: soapExam.trim() || undefined,
        assessment: soapAssessment.trim() || undefined,
        treatmentPlan: soapPlan.trim() || undefined,
      });

      showToast('Clinical SOAP note saved successfully.');
      loadEncounterDetails(selectedEncounter.id);
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to save note.');
    } finally {
      setSoapSaving(false);
    }
  };

  const handleAddAddendumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncounter || selectedEncounter.notes.length === 0) return;
    if (!addendumReason.trim()) {
      alert('Amendment reason is required.');
      return;
    }

    const latestNote = selectedEncounter.notes[selectedEncounter.notes.length - 1];
    setActionLoading(true);
    try {
      await api.addNoteAddendum(selectedEncounter.id, {
        supersedesNoteId: latestNote.id,
        amendmentReason: addendumReason.trim(),
        chiefComplaint: addendumComplaint.trim() || latestNote.chiefComplaint,
        historyOfPresentIllness: addendumHpi.trim() || undefined,
        examinationFindings: addendumExam.trim() || undefined,
        assessment: addendumAssessment.trim() || undefined,
        treatmentPlan: addendumPlan.trim() || undefined,
      });

      showToast('Versioned addendum sealed into clinical record.');
      setShowAddendumModal(false);
      setAddendumReason('');
      loadEncounterDetails(selectedEncounter.id);
      fetchEncounters();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to add addendum.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordVitalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncounter) return;

    setActionLoading(true);
    try {
      const v = await api.recordVitalSigns(selectedEncounter.id, {
        systolicBp: sysBp ? parseInt(sysBp) : undefined,
        diastolicBp: diaBp ? parseInt(diaBp) : undefined,
        heartRateBpm: hrBpm ? parseInt(hrBpm) : undefined,
        respiratoryRateBpm: rrBpm ? parseInt(rrBpm) : undefined,
        temperatureCelsius: tempC ? parseFloat(tempC) : undefined,
        oxygenSaturationPct: spo2Pct ? parseFloat(spo2Pct) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
      });

      showToast(`Vitals recorded. ${v.isAbnormal ? '⚠️ Abnormalities flagged.' : 'Normal.'}`);
      setShowVitalsModal(false);
      setSysBp('');
      setDiaBp('');
      setHrBpm('');
      setRrBpm('');
      setTempC('');
      setSpo2Pct('');
      setWeightKg('');
      setHeightCm('');
      loadEncounterDetails(selectedEncounter.id);
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to record vitals.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddDiagnosisSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncounter) return;
    if (!diagDesc.trim()) {
      alert('Diagnosis description is required.');
      return;
    }

    setActionLoading(true);
    try {
      await api.addDiagnosis(selectedEncounter.id, {
        icd10Code: diagCode.trim() || undefined,
        description: diagDesc.trim(),
        isPrimary: diagIsPrimary,
      });

      showToast('Diagnosis recorded.');
      setShowDiagnosisModal(false);
      setDiagCode('');
      setDiagDesc('');
      setDiagIsPrimary(false);
      loadEncounterDetails(selectedEncounter.id);
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to record diagnosis.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveDiagnosis = async (diagId: string) => {
    if (!selectedEncounter) return;
    if (!confirm('Remove this diagnosis from encounter?')) return;
    try {
      await api.removeDiagnosis(selectedEncounter.id, diagId);
      showToast('Diagnosis removed.');
      loadEncounterDetails(selectedEncounter.id);
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to remove diagnosis.');
    }
  };

  const handleCreatePrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncounter) return;
    if (!rxDrugId) {
      alert('Please select a medication from formulary.');
      return;
    }

    setActionLoading(true);
    try {
      const rx = await api.createPrescription(selectedEncounter.id, {
        items: [
          {
            drugId: rxDrugId,
            dosage: rxDosage.trim(),
            frequency: rxFrequency.trim(),
            route: rxRoute.trim(),
            durationDays: parseInt(rxDuration) || 7,
            quantityPrescribed: parseInt(rxQty) || 1,
            instructions: rxInstructions.trim() || undefined,
          },
        ],
      });

      showToast(`Prescription ${rx.prescriptionNumber} generated & signed.`);
      setShowRxModal(false);
      loadEncounterDetails(selectedEncounter.id);
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to create prescription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignAndCloseEncounter = async () => {
    if (!selectedEncounter) return;
    if (
      !confirm(
        `Are you sure you want to sign and close this clinical encounter for ${selectedEncounter.patientName}?\n\nThis permanently seals the medical notes into an immutable legal health record. Any subsequent revisions will require a formal addendum.`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await api.signAndCloseEncounter(selectedEncounter.id);
      showToast('Clinical encounter signed, sealed, and closed.');
      loadEncounterDetails(selectedEncounter.id);
      fetchEncounters();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to sign encounter.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: EncounterStatus) => {
    switch (status) {
      case 0: // Open
        return <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>Open</span>;
      case 1: // InProgress
        return <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>In Progress</span>;
      case 2: // Draft
        return <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>Draft</span>;
      case 3: // Signed
        return <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>Signed & Sealed</span>;
      case 4: // Closed
        return <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>Closed</span>;
      case 5: // AmendedByAddendum
        return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>Amended by Addendum</span>;
      default:
        return <span className="badge">Unknown</span>;
    }
  };

  return (
    <div className="module-container" style={{ padding: '0 0.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={22} color="var(--primary)" />
            Clinical Encounters & EMR Workstation
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Module D • SOAP clinical documentation, vital sign evaluation, ICD-10 diagnostic coding, and e-prescribing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            className="btn btn-outline"
            onClick={fetchEncounters}
            disabled={loading}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenStartModal}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            Start Clinical Encounter
          </button>
        </div>
      </div>

      {/* Split Workstation Layout: Left Master List / Right Detail Workstation */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* LEFT COLUMN: ENCOUNTERS WORKLIST */}
        <div className="card" style={{ padding: '1rem', height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
          {/* Filter Bar */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <input
                type="text"
                placeholder="Search patient or physician..."
                className="input-field"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchEncounters()}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', flex: 1 }}
              />
              <button
                className="btn btn-outline"
                onClick={fetchEncounters}
                style={{ padding: '0.35rem 0.6rem' }}
                title="Search"
              >
                <Search size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.6rem' }}>
              <input
                type="date"
                className="input-field"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem', flex: 1 }}
                title="Filter by encounter date"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'In Progress' },
                { id: 'signed', label: 'Signed' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStatusFilter(t.id)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: statusFilter === t.id ? 'var(--primary)' : '#f1f5f9',
                    color: statusFilter === t.id ? '#fff' : '#64748b',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Encounters */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <RefreshCw size={18} className="spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading encounters...</span>
              </div>
            ) : encounters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No clinical encounters found.
              </div>
            ) : (
              encounters.map((enc) => {
                const isSelected = selectedEncounter?.id === enc.id;
                return (
                  <div
                    key={enc.id}
                    onClick={() => loadEncounterDetails(enc.id)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#f0fdfa' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{enc.patientName}</strong>
                      {getStatusBadge(enc.status)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {enc.patientNumber} • {enc.patientAge}y/{enc.patientGender}
                    </div>

                    {enc.patientHasHighRiskAllergy && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          marginTop: '0.35rem',
                        }}
                      >
                        <AlertTriangle size={11} /> High-Risk Allergies
                      </div>
                    )}

                    <div style={{ fontSize: '0.775rem', color: '#475569', marginTop: '0.4rem' }}>
                      Physician: <strong>{enc.doctorName}</strong>
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      Started: {new Date(enc.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(enc.startedAt).toLocaleDateString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: EMR WORKSTATION */}
        <div className="card" style={{ padding: '1.25rem', minHeight: 'calc(100vh - 180px)' }}>
          {detailsLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <RefreshCw size={24} className="spin" color="var(--primary)" style={{ margin: '0 auto 1rem auto' }} />
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Retrieving electronic health record...</div>
            </div>
          ) : !selectedEncounter ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <FileText size={40} color="#cbd5e1" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>No Encounter Selected</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>Select an encounter from the worklist on the left to review or chart clinical documentation.</p>
            </div>
          ) : (
            <div>
              {/* Encounter Header Banner */}
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                      {selectedEncounter.patientName}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ({selectedEncounter.patientNumber})
                    </span>
                    {getStatusBadge(selectedEncounter.status)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>
                    Age: <strong>{selectedEncounter.patientAge}</strong> • Gender: <strong>{selectedEncounter.patientGender}</strong> • Blood: <strong>{selectedEncounter.patientBloodGroup || 'N/A'}</strong> • Attending: <strong>{selectedEncounter.doctorName}</strong> ({selectedEncounter.specialization})
                  </div>

                  {/* Allergy Banner if patient has documented allergies */}
                  {selectedEncounter.patientAllergies.length > 0 && (
                    <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <AlertTriangle size={13} /> Documented Allergies:
                      </span>
                      {selectedEncounter.patientAllergies.map((all, idx) => (
                        <span key={idx} style={{ fontSize: '0.725rem', backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                          {all}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Encounter Status Control Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {selectedEncounter.status !== 3 && selectedEncounter.status !== 4 && (
                    <button
                      className="btn btn-primary"
                      onClick={handleSignAndCloseEncounter}
                      disabled={actionLoading}
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      title="Permanently sign and finalize this clinical encounter"
                    >
                      <Lock size={14} />
                      Sign & Seal Record
                    </button>
                  )}

                  {(selectedEncounter.status === 3 || selectedEncounter.status === 5) && (
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        const latest = selectedEncounter.notes[selectedEncounter.notes.length - 1];
                        setAddendumReason('');
                        setAddendumComplaint(latest?.chiefComplaint || '');
                        setAddendumHpi(latest?.historyOfPresentIllness || '');
                        setAddendumExam(latest?.examinationFindings || '');
                        setAddendumAssessment(latest?.assessment || '');
                        setAddendumPlan(latest?.treatmentPlan || '');
                        setShowAddendumModal(true);
                      }}
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Plus size={14} />
                      Add Addendum
                    </button>
                  )}
                </div>
              </div>

              {/* Workstation Navigation Tabs */}
              <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                {[
                  { id: 'soap', label: `Clinical SOAP Notes (${selectedEncounter.notes.length})`, icon: FileText },
                  { id: 'vitals', label: `Vital Signs (${selectedEncounter.vitalSigns.length})`, icon: Activity },
                  { id: 'diagnoses', label: `Diagnoses (${selectedEncounter.diagnoses.length})`, icon: Tag },
                  { id: 'prescriptions', label: `E-Prescriptions (${selectedEncounter.prescriptions.length})`, icon: Pill },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setWorkstationTab(tab.id as any)}
                      style={{
                        padding: '0.5rem 0.9rem',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        borderBottom: workstationTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        backgroundColor: 'transparent',
                        color: workstationTab === tab.id ? 'var(--primary)' : '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: SOAP CLINICAL NOTES */}
              {workstationTab === 'soap' && (
                <div>
                  {selectedEncounter.notes.length > 1 && (
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-muted)' }}>Note History:</span>
                      {selectedEncounter.notes.map((n) => (
                        <span
                          key={n.id}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: n.supersedesNoteId ? '#f3e8ff' : '#f1f5f9',
                            color: n.supersedesNoteId ? '#6b21a8' : '#334155',
                            fontWeight: 600,
                          }}
                        >
                          v{n.version} {n.supersedesNoteId ? '(Addendum)' : '(Original)'} {n.isFinalized ? '🔒' : '✏️'}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedEncounter.status === 3 || selectedEncounter.status === 4 ? (
                    <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontWeight: 600, fontSize: '0.85rem', marginBottom: '1rem' }}>
                        <Lock size={16} /> Sealed & Signed Legal Medical Record
                      </div>

                      {selectedEncounter.notes.map((n) => (
                        <div key={n.id} style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                            Version {n.version} {n.amendmentReason ? `• Addendum: "${n.amendmentReason}"` : ''} ({new Date(n.createdAt).toLocaleString()})
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                              <strong style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>CHIEF COMPLAINT</strong>
                              <p style={{ margin: '0.2rem 0 0.8rem 0', fontSize: '0.85rem' }}>{n.chiefComplaint}</p>

                              <strong style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>SUBJECTIVE (HPI)</strong>
                              <p style={{ margin: '0.2rem 0 0.8rem 0', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{n.historyOfPresentIllness || 'None recorded'}</p>
                            </div>

                            <div>
                              <strong style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>OBJECTIVE (EXAMINATION)</strong>
                              <p style={{ margin: '0.2rem 0 0.8rem 0', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{n.examinationFindings || 'None recorded'}</p>

                              <strong style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>ASSESSMENT (DIAGNOSTIC IMPRESSION)</strong>
                              <p style={{ margin: '0.2rem 0 0.8rem 0', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{n.assessment || 'None recorded'}</p>

                              <strong style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>PLAN (TREATMENT & ORDERS)</strong>
                              <p style={{ margin: '0.2rem 0 0.8rem 0', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{n.treatmentPlan || 'None recorded'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <form onSubmit={handleSaveSoapNote}>
                      <div style={{ marginBottom: '1rem' }}>
                        <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                          Chief Complaint *
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. Throbbing migraine, productive cough, right knee pain..."
                          value={soapComplaint}
                          onChange={(e) => setSoapComplaint(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                            Subjective: History of Present Illness (HPI)
                          </label>
                          <textarea
                            className="input-field"
                            rows={4}
                            placeholder="Patient reports symptoms started 3 days ago, worsening at night, no previous history..."
                            value={soapHpi}
                            onChange={(e) => setSoapHpi(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                            Objective: Examination Findings
                          </label>
                          <textarea
                            className="input-field"
                            rows={4}
                            placeholder="Physical exam: Clear lung fields bilaterally, abdomen soft, no pedal edema..."
                            value={soapExam}
                            onChange={(e) => setSoapExam(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid-2" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                            Assessment: Clinical Impression & Working Diagnosis
                          </label>
                          <textarea
                            className="input-field"
                            rows={4}
                            placeholder="Acute viral upper respiratory tract infection, mild dehydration..."
                            value={soapAssessment}
                            onChange={(e) => setSoapAssessment(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                            Plan: Treatment, Prescriptions & Follow-up
                          </label>
                          <textarea
                            className="input-field"
                            rows={4}
                            placeholder="Oral fluids, paracetamol 500mg TDS, rest for 48h, review in clinic if fever persists..."
                            value={soapPlan}
                            onChange={(e) => setSoapPlan(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={soapSaving || !soapComplaint.trim()}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <Save size={15} />
                          {soapSaving ? 'Saving...' : 'Save Draft SOAP Note'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 2: VITAL SIGNS */}
              {workstationTab === 'vitals' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Encounter Vital Signs Timeline</h3>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowVitalsModal(true)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Plus size={14} /> Record Vitals
                    </button>
                  </div>

                  {selectedEncounter.vitalSigns.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '6px', color: 'var(--text-muted)' }}>
                      No vital signs recorded for this encounter yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {selectedEncounter.vitalSigns.map((v) => (
                        <div
                          key={v.id}
                          style={{
                            padding: '1rem',
                            borderRadius: '8px',
                            border: v.isAbnormal ? '1px solid #fecaca' : '1px solid #e2e8f0',
                            backgroundColor: v.isAbnormal ? '#fff5f5' : '#fff',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Recorded at {new Date(v.recordedAt).toLocaleTimeString()} by <strong>{v.recordedByUserName}</strong>
                            </span>
                            {v.isAbnormal ? (
                              <span className="badge badge-danger">Abnormal Findings</span>
                            ) : (
                              <span className="badge badge-success">All Normal</span>
                            )}
                          </div>

                          {/* Abnormal Alerts Bar */}
                          {v.abnormalAlerts.length > 0 && (
                            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {v.abnormalAlerts.map((alt, idx) => (
                                <span key={idx} style={{ fontSize: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                  ⚠️ {alt}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Metric Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                            <div style={{ padding: '0.4rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BP (mmHg)</span>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {v.systolicBp && v.diastolicBp ? `${v.systolicBp}/${v.diastolicBp}` : '—'}
                              </div>
                              <span style={{ fontSize: '0.675rem', color: '#64748b' }}>{v.bpCategory || ''}</span>
                            </div>

                            <div style={{ padding: '0.4rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Heart Rate</span>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {v.heartRateBpm ? `${v.heartRateBpm} bpm` : '—'}
                              </div>
                            </div>

                            <div style={{ padding: '0.4rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Temp (°C)</span>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {v.temperatureCelsius ? `${v.temperatureCelsius}°C` : '—'}
                              </div>
                            </div>

                            <div style={{ padding: '0.4rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SpO2 (%)</span>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {v.oxygenSaturationPct ? `${v.oxygenSaturationPct}%` : '—'}
                              </div>
                            </div>

                            <div style={{ padding: '0.4rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Resp Rate</span>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {v.respiratoryRateBpm ? `${v.respiratoryRateBpm}/min` : '—'}
                              </div>
                            </div>

                            <div style={{ padding: '0.4rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BMI</span>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {v.bmi ? v.bmi : '—'}
                              </div>
                              <span style={{ fontSize: '0.675rem', color: '#64748b' }}>{v.bmiCategory || ''}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: DIAGNOSES */}
              {workstationTab === 'diagnoses' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>ICD-10 Diagnostic Findings</h3>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowDiagnosisModal(true)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Plus size={14} /> Add Diagnosis
                    </button>
                  </div>

                  {selectedEncounter.diagnoses.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '6px', color: 'var(--text-muted)' }}>
                      No diagnoses documented for this encounter. Click "Add Diagnosis" to record ICD-10 conditions.
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="desktop-table">
                        <thead>
                          <tr>
                            <th style={{ width: '120px' }}>ICD-10 Code</th>
                            <th>Description</th>
                            <th style={{ width: '110px' }}>Priority</th>
                            <th style={{ width: '140px' }}>Recorded</th>
                            <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEncounter.diagnoses.map((d) => (
                            <tr key={d.id}>
                              <td>
                                <code style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0369a1' }}>
                                  {d.icd10Code || 'Clinical'}
                                </code>
                              </td>
                              <td style={{ fontWeight: 600 }}>{d.description}</td>
                              <td>
                                {d.isPrimary ? (
                                  <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>Primary</span>
                                ) : (
                                  <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>Secondary</span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {new Date(d.recordedAt).toLocaleDateString()}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {selectedEncounter.status !== 3 && selectedEncounter.status !== 4 && (
                                  <button
                                    className="btn btn-outline"
                                    onClick={() => handleRemoveDiagnosis(d.id)}
                                    style={{ fontSize: '0.725rem', padding: '0.2rem 0.4rem', color: '#dc2626' }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PRESCRIPTIONS */}
              {workstationTab === 'prescriptions' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Electronic Prescriptions (e-Rx)</h3>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowRxModal(true)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Plus size={14} /> Write Prescription
                    </button>
                  </div>

                  {selectedEncounter.prescriptions.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '6px', color: 'var(--text-muted)' }}>
                      No prescriptions ordered for this encounter.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {selectedEncounter.prescriptions.map((rx) => (
                        <div key={rx.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                            <div>
                              <strong style={{ fontSize: '0.9rem', color: '#0369a1' }}>Rx #{rx.prescriptionNumber}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.6rem' }}>
                                Ordered {new Date(rx.signedAt).toLocaleString()} by {rx.doctorName}
                              </span>
                            </div>
                            <span className="badge badge-success">Signed & Transmitted</span>
                          </div>

                          <div className="table-wrapper">
                            <table className="desktop-table">
                              <thead>
                                <tr>
                                  <th>Drug / Medication</th>
                                  <th>Dosage & Route</th>
                                  <th>Frequency</th>
                                  <th>Duration</th>
                                  <th>Qty</th>
                                  <th>Instructions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rx.items.map((item) => (
                                  <tr key={item.id}>
                                    <td>
                                      <strong>{item.drugName}</strong>
                                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{item.drugCode}</div>
                                    </td>
                                    <td>{item.dosage} ({item.route})</td>
                                    <td>{item.frequency}</td>
                                    <td>{item.durationDays} days</td>
                                    <td><strong>{item.quantityPrescribed}</strong></td>
                                    <td style={{ fontSize: '0.8rem', color: '#475569' }}>{item.instructions || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: START ENCOUNTER */}
      {showStartModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '540px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Start Clinical Encounter</h2>
            <form onSubmit={handleStartEncounterSubmit}>
              {/* Patient Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  1. Select Patient *
                </label>
                {newEncPatient ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                    <div>
                      <strong>{newEncPatient.fullName}</strong> ({newEncPatient.patientNumber})
                    </div>
                    <button type="button" className="btn btn-outline" onClick={() => setNewEncPatient(null)} style={{ fontSize: '0.725rem' }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Search patient by name or phone..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    {matchingPatients.length > 0 && (
                      <div style={{ marginTop: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '6px', maxHeight: '160px', overflowY: 'auto', backgroundColor: '#fff' }}>
                        {matchingPatients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setNewEncPatient(p);
                              setPatientSearch('');
                              setMatchingPatients([]);
                            }}
                            style={{ padding: '0.5rem 0.8rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '0.825rem' }}
                          >
                            <strong>{p.fullName}</strong> ({p.patientNumber}) • {p.phone}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Doctor Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  2. Attending Physician *
                </label>
                <select
                  className="input-field"
                  value={newEncDoctorId}
                  onChange={(e) => setNewEncDoctorId(e.target.value)}
                  required
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.specialization})
                    </option>
                  ))}
                </select>
              </div>

              {/* Initial Chief Complaint */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  3. Primary Chief Complaint (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Acute chest pain, chronic migraine, routine wellness..."
                  value={newEncComplaint}
                  onChange={(e) => setNewEncComplaint(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowStartModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading || !newEncPatient}>
                  {actionLoading ? 'Initializing...' : 'Begin Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD VITALS */}
      {showVitalsModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Record Patient Vital Signs</h2>
            <form onSubmit={handleRecordVitalsSubmit}>
              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Systolic BP (mmHg)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 120"
                    value={sysBp}
                    onChange={(e) => setSysBp(e.target.value)}
                  />
                </div>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Diastolic BP (mmHg)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 80"
                    value={diaBp}
                    onChange={(e) => setDiaBp(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 72"
                    value={hrBpm}
                    onChange={(e) => setHrBpm(e.target.value)}
                  />
                </div>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Respiratory Rate (/min)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 16"
                    value={rrBpm}
                    onChange={(e) => setRrBpm(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    placeholder="e.g. 36.8"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value)}
                  />
                </div>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Oxygen Saturation SpO2 (%)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 98"
                    value={spo2Pct}
                    onChange={(e) => setSpo2Pct(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    placeholder="e.g. 70.5"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                  />
                </div>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    className="input-field"
                    placeholder="e.g. 175"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowVitalsModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Evaluating...' : 'Save & Evaluate Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD DIAGNOSIS */}
      {showDiagnosisModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Record ICD-10 Diagnosis</h2>
            <form onSubmit={handleAddDiagnosisSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  Standard ICD-10 Quick Select
                </label>
                <select
                  className="input-field"
                  onChange={(e) => {
                    const sel = icdCatalog.find((c) => c.code === e.target.value);
                    if (sel) {
                      setDiagCode(sel.code);
                      setDiagDesc(sel.description);
                    }
                  }}
                >
                  <option value="">— Select common clinical condition —</option>
                  {icdCatalog.map((c) => (
                    <option key={c.code} value={c.code}>
                      [{c.code}] {c.description} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  ICD-10 Code
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. I10, J45.909, E11.9"
                  value={diagCode}
                  onChange={(e) => setDiagCode(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  Diagnostic Description *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Essential primary hypertension"
                  value={diagDesc}
                  onChange={(e) => setDiagDesc(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="diagPrimaryCheck"
                  checked={diagIsPrimary}
                  onChange={(e) => setDiagIsPrimary(e.target.checked)}
                />
                <label htmlFor="diagPrimaryCheck" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Designate as Primary Encounter Diagnosis
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowDiagnosisModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading || !diagDesc.trim()}>
                  Save Diagnosis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: WRITE PRESCRIPTION */}
      {showRxModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Write Electronic Prescription (e-Rx)</h2>

            {/* Critical Allergy Warning Banner */}
            {rxAllergyWarning && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <AlertTriangle size={20} color="#dc2626" />
                <span>{rxAllergyWarning}</span>
              </div>
            )}

            <form onSubmit={handleCreatePrescriptionSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  1. Formulary Drug *
                </label>
                <select
                  className="input-field"
                  value={rxDrugId}
                  onChange={(e) => setRxDrugId(e.target.value)}
                  required
                >
                  {formularyDrugs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.brandName} ({d.genericName}) — {d.strength} {d.dosageForm}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Dosage *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={rxDosage}
                    onChange={(e) => setRxDosage(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Route
                  </label>
                  <select
                    className="input-field"
                    value={rxRoute}
                    onChange={(e) => setRxRoute(e.target.value)}
                  >
                    <option value="Oral">Oral</option>
                    <option value="Inhalation">Inhalation</option>
                    <option value="Topical">Topical</option>
                    <option value="Intramuscular">Intramuscular (IM)</option>
                    <option value="Intravenous">Intravenous (IV)</option>
                    <option value="Sublingual">Sublingual</option>
                  </select>
                </div>
              </div>

              <div className="grid-3" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Frequency *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={rxFrequency}
                    onChange={(e) => setRxFrequency(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={rxDuration}
                    onChange={(e) => setRxDuration(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={rxQty}
                    onChange={(e) => setRxQty(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                  Patient Instructions / Dispense Notes
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Take with food, complete entire 7-day antibiotic course..."
                  value={rxInstructions}
                  onChange={(e) => setRxInstructions(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowRxModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    backgroundColor: rxAllergyWarning ? '#dc2626' : undefined,
                    borderColor: rxAllergyWarning ? '#dc2626' : undefined,
                  }}
                  disabled={actionLoading}
                >
                  {rxAllergyWarning ? 'Authorize Despite Warning' : 'Sign & Submit Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD NOTE ADDENDUM */}
      {showAddendumModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
              Add Versioned Clinical Addendum
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              The original record is immutable. This addendum will be permanently linked and timestamped as the newest version.
            </p>

            <form onSubmit={handleAddAddendumSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem', color: '#b91c1c' }}>
                  Mandatory Amendment Rationale *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Late laboratory result arrived showing elevated troponin..."
                  value={addendumReason}
                  onChange={(e) => setAddendumReason(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  Updated Assessment
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={addendumAssessment}
                  onChange={(e) => setAddendumAssessment(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  Updated Plan
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={addendumPlan}
                  onChange={(e) => setAddendumPlan(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddendumModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading || !addendumReason.trim()}>
                  Seal & Append Addendum
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
