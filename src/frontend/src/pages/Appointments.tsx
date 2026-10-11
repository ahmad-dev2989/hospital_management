import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  UserX,
  Activity,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  FileText
} from 'lucide-react';
import {
  api,
  type AppointmentDto,
  type AppointmentStatus,
  type DoctorDto,
  type DepartmentDto,
  type TimeSlotDto,
  type PatientDto,
  type AppointmentQueueSummaryDto,
  type ApiError
} from '../api/client';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';

export const Appointments: React.FC = () => {
  const {
    activePatient,
    setActivePatient,
    workflowAction,
    clearWorkflowAction,
    navigateWithWorkflow
  } = useNavigation();
  const toast = useToast();

  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [summary, setSummary] = useState<AppointmentQueueSummaryDto | null>(null);
  const [doctors, setDoctors] = useState<DoctorDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showBookModal, setShowBookModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState<AppointmentDto | null>(null);

  // Booking form state
  const [patientSearch, setPatientSearch] = useState('');
  const [matchingPatients, setMatchingPatients] = useState<PatientDto[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientDto | null>(null);
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlotDto[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotDto | null>(null);
  const [bookReason, setBookReason] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Reschedule form state
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlotDto[]>([]);
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<TimeSlotDto | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Cancel form state
  const [cancelReason, setCancelReason] = useState('');

  // UI status feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    toast.success(msg);
  };

  // 1. Initial lookup data: Doctors & Departments
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [docs, depts] = await Promise.all([
          api.getDoctors(),
          api.getDepartments(),
        ]);
        setDoctors(docs);
        setDepartments(depts);
        if (docs.length > 0 && !bookDoctorId) {
          setBookDoctorId(docs[0].id);
        }
      } catch (err) {
        console.error('Failed to load doctors/departments:', err);
      }
    };
    loadLookups();
  }, []);

  // Phase 12: Cross-module workflow actions
  useEffect(() => {
    if (workflowAction) {
      if (workflowAction.action === 'book-appointment') {
        if (activePatient) {
          setSelectedPatient(activePatient);
          setPatientSearch(`${activePatient.fullName} (${activePatient.patientNumber})`);
        }
        setShowBookModal(true);
        clearWorkflowAction();
      }
    }
  }, [workflowAction, activePatient]);

  const handleOpenBookModal = () => {
    if (activePatient && !selectedPatient) {
      setSelectedPatient(activePatient);
      setPatientSearch(`${activePatient.fullName} (${activePatient.patientNumber})`);
    }
    setShowBookModal(true);
  };

  // 2. Fetch Appointments & Queue Summary whenever filters change
  const fetchAppointments = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let statusFilter: AppointmentStatus | undefined = undefined;
      if (selectedStatusTab === 'waiting') statusFilter = 3; // Waiting
      else if (selectedStatusTab === 'booked') statusFilter = 0; // Booked
      else if (selectedStatusTab === 'in-consult') statusFilter = 4; // InConsultation
      else if (selectedStatusTab === 'completed') statusFilter = 5; // Completed
      else if (selectedStatusTab === 'cancelled') statusFilter = 6; // Cancelled

      const [res, sum] = await Promise.all([
        api.getAppointments({
          date: selectedDate || undefined,
          doctorId: selectedDoctorId || undefined,
          departmentId: selectedDepartmentId || undefined,
          status: statusFilter,
          query: searchQuery.trim() || undefined,
          pageSize: 100,
        }),
        api.getQueueSummary(selectedDate || undefined, selectedDoctorId || undefined),
      ]);

      setAppointments(res.items);
      setSummary(sum);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setErrorMessage(apiErr.message || 'Failed to load clinic appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, selectedDoctorId, selectedDepartmentId, selectedStatusTab]);

  // 3. Search patients for booking modal
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
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
    return () => clearTimeout(searchTimer);
  }, [patientSearch]);

  // 4. Fetch available slots for Booking Modal
  useEffect(() => {
    const loadSlots = async () => {
      if (!bookDoctorId || !bookDate) return;
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const slots = await api.getDoctorSlots(bookDoctorId, bookDate);
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Failed to load slots:', err);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    if (showBookModal) {
      loadSlots();
    }
  }, [bookDoctorId, bookDate, showBookModal]);

  // 5. Fetch available slots for Reschedule Modal
  useEffect(() => {
    const loadRescheduleSlots = async () => {
      if (!activeAppointment || !rescheduleDate) return;
      setRescheduleLoading(true);
      setRescheduleSelectedSlot(null);
      try {
        const slots = await api.getDoctorSlots(activeAppointment.doctorId, rescheduleDate);
        setRescheduleSlots(slots);
      } catch (err) {
        console.error('Failed to load reschedule slots:', err);
        setRescheduleSlots([]);
      } finally {
        setRescheduleLoading(false);
      }
    };
    if (showRescheduleModal) {
      loadRescheduleSlots();
    }
  }, [activeAppointment, rescheduleDate, showRescheduleModal]);

  // Actions
  const handleCheckIn = async (appt: AppointmentDto) => {
    try {
      await api.checkInAppointment(appt.id);
      showToast(`Patient checked in: ${appt.patientName} is now in the waiting queue.`);
      fetchAppointments();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to check in appointment.');
    }
  };

  const handleUpdateStatus = async (appt: AppointmentDto, nextStatus: AppointmentStatus, note?: string) => {
    try {
      await api.updateAppointmentStatus(appt.id, nextStatus, note);
      showToast(`Appointment status updated.`);
      fetchAppointments();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to update status.');
    }
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert('Please select a patient.');
      return;
    }
    if (!selectedSlot) {
      alert('Please choose an available time slot.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.bookAppointment({
        patientId: selectedPatient.id,
        doctorId: bookDoctorId,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        reason: bookReason.trim() || undefined,
      });

      showToast(`Appointment ${res.appointmentNumber} successfully booked for ${selectedPatient.fullName}.`);
      setShowBookModal(false);
      setSelectedPatient(null);
      setPatientSearch('');
      setSelectedSlot(null);
      setBookReason('');
      fetchAppointments();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to book appointment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppointment || !rescheduleSelectedSlot) {
      alert('Please select a new time slot.');
      return;
    }

    setActionLoading(true);
    try {
      await api.rescheduleAppointment(activeAppointment.id, {
        newStartsAt: rescheduleSelectedSlot.startsAt,
        newEndsAt: rescheduleSelectedSlot.endsAt,
        reason: rescheduleReason.trim() || undefined,
      });

      showToast(`Appointment ${activeAppointment.appointmentNumber} rescheduled.`);
      setShowRescheduleModal(false);
      setActiveAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to reschedule appointment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppointment) return;
    if (!cancelReason.trim()) {
      alert('A cancellation reason is mandatory.');
      return;
    }

    setActionLoading(true);
    try {
      await api.cancelAppointment(activeAppointment.id, cancelReason.trim());
      showToast(`Appointment ${activeAppointment.appointmentNumber} cancelled.`);
      setShowCancelModal(false);
      setActiveAppointment(null);
      setCancelReason('');
      fetchAppointments();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to cancel appointment.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 0: // Booked
        return <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>Booked</span>;
      case 1: // Confirmed
        return <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>Confirmed</span>;
      case 2: // Arrived
      case 3: // Waiting
        return <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>Waiting in Lobby</span>;
      case 4: // InConsultation
        return <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>In Consultation</span>;
      case 5: // Completed
        return <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>Completed</span>;
      case 6: // Cancelled
        return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>Cancelled</span>;
      case 7: // NoShow
        return <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>No-Show</span>;
      default:
        return <span className="badge">Unknown</span>;
    }
  };

  const formatSlotTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="module-container" style={{ padding: '0 0.5rem' }}>
      {/* Error Alert Banner */}
      {errorMessage && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header & Quick Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon size={22} color="var(--primary)" />
            Appointments & Clinic Queue
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Module C • Doctor scheduling, real-time reception arrival queue, conflict-safe slot booking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            className="btn btn-outline"
            onClick={fetchAppointments}
            disabled={loading}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenBookModal}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            Book Appointment
          </button>
        </div>
      </div>

      {/* Queue Summary Metrics Bar */}
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '0.85rem 1rem' }}>
          <div className="stat-header">
            <span className="stat-label">Total for Selected Day</span>
            <CalendarIcon size={16} color="#64748b" />
          </div>
          <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
            {summary?.totalToday ?? 0}
          </div>
          <div className="stat-desc">Scheduled clinic visits</div>
        </div>

        <div className="card" style={{ padding: '0.85rem 1rem', borderLeft: '3px solid #f59e0b' }}>
          <div className="stat-header">
            <span className="stat-label">Waiting in Lobby</span>
            <Clock size={16} color="#f59e0b" />
          </div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#d97706', marginTop: '0.2rem' }}>
            {summary?.waiting ?? 0}
          </div>
          <div className="stat-desc">Checked-in arrivals</div>
        </div>

        <div className="card" style={{ padding: '0.85rem 1rem', borderLeft: '3px solid #3b82f6' }}>
          <div className="stat-header">
            <span className="stat-label">In Consultation</span>
            <Activity size={16} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#2563eb', marginTop: '0.2rem' }}>
            {summary?.inConsultation ?? 0}
          </div>
          <div className="stat-desc">With physician now</div>
        </div>

        <div className="card" style={{ padding: '0.85rem 1rem', borderLeft: '3px solid #10b981' }}>
          <div className="stat-header">
            <span className="stat-label">Completed</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#059669', marginTop: '0.2rem' }}>
            {summary?.completed ?? 0}
          </div>
          <div className="stat-desc">Consultation finished</div>
        </div>

        <div className="card" style={{ padding: '0.85rem 1rem' }}>
          <div className="stat-header">
            <span className="stat-label">Cancelled / No-Show</span>
            <UserX size={16} color="#ef4444" />
          </div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#dc2626', marginTop: '0.2rem' }}>
            {(summary?.cancelled ?? 0) + (summary?.noShow ?? 0)}
          </div>
          <div className="stat-desc">Recorded cancellations</div>
        </div>
      </div>

      {/* Main Filter & Worklist Panel */}
      <div className="card" style={{ padding: '1.25rem' }}>
        {/* Filters Row */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          {/* Date Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              className="input-field"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.825rem', width: '145px' }}
            />
            <button
              className="btn btn-outline"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
            >
              Today
            </button>
          </div>

          {/* Doctor Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Doctor:</span>
            <select
              className="input-field"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.825rem', minWidth: '180px' }}
            >
              <option value="">All Physicians</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Dept:</span>
            <select
              className="input-field"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.825rem', minWidth: '150px' }}
            >
              <option value="">All Departments</option>
              {departments.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Field */}
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search by Patient, ID, or APT #..."
              className="input-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAppointments()}
              style={{ paddingLeft: '30px', fontSize: '0.825rem', paddingRight: '10px', height: '34px' }}
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.6rem', marginBottom: '1rem' }}>
          {[
            { id: 'all', label: 'All Appointments' },
            { id: 'waiting', label: `Arrival Queue (${summary?.waiting ?? 0})` },
            { id: 'booked', label: `Scheduled (${summary?.booked ?? 0})` },
            { id: 'in-consult', label: `In Consultation (${summary?.inConsultation ?? 0})` },
            { id: 'completed', label: `Completed (${summary?.completed ?? 0})` },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusTab(tab.id)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedStatusTab === tab.id ? 'var(--primary)' : 'transparent',
                color: selectedStatusTab === tab.id ? '#fff' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Appointments Table */}
        <div className="table-wrapper">
          <table className="desktop-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Time Slot</th>
                <th style={{ width: '130px' }}>Appt #</th>
                <th>Patient</th>
                <th>Physician & Dept</th>
                <th>Status</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    <RefreshCw size={20} className="spin" color="var(--primary)" style={{ margin: '0 auto 0.5rem auto' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading clinic appointments...</span>
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    <CalendarIcon size={32} color="#cbd5e1" style={{ margin: '0 auto 0.5rem auto' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No appointments found for the selected criteria.</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>Click "Book Appointment" to schedule a patient visit.</p>
                  </td>
                </tr>
              ) : (
                appointments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} color="#64748b" />
                        {formatSlotTime(a.startsAt)} - {formatSlotTime(a.endsAt)}
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.775rem', fontWeight: 600, color: '#0369a1' }}>
                        {a.appointmentNumber}
                      </code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.patientName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {a.patientNumber} {a.patientPhone ? `• ${a.patientPhone}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.doctorName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {a.departmentName || a.specialization}
                      </div>
                    </td>
                    <td>{getStatusBadge(a.status)}</td>
                    <td style={{ maxWidth: '200px' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: '#475569',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                        }}
                        title={a.reason || ''}
                      >
                        {a.reason || '—'}
                      </span>
                      {a.cancellationReason && (
                        <div style={{ fontSize: '0.725rem', color: '#dc2626', marginTop: '0.15rem' }}>
                          Reason: {a.cancellationReason}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                        {/* 1-Click Check In button for Booked arrivals */}
                        {a.status === 0 && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleCheckIn(a)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', backgroundColor: '#d97706', borderColor: '#d97706' }}
                            title="Check-in patient upon arrival into waiting lobby"
                          >
                            <UserCheck size={13} />
                            Check-In
                          </button>
                        )}

                        {/* Fast Call Patient for Waiting queue */}
                        {a.status === 3 && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleUpdateStatus(a, 4, 'Patient called into examination room')}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', backgroundColor: '#2563eb', borderColor: '#2563eb' }}
                            title="Call patient into consultation room"
                          >
                            <Activity size={13} />
                            In Consult
                          </button>
                        )}

                        {/* Complete button */}
                        {a.status === 4 && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleUpdateStatus(a, 5, 'Consultation completed')}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', backgroundColor: '#059669', borderColor: '#059669' }}
                            title="Mark appointment completed"
                          >
                            <CheckCircle2 size={13} />
                            Complete
                          </button>
                        )}

                        {/* Phase 12: Cross-Module Clinical Workstation Jump */}
                        {a.status !== 6 && (
                          <button
                            className="btn btn-outline"
                            onClick={() => {
                              const patientObj: PatientDto = {
                                id: a.patientId,
                                patientNumber: a.patientNumber,
                                firstName: a.patientName.split(' ')[0] || '',
                                lastName: a.patientName.split(' ').slice(1).join(' ') || '',
                                fullName: a.patientName,
                                dateOfBirth: '',
                                age: 0,
                                gender: '',
                                bloodGroup: null,
                                phone: a.patientPhone || '',
                                email: null,
                                address: null,
                                emergencyContactName: null,
                                emergencyContactPhone: null,
                                isActive: true,
                                allergiesCount: 0,
                                hasHighRiskAllergy: false,
                                createdAt: '',
                                updatedAt: '',
                              };
                              setActivePatient(patientObj);
                              navigateWithWorkflow('clinical', patientObj, 'start-encounter', { appointmentId: a.id });
                            }}
                            style={{ fontSize: '0.725rem', padding: '0.25rem 0.5rem', color: '#0d9488', borderColor: '#99f6e4', backgroundColor: '#f0fdfa' }}
                            title="Open Clinical Encounter note for this patient"
                          >
                            <FileText size={12} />
                            Clinical
                          </button>
                        )}

                        {/* Reschedule Button (if not completed or cancelled) */}
                        {a.status !== 5 && a.status !== 6 && (
                          <button
                            className="btn btn-outline"
                            onClick={() => {
                              setActiveAppointment(a);
                              setRescheduleDate(a.startsAt.split('T')[0]);
                              setShowRescheduleModal(true);
                            }}
                            style={{ fontSize: '0.725rem', padding: '0.25rem 0.45rem' }}
                            title="Reschedule appointment slot"
                          >
                            Reschedule
                          </button>
                        )}

                        {/* Cancel Button */}
                        {a.status !== 5 && a.status !== 6 && (
                          <button
                            className="btn btn-outline"
                            onClick={() => {
                              setActiveAppointment(a);
                              setCancelReason('');
                              setShowCancelModal(true);
                            }}
                            style={{ fontSize: '0.725rem', padding: '0.25rem 0.45rem', color: '#dc2626' }}
                            title="Cancel appointment"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: BOOK APPOINTMENT */}
      {showBookModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                <CalendarIcon size={20} color="var(--primary)" />
                Book Clinic Appointment
              </h2>
              <button
                className="modal-close"
                onClick={() => setShowBookModal(false)}
                title="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleBookSubmit}>
              {/* Step 1: Patient Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  1. Select Patient *
                </label>
                {selectedPatient ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.6rem 0.8rem',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#166534' }}>{selectedPatient.fullName}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#15803d', marginLeft: '0.5rem' }}>
                        ({selectedPatient.patientNumber} • {selectedPatient.phone})
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setSelectedPatient(null)}
                      style={{ fontSize: '0.725rem', padding: '0.2rem 0.4rem' }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Type patient name or phone to search..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    {matchingPatients.length > 0 && (
                      <div
                        style={{
                          marginTop: '0.3rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          backgroundColor: '#fff',
                        }}
                      >
                        {matchingPatients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPatient(p);
                              setPatientSearch('');
                              setMatchingPatients([]);
                            }}
                            style={{
                              padding: '0.5rem 0.8rem',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.825rem',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span>
                              <strong>{p.fullName}</strong> ({p.patientNumber})
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>{p.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Doctor and Date Selection */}
              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                    2. Attending Physician *
                  </label>
                  <select
                    className="input-field"
                    value={bookDoctorId}
                    onChange={(e) => setBookDoctorId(e.target.value)}
                    required
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.specialization}) — Fee: ${d.consultationFee.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                    3. Target Date *
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Step 3: Interactive Visual Slot Picker */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    4. Select Available Time Slot *
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {availableSlots.filter((s) => s.isAvailable).length} slots open
                  </span>
                </div>

                {slotsLoading ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={18} className="spin" style={{ margin: '0 auto 0.4rem auto' }} />
                    <span style={{ fontSize: '0.8rem' }}>Checking doctor availability...</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center', color: '#64748b', fontSize: '0.825rem' }}>
                    <AlertCircle size={18} color="#94a3b8" style={{ margin: '0 auto 0.25rem auto' }} />
                    Physician is not scheduled on duty for this date or all slots are occupied.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '0.45rem',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      padding: '0.3rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                    }}
                  >
                    {availableSlots.map((s, idx) => {
                      const isSelected = selectedSlot?.startsAt === s.startsAt;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!s.isAvailable}
                          onClick={() => setSelectedSlot(s)}
                          style={{
                            padding: '0.4rem 0.2rem',
                            fontSize: '0.775rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: isSelected
                              ? '2px solid var(--primary)'
                              : s.isAvailable
                              ? '1px solid #bbf7d0'
                              : '1px solid #e2e8f0',
                            backgroundColor: isSelected
                              ? '#0d9488'
                              : s.isAvailable
                              ? '#f0fdf4'
                              : '#f1f5f9',
                            color: isSelected
                              ? '#fff'
                              : s.isAvailable
                              ? '#166534'
                              : '#94a3b8',
                            cursor: s.isAvailable ? 'pointer' : 'not-allowed',
                            transition: 'all 0.15s ease',
                          }}
                          title={s.isAvailable ? 'Available' : `Booked: ${s.patientName || 'Occupied'}`}
                        >
                          {s.timeDisplay}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reason / Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  Chief Complaint / Visit Reason
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="e.g. Follow-up consultation, fever, prescription renewal..."
                  value={bookReason}
                  onChange={(e) => setBookReason(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowBookModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading || !selectedPatient || !selectedSlot}
                >
                  {actionLoading ? 'Booking Slot...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESCHEDULE APPOINTMENT */}
      {showRescheduleModal && activeAppointment && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Reschedule {activeAppointment.appointmentNumber}
              </h2>
              <button
                className="modal-close"
                onClick={() => setShowRescheduleModal(false)}
                title="Close modal"
              >
                ×
              </button>
            </div>

            <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.825rem', border: '1px solid var(--border)' }}>
              <div>Patient: <strong>{activeAppointment.patientName}</strong> ({activeAppointment.patientNumber})</div>
              <div>Doctor: <strong>{activeAppointment.doctorName}</strong></div>
              <div>Current Slot: <strong>{new Date(activeAppointment.startsAt).toLocaleDateString()} {formatSlotTime(activeAppointment.startsAt)}</strong></div>
            </div>

            <form onSubmit={handleRescheduleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  Target New Date *
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  Select New Slot *
                </label>
                {rescheduleLoading ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <RefreshCw size={16} className="spin" />
                  </div>
                ) : rescheduleSlots.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No available slots on this date.</div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '0.4rem',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      padding: '0.3rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                    }}
                  >
                    {rescheduleSlots.map((s, idx) => {
                      const isSelected = rescheduleSelectedSlot?.startsAt === s.startsAt;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!s.isAvailable}
                          onClick={() => setRescheduleSelectedSlot(s)}
                          style={{
                            padding: '0.35rem 0.2rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: isSelected ? '2px solid var(--primary)' : '1px solid #bbf7d0',
                            backgroundColor: isSelected ? 'var(--primary)' : s.isAvailable ? '#f0fdf4' : '#f1f5f9',
                            color: isSelected ? '#fff' : s.isAvailable ? '#166534' : '#94a3b8',
                            cursor: s.isAvailable ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {s.timeDisplay}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="stat-label" style={{ display: 'block', marginBottom: '0.3rem' }}>
                  Reschedule Reason
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Patient requested later hour..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowRescheduleModal(false)}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading || !rescheduleSelectedSlot}
                >
                  {actionLoading ? 'Updating...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CANCEL APPOINTMENT */}
      {showCancelModal && activeAppointment && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={18} />
                Cancel Appointment
              </h2>
              <button
                className="modal-close"
                onClick={() => setShowCancelModal(false)}
                title="Close modal"
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1rem' }}>
              Are you sure you want to cancel appointment <strong>{activeAppointment.appointmentNumber}</strong> for{' '}
              <strong>{activeAppointment.patientName}</strong>? This frees the slot and records an immutable audit entry.
            </p>

            <form onSubmit={handleCancelSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  Mandatory Cancellation Reason *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Patient called to cancel, fever subsided..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCancelModal(false)}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={actionLoading || !cancelReason.trim()}
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
