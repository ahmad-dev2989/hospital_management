import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Users,
  Calendar,
  FileText,
  FlaskConical,
  Pill,
  CreditCard,
  BarChart3,
  Settings,
  ShieldCheck,
  Server,
  UserCheck,
  ArrowRight,
  Sparkles,
  Database
} from 'lucide-react';
import { api, type PatientDto } from '../api/client';
import { useNavigation } from '../context/NavigationContext';

interface CommandItem {
  id: string;
  type: 'navigation' | 'patient' | 'action';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    navigateWithWorkflow,
    setActivePatient
  } = useNavigation();

  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<PatientDto[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setPatients([]);
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCommandPaletteOpen]);

  // Search patients as user types
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      setSearchingPatients(true);
      const timer = setTimeout(async () => {
        try {
          const res = await api.getPatients({ query: trimmed, pageSize: 5 });
          setPatients(res.items);
        } catch {
          setPatients([]);
        } finally {
          setSearchingPatients(false);
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setPatients([]);
      setSearchingPatients(false);
    }
  }, [query]);

  if (!isCommandPaletteOpen) return null;

  const defaultNavItems: CommandItem[] = [
    {
      id: 'nav-patients',
      type: 'navigation',
      title: 'Patients Workstation',
      subtitle: 'Patient registration, demographics & clinical charts',
      icon: <Users size={16} color="#0d9488" />,
      shortcut: 'Ctrl+4',
      action: () => {
        navigateWithWorkflow('patients');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-appointments',
      type: 'navigation',
      title: 'Appointments & Scheduling',
      subtitle: 'Doctor slots, patient check-in queue & calendar',
      icon: <Calendar size={16} color="#0d9488" />,
      shortcut: 'Ctrl+5',
      action: () => {
        navigateWithWorkflow('appointments');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-clinical',
      type: 'navigation',
      title: 'Clinical Encounters & Notes',
      subtitle: 'SOAP documentation, vitals, diagnoses & prescriptions',
      icon: <FileText size={16} color="#0d9488" />,
      shortcut: 'Ctrl+6',
      action: () => {
        navigateWithWorkflow('clinical');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-lab',
      type: 'navigation',
      title: 'Laboratory Management',
      subtitle: 'Test orders, specimen barcodes & result verification',
      icon: <FlaskConical size={16} color="#0d9488" />,
      shortcut: 'Ctrl+7',
      action: () => {
        navigateWithWorkflow('laboratory');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-pharmacy',
      type: 'navigation',
      title: 'Pharmacy & Stock Inventory',
      subtitle: 'Drug catalog, FEFO batch dispensing & expiry alerts',
      icon: <Pill size={16} color="#0d9488" />,
      shortcut: 'Ctrl+8',
      action: () => {
        navigateWithWorkflow('pharmacy');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-billing',
      type: 'navigation',
      title: 'Billing & Cashier Terminal',
      subtitle: 'Invoices, payment capture, receipts & shift reconciliation',
      icon: <CreditCard size={16} color="#0d9488" />,
      shortcut: 'Ctrl+9',
      action: () => {
        navigateWithWorkflow('billing');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-reports',
      type: 'navigation',
      title: 'Reports & Analytics',
      subtitle: 'Executive operational dashboard, financial & TAT reports',
      icon: <BarChart3 size={16} color="#0d9488" />,
      action: () => {
        navigateWithWorkflow('reports');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-settings',
      type: 'navigation',
      title: 'System Administration & Storage',
      subtitle: 'Hospital profile, document storage & pg_dump backups',
      icon: <Settings size={16} color="#0d9488" />,
      action: () => {
        navigateWithWorkflow('settings');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-audit',
      type: 'navigation',
      title: 'Security Audit Log',
      subtitle: 'Immutable authentication and clinical audit trails',
      icon: <ShieldCheck size={16} color="#0d9488" />,
      action: () => {
        navigateWithWorkflow('audit');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-users',
      type: 'navigation',
      title: 'Staff & RBAC Administration',
      subtitle: 'Manage user accounts, roles & passwords',
      icon: <UserCheck size={16} color="#0d9488" />,
      action: () => {
        navigateWithWorkflow('users');
        closeCommandPalette();
      },
    },
    {
      id: 'nav-foundation',
      type: 'navigation',
      title: 'System Foundation Diagnostic',
      subtitle: 'Loopback API and local PostgreSQL health monitor',
      icon: <Server size={16} color="#0d9488" />,
      shortcut: 'Ctrl+1',
      action: () => {
        navigateWithWorkflow('foundation');
        closeCommandPalette();
      },
    },
  ];

  const quickActions: CommandItem[] = [
    {
      id: 'act-new-patient',
      type: 'action',
      title: 'Register New Patient',
      subtitle: 'Open patient registration form with duplicate detection',
      icon: <Sparkles size={16} color="#10b981" />,
      action: () => {
        navigateWithWorkflow('patients', null, 'register-patient');
        closeCommandPalette();
      },
    },
    {
      id: 'act-fast-payment',
      type: 'action',
      title: 'Fast Payment Terminal',
      subtitle: 'Capture receipt payment with idempotency protection',
      icon: <CreditCard size={16} color="#3b82f6" />,
      action: () => {
        navigateWithWorkflow('billing', null, 'open-terminal');
        closeCommandPalette();
      },
    },
    {
      id: 'act-db-backup',
      type: 'action',
      title: 'Create Instant Database Backup',
      subtitle: 'Run native pg_dump backup to local AppData archive',
      icon: <Database size={16} color="#8b5cf6" />,
      action: () => {
        navigateWithWorkflow('settings', null, 'open-backups');
        closeCommandPalette();
      },
    },
  ];

  // Convert patients to command items
  const patientItems: CommandItem[] = patients.map((p) => ({
    id: `patient-${p.id}`,
    type: 'patient',
    title: `${p.fullName} (${p.patientNumber})`,
    subtitle: `Age: ${p.age}y · ${p.gender} · Phone: ${p.phone}`,
    icon: <Users size={16} color="#0d9488" />,
    action: () => {
      setActivePatient(p);
      navigateWithWorkflow('patients', p, 'view-chart');
      closeCommandPalette();
    },
  }));

  // Filter items by query
  const filteredNav = defaultNavItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredActions = quickActions.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
  );

  const allItems: CommandItem[] = [
    ...patientItems,
    ...filteredActions,
    ...filteredNav,
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={closeCommandPalette}
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: '10vh',
        justifyContent: 'center',
      }}
    >
      <div
        className="command-palette-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '620px',
          maxWidth: '92vw',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <Search size={20} color="#0d9488" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, search patients, or jump to workstation... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              color: '#0f172a',
              background: 'transparent',
            }}
          />
          <kbd
            style={{
              padding: '0.2rem 0.45rem',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontSize: '0.7rem',
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {searchingPatients && (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
              Searching local patient records...
            </div>
          )}

          {allItems.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              No commands or patients matching "{query}"
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#f0fdfa' : 'transparent',
                    borderLeft: isSelected ? '3px solid #0d9488' : '3px solid transparent',
                    transition: 'background-color 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: isSelected ? '#ccfbf1' : '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: isSelected ? 700 : 600,
                          color: isSelected ? '#0f766e' : '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {item.shortcut && (
                      <kbd
                        style={{
                          padding: '0.15rem 0.4rem',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          fontSize: '0.675rem',
                          color: '#64748b',
                          fontWeight: 600,
                        }}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight size={14} color="#0d9488" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.725rem',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>Use <strong>↑↓</strong> to navigate</span>
            <span><strong>Enter</strong> to select</span>
            <span><strong>Esc</strong> to dismiss</span>
          </div>
          <div>Offline Hospital Workstation</div>
        </div>
      </div>
    </div>
  );
};
