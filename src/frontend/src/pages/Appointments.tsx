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

  // Single Doctor Candidate Detection:
  // If only 1 doctor other than admin exists, or only 1 doctor total exists, auto-select and hide selection
  const nonAdminDoctors = doctors.filter(
    (d) =>
      !d.fullName.toLowerCase().includes('admin') &&
      !d.specialization.toLowerCase().includes('chief medical officer')
  );
  const singleCandidateDoctor =
    nonAdminDoctors.length === 1
      ? nonAdminDoctors[0]
      : nonAdminDoctors.length === 0 && doctors.length === 1
      ? doctors[0]
      : null;

  // Doctor Time Slot Settings Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDoctorId, setScheduleDoctorId] = useState('');

  // Default Time Slots (applied to all days)
  const [defaultShifts, setDefaultShifts] = useState<Array<{ startTime: string; endTime: string }>>([
    { startTime: '13:00', endTime: '17:00' }, // 1 PM - 5 PM
  ]);

  // Per-day time slot windows (0=Sun, 1=Mon, ..., 6=Sat)
  const [dayShiftsMap, setDayShiftsMap] = useState<Record<number, Array<{ startTime: string; endTime: string }>>>({
    1: [{ startTime: '13:00', endTime: '17:00' }], // Mon
    2: [{ startTime: '13:00', endTime: '17:00' }], // Tue
    3: [{ startTime: '13:00', endTime: '17:00' }], // Wed
    4: [{ startTime: '13:00', endTime: '17:00' }], // Thu
    5: [{ startTime: '13:00', endTime: '17:00' }], // Fri
    6: [{ startTime: '13:00', endTime: '17:00' }], // Sat
    0: [{ startTime: '13:00', endTime: '17:00' }], // Sun
  });

  // Track which days are customized
  const [customizedDays, setCustomizedDays] = useState<Record<number, boolean>>({});

  // Active day being edited/expanded (null or 0..6)
  const [selectedEditDay, setSelectedEditDay] = useState<number | null>(null);

  const [scheduleSaving, setScheduleSaving] = useState(false);

  const formatTime12h = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return t;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = (m || 0).toString().padStart(2, '0');
    return `${displayH}:${displayM} ${period}`;
  };

  const selectDoctorForSchedule = (docId: string, currentDocs: DoctorDto[] = doctors) => {
    setScheduleDoctorId(docId);
    setSelectedEditDay(null);
    const targetDoc = currentDocs.find((d) => d.id === docId);
    if (targetDoc?.schedules && targetDoc.schedules.length > 0) {
      const newMap: Record<number, Array<{ startTime: string; endTime: string }>> = {
        1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: []
      };
      targetDoc.schedules.forEach((s) => {
        if (newMap[s.dayOfWeek] !== undefined) {
          newMap[s.dayOfWeek].push({ startTime: s.startTime, endTime: s.endTime });
        }
      });

      const baseShifts = newMap[1].length > 0
        ? newMap[1]
        : Object.values(newMap).find((s) => s.length > 0) || [{ startTime: '13:00', endTime: '17:00' }];

      const custom: Record<number, boolean> = {};
      [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
        if (newMap[d].length === 0) {
          newMap[d] = [...baseShifts];
        } else {
          const differs =
            newMap[d].length !== baseShifts.length ||
            newMap[d].some((s, idx) => s.startTime !== baseShifts[idx]?.startTime || s.endTime !== baseShifts[idx]?.endTime);
          if (differs) {
            custom[d] = true;
          }
        }
      });

      setDefaultShifts(baseShifts);
      setDayShiftsMap(newMap);
      setCustomizedDays(custom);
    } else {
      const def = [{ startTime: '13:00', endTime: '17:00' }];
      setDefaultShifts(def);
      setDayShiftsMap({
        1: [...def],
        2: [...def],
        3: [...def],
        4: [...def],
        5: [...def],
        6: [...def],
        0: [...def],
      });
      setCustomizedDays({});
    }
  };

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

  // Synchronize singleCandidateDoctor when doctors load
  useEffect(() => {
    if (singleCandidateDoctor) {
      setBookDoctorId(singleCandidateDoctor.id);
      setScheduleDoctorId(singleCandidateDoctor.id);
      setSelectedDoctorId(singleCandidateDoctor.id);
    } else if (doctors.length > 0 && !bookDoctorId) {
      setBookDoctorId(doctors[0].id);
      setScheduleDoctorId(doctors[0].id);
    }
  }, [doctors, singleCandidateDoctor]);

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
    if (singleCandidateDoctor) {
      setBookDoctorId(singleCandidateDoctor.id);
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
    const effectiveDoctorId = singleCandidateDoctor ? singleCandidateDoctor.id : bookDoctorId;
    if (!effectiveDoctorId) {
      alert('Please select an attending doctor.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.bookAppointment({
        patientId: selectedPatient.id,
        doctorId: effectiveDoctorId,
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

  const handleSaveDoctorSchedules = async () => {
    const targetDocId = scheduleDoctorId || (singleCandidateDoctor ? singleCandidateDoctor.id : bookDoctorId || doctors[0]?.id);
    if (!targetDocId) {
      alert('Please select a doctor to configure time slots for.');
      return;
    }

    setScheduleSaving(true);
    try {
      const hasCustomDays = Object.values(customizedDays).some((v) => v);

      if (!hasCustomDays) {
        if (defaultShifts.length === 0) {
          alert('Please add at least one time slot.');
          setScheduleSaving(false);
          return;
        }
        await api.saveDoctorSchedulesBulk(targetDocId, {
          applyToAllDays: true,
          days: [
            {
              dayOfWeek: 1, // applied to all 7 days by backend
              shifts: defaultShifts.map((s) => ({
                startTime: s.startTime,
                endTime: s.endTime,
                slotDurationMinutes: 15,
                isActive: true,
              })),
            },
          ],
        });
      } else {
        await api.saveDoctorSchedulesBulk(targetDocId, {
          applyToAllDays: false,
          days: [0, 1, 2, 3, 4, 5, 6].map((dayNum) => ({
            dayOfWeek: dayNum,
            shifts: (dayShiftsMap[dayNum] || defaultShifts).map((s) => ({
              startTime: s.startTime,
              endTime: s.endTime,
              slotDurationMinutes: 15,
              isActive: true,
            })),
          })),
        });
      }

      const docName = doctors.find((d) => d.id === targetDocId)?.fullName || 'doctor';
      showToast(`Time slots confirmed and saved for ${docName}!`);
      setShowScheduleModal(false);

      // Refresh doctor list to store updated schedules
      try {
        const updatedDocs = await api.getDoctors();
        setDoctors(updatedDocs);
      } catch (e) {
        console.warn('Failed to refresh doctors after schedule update', e);
      }

      // Refresh slots immediately for current booking view
      const activeDocId = singleCandidateDoctor ? singleCandidateDoctor.id : bookDoctorId;
      if (activeDocId) {
        setSlotsLoading(true);
        const slots = await api.getDoctorSlots(activeDocId, bookDate);
        setAvailableSlots(slots);
        setSlotsLoading(false);
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to save doctor time slots.');
    } finally {
      setScheduleSaving(false);
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
            className="btn btn-outline"
            onClick={() => {
              const targetDocId = singleCandidateDoctor?.id || bookDoctorId || (doctors[0]?.id || '');
              selectDoctorForSchedule(targetDocId);
              setShowScheduleModal(true);
            }}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0d9488', borderColor: '#99f6e4', backgroundColor: '#f0fdfa' }}
            title="Configure doctor time slots (e.g. 1-5 PM for all days, or custom per day)"
          >
            <Clock size={15} />
            Doctor Time Slot Settings
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
            {singleCandidateDoctor ? (
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f766e', backgroundColor: '#f0fdfa', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #ccfbf1' }}>
                {singleCandidateDoctor.fullName}
              </span>
            ) : (
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
            )}
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
                {singleCandidateDoctor ? (
                  <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '0.725rem', color: '#166534', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                      Attending Physician
                    </div>
                    <div style={{ fontWeight: 600, color: '#15803d', fontSize: '0.9rem', marginTop: '2px' }}>
                      {singleCandidateDoctor.fullName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>
                      {singleCandidateDoctor.specialization} • Fee: ${singleCandidateDoctor.consultationFee.toFixed(2)}
                    </div>
                  </div>
                ) : (
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
                )}

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                    Target Date *
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
                    Select Available 15-Minute Slot *
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
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center', color: '#64748b', fontSize: '0.825rem', border: '1px dashed #cbd5e1' }}>
                    <AlertCircle size={18} color="#94a3b8" style={{ margin: '0 auto 0.25rem auto' }} />
                    <p style={{ margin: '0.2rem 0' }}>Physician is not scheduled on duty for this date or all slots are occupied.</p>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        const targetDocId = singleCandidateDoctor?.id || bookDoctorId || (doctors[0]?.id || '');
                        selectDoctorForSchedule(targetDocId);
                        setShowScheduleModal(true);
                      }}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', marginTop: '0.4rem', color: '#0d9488', borderColor: '#99f6e4', backgroundColor: '#fff' }}
                    >
                      <Clock size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      Doctor Time Slot Settings (e.g. 1–5 PM)
                    </button>
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

      {/* MODAL 4: DOCTOR TIME SLOTS SETTINGS (SIMPLIFIED & INTUITIVE) */}
      {showScheduleModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Clock size={20} color="#0d9488" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Doctor Time Slot Settings</h3>
              </div>
              <button className="modal-close" onClick={() => setShowScheduleModal(false)}>×</button>
            </div>

            {/* 1. Doctors in Selectable Rectangles */}
            <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                1. Select Doctor
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '0.65rem',
                }}
              >
                {doctors.map((d) => {
                  const isSelected = (scheduleDoctorId || (singleCandidateDoctor?.id || doctors[0]?.id)) === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => selectDoctorForSchedule(d.id)}
                      style={{
                        padding: '0.75rem 0.9rem',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #0d9488' : '1px solid #cbd5e1',
                        backgroundColor: isSelected ? '#f0fdfa' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 0 0 1px #0d9488' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.9rem', color: isSelected ? '#0f766e' : '#1e293b' }}>
                          {d.fullName}
                        </strong>
                        {isSelected && <CheckCircle2 size={16} color="#0d9488" />}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: isSelected ? '#0d9488' : '#64748b' }}>
                        {d.specialization}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Time Slot Selection and Addition (Added to All Days) */}
            <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>2. Time Slots (Added to All Days)</strong>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Configure the time slots below. They are automatically added to all days from Monday to Sunday.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    const updated = [...defaultShifts, { startTime: '17:00', endTime: '21:00' }];
                    setDefaultShifts(updated);
                    const newMap = { ...dayShiftsMap };
                    [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
                      if (!customizedDays[d]) newMap[d] = [...updated];
                    });
                    setDayShiftsMap(newMap);
                  }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Plus size={13} />
                  Add Time Slot
                </button>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center', marginRight: '0.2rem' }}>Quick Presets:</span>
                {[
                  { label: '1 PM – 5 PM', shifts: [{ startTime: '13:00', endTime: '17:00' }] },
                  { label: '1–3 PM & 5–9 PM', shifts: [{ startTime: '13:00', endTime: '15:00' }, { startTime: '17:00', endTime: '21:00' }] },
                  { label: '1 PM – 7 PM', shifts: [{ startTime: '13:00', endTime: '19:00' }] },
                  { label: '9 AM – 5 PM', shifts: [{ startTime: '09:00', endTime: '17:00' }] },
                ].map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setDefaultShifts(preset.shifts);
                      const newMap = { ...dayShiftsMap };
                      [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
                        if (!customizedDays[d]) newMap[d] = [...preset.shifts];
                      });
                      setDayShiftsMap(newMap);
                    }}
                    style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem' }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Time Slot Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {defaultShifts.map((shift, sIdx) => (
                  <div
                    key={sIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#ffffff',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#475569', minWidth: '40px' }}>
                      Slot {sIdx + 1}:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
                      <input
                        type="time"
                        className="input-field"
                        value={shift.startTime}
                        onChange={(e) => {
                          const updated = [...defaultShifts];
                          updated[sIdx] = { ...updated[sIdx], startTime: e.target.value };
                          setDefaultShifts(updated);
                          const newMap = { ...dayShiftsMap };
                          [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
                            if (!customizedDays[d]) newMap[d] = [...updated];
                          });
                          setDayShiftsMap(newMap);
                        }}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '105px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
                      <input
                        type="time"
                        className="input-field"
                        value={shift.endTime}
                        onChange={(e) => {
                          const updated = [...defaultShifts];
                          updated[sIdx] = { ...updated[sIdx], endTime: e.target.value };
                          setDefaultShifts(updated);
                          const newMap = { ...dayShiftsMap };
                          [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
                            if (!customizedDays[d]) newMap[d] = [...updated];
                          });
                          setDayShiftsMap(newMap);
                        }}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '105px' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#0d9488', marginLeft: 'auto' }}>
                      {formatTime12h(shift.startTime)} – {formatTime12h(shift.endTime)}
                    </span>
                    {defaultShifts.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          const updated = defaultShifts.filter((_, i) => i !== sIdx);
                          setDefaultShifts(updated);
                          const newMap = { ...dayShiftsMap };
                          [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
                            if (!customizedDays[d]) newMap[d] = [...updated];
                          });
                          setDayShiftsMap(newMap);
                        }}
                        style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', color: '#dc2626', borderColor: '#fca5a5' }}
                        title="Remove time slot"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Days from Mon – Sun with Assigned Time Slots */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                  3. Days Overview (Monday – Sunday)
                </label>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Click any day to change its time slots
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.55rem',
                }}
              >
                {[
                  { dayNum: 1, name: 'Monday' },
                  { dayNum: 2, name: 'Tuesday' },
                  { dayNum: 3, name: 'Wednesday' },
                  { dayNum: 4, name: 'Thursday' },
                  { dayNum: 5, name: 'Friday' },
                  { dayNum: 6, name: 'Saturday' },
                  { dayNum: 0, name: 'Sunday' },
                ].map((d) => {
                  const isDayEditing = selectedEditDay === d.dayNum;
                  const isCustom = customizedDays[d.dayNum];
                  const dayShifts = dayShiftsMap[d.dayNum] || defaultShifts;
                  return (
                    <div
                      key={d.dayNum}
                      onClick={() => setSelectedEditDay(isDayEditing ? null : d.dayNum)}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '8px',
                        border: isDayEditing
                          ? '2px solid #0d9488'
                          : isCustom
                          ? '1px solid #0d9488'
                          : '1px solid #cbd5e1',
                        backgroundColor: isDayEditing
                          ? '#f0fdfa'
                          : isCustom
                          ? '#f8fafc'
                          : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.85rem', color: isDayEditing ? '#0f766e' : '#0f172a' }}>
                          {d.name}
                        </strong>
                        {isCustom ? (
                          <span style={{ fontSize: '0.675rem', color: '#0d9488', backgroundColor: '#ccfbf1', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                            Custom
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.675rem', color: '#64748b' }}>
                            All Days
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {dayShifts.map((s, idx) => (
                          <div key={idx} style={{ fontWeight: 500 }}>
                            {formatTime12h(s.startTime)} – {formatTime12h(s.endTime)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Day-Specific Edit Box (Shown when a day is clicked) */}
              {selectedEditDay !== null && (() => {
                const dayNum = selectedEditDay;
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayNum];
                const currentDayShifts = dayShiftsMap[dayNum] || [...defaultShifts];

                const updateDayShift = (sIdx: number, field: 'startTime' | 'endTime', val: string) => {
                  const copy = [...currentDayShifts];
                  copy[sIdx] = { ...copy[sIdx], [field]: val };
                  setDayShiftsMap({ ...dayShiftsMap, [dayNum]: copy });
                  setCustomizedDays({ ...customizedDays, [dayNum]: true });
                };

                const removeDayShift = (sIdx: number) => {
                  const filtered = currentDayShifts.filter((_, i) => i !== sIdx);
                  setDayShiftsMap({ ...dayShiftsMap, [dayNum]: filtered });
                  setCustomizedDays({ ...customizedDays, [dayNum]: true });
                };

                const addDayShift = () => {
                  const updated = [...currentDayShifts, { startTime: '17:00', endTime: '21:00' }];
                  setDayShiftsMap({ ...dayShiftsMap, [dayNum]: updated });
                  setCustomizedDays({ ...customizedDays, [dayNum]: true });
                };

                const resetToDefault = () => {
                  setDayShiftsMap({ ...dayShiftsMap, [dayNum]: [...defaultShifts] });
                  const customCopy = { ...customizedDays };
                  delete customCopy[dayNum];
                  setCustomizedDays(customCopy);
                };

                return (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.85rem 1rem',
                      backgroundColor: '#f0fdfa',
                      borderRadius: '8px',
                      border: '1px solid #99f6e4',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.875rem', color: '#0f766e' }}>
                          Customizing {dayName} Time Slots
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#14b8a6', marginLeft: '0.5rem' }}>
                          (Affects only {dayName})
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {dayNum === 0 && (
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => {
                              setDayShiftsMap({
                                ...dayShiftsMap,
                                0: [{ startTime: '10:00', endTime: '15:00' }],
                              });
                              setCustomizedDays({ ...customizedDays, 0: true });
                            }}
                            style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem', backgroundColor: '#fff' }}
                          >
                            Set Sunday 10 AM – 3 PM
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={resetToDefault}
                          style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem', backgroundColor: '#fff' }}
                        >
                          Reset to All Days Default
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={addDayShift}
                          style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem', backgroundColor: '#fff' }}
                        >
                          + Add Slot
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setSelectedEditDay(null)}
                          style={{ fontSize: '0.725rem', padding: '0.2rem 0.45rem', backgroundColor: '#fff' }}
                        >
                          Done
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {currentDayShifts.map((shift, sIdx) => (
                        <div
                          key={sIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: '0.45rem 0.7rem',
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #ccfbf1',
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f766e', minWidth: '40px' }}>
                            Slot {sIdx + 1}:
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
                            <input
                              type="time"
                              className="input-field"
                              value={shift.startTime}
                              onChange={(e) => updateDayShift(sIdx, 'startTime', e.target.value)}
                              style={{ padding: '0.25rem 0.45rem', fontSize: '0.8rem', width: '105px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
                            <input
                              type="time"
                              className="input-field"
                              value={shift.endTime}
                              onChange={(e) => updateDayShift(sIdx, 'endTime', e.target.value)}
                              style={{ padding: '0.25rem 0.45rem', fontSize: '0.8rem', width: '105px' }}
                            />
                          </div>
                          <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#0d9488', marginLeft: 'auto' }}>
                            {formatTime12h(shift.startTime)} – {formatTime12h(shift.endTime)}
                          </span>
                          {currentDayShifts.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => removeDayShift(sIdx)}
                              style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', color: '#dc2626', borderColor: '#fca5a5' }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 4. Confirm Button */}
            <div className="modal-actions" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowScheduleModal(false)}
                disabled={scheduleSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveDoctorSchedules}
                disabled={scheduleSaving}
                style={{ padding: '0.55rem 1.35rem', fontWeight: 600 }}
              >
                {scheduleSaving ? (
                  <span className="btn-loading">
                    <RefreshCw size={14} className="spin" /> Saving Time Slots...
                  </span>
                ) : (
                  'Confirm & Add Time Slots'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
