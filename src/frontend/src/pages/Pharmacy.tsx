import React, { useState, useEffect } from 'react';
import {
  Pill,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  ArrowUpDown,
  History,
  Printer,
  Sparkles,
  ClipboardCheck
} from 'lucide-react';
import {
  api,
  type PharmacyDrugDto,
  type InventoryBatchDto,
  type StockMovementDto,
  type PrescriptionQueueItemDto,
  type PharmacyDashboardMetricsDto,
  type StockMovementType,
  STOCK_MOVEMENT_TYPE_NAMES,
  type ApiError
} from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Pharmacy: React.FC = () => {
  const { user } = useAuth();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<'queue' | 'formulary' | 'batches' | 'ledger'>('queue');

  // Metrics
  const [metrics, setMetrics] = useState<PharmacyDashboardMetricsDto | null>(null);

  // Prescription Queue
  const [queue, setQueue] = useState<PrescriptionQueueItemDto[]>([]);
  const [selectedRx, setSelectedRx] = useState<PrescriptionQueueItemDto | null>(null);
  const [rxLoading, setRxLoading] = useState(false);
  const [rxSearch, setRxSearch] = useState('');
  const [dispenseLoading, setDispenseLoading] = useState(false);

  // Formulary & Drugs
  const [drugs, setDrugs] = useState<PharmacyDrugDto[]>([]);
  const [drugSearch, setDrugSearch] = useState('');

  // Batches
  const [batches, setBatches] = useState<InventoryBatchDto[]>([]);

  // Stock Movements Ledger
  const [movements, setMovements] = useState<StockMovementDto[]>([]);

  // Modals state
  const [showAddDrugModal, setShowAddDrugModal] = useState(false);
  const [showReceiveBatchModal, setShowReceiveBatchModal] = useState(false);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);
  const [showPrintLabelModal, setShowPrintLabelModal] = useState(false);

  // Form: Add Drug
  const [newDrugCode, setNewDrugCode] = useState('');
  const [newDrugBrand, setNewDrugBrand] = useState('');
  const [newDrugGeneric, setNewDrugGeneric] = useState('');
  const [newDrugForm, setNewDrugForm] = useState('Tablet');
  const [newDrugStrength, setNewDrugStrength] = useState('500mg');
  const [newDrugReorder, setNewDrugReorder] = useState('50');
  const [savingDrug, setSavingDrug] = useState(false);

  // Form: Receive Batch
  const [receiveDrugId, setReceiveDrugId] = useState('');
  const [receiveBatchNo, setReceiveBatchNo] = useState('');
  const [receiveExpiry, setReceiveExpiry] = useState('');
  const [receiveQty, setReceiveQty] = useState('100');
  const [receiveCost, setReceiveCost] = useState('0.50');
  const [receivePrice, setReceivePrice] = useState('1.50');
  const [receivingBatch, setReceivingBatch] = useState(false);

  // Form: Adjust Stock
  const [adjustBatchId, setAdjustBatchId] = useState('');
  const [adjustType, setAdjustType] = useState<StockMovementType>(7); // Damaged
  const [adjustDelta, setAdjustDelta] = useState('5');
  const [adjustReason, setAdjustReason] = useState('Damaged packaging / moisture exposure');
  const [adjustingStock, setAdjustingStock] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Load Metrics
  const fetchMetrics = async () => {
    try {
      const data = await api.getPharmacyMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load pharmacy metrics:', err);
    }
  };

  // 2. Load Prescriptions Queue
  const fetchQueue = async () => {
    setRxLoading(true);
    try {
      const data = await api.getPrescriptionQueue({ query: rxSearch.trim() || undefined });
      setQueue(data);
      if (data.length > 0) {
        if (!selectedRx || !data.some((p) => p.id === selectedRx.id)) {
          setSelectedRx(data[0]);
        }
      } else {
        setSelectedRx(null);
      }
    } catch (err) {
      console.error('Failed to load prescription queue:', err);
    } finally {
      setRxLoading(false);
    }
  };

  // 3. Load Drugs
  const fetchDrugs = async () => {
    try {
      const data = await api.getPharmacyDrugs(drugSearch.trim() || undefined);
      setDrugs(data);
      if (data.length > 0 && !receiveDrugId) {
        setReceiveDrugId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load formulary drugs:', err);
    }
  };

  // 4. Load Batches
  const fetchBatches = async () => {
    try {
      const data = await api.getBatches();
      setBatches(data);
      if (data.length > 0 && !adjustBatchId) {
        setAdjustBatchId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  // 5. Load Stock Movements Ledger
  const fetchMovements = async () => {
    try {
      const data = await api.getStockMovements({ pageSize: 50 });
      setMovements(data.items);
    } catch (err) {
      console.error('Failed to load stock movements:', err);
    }
  };

  // Initial and reactive load
  useEffect(() => {
    fetchMetrics();
    fetchQueue();
    fetchDrugs();
    fetchBatches();
    fetchMovements();
  }, []);

  useEffect(() => {
    if (activeTab === 'queue') fetchQueue();
    if (activeTab === 'formulary') fetchDrugs();
    if (activeTab === 'batches') fetchBatches();
    if (activeTab === 'ledger') fetchMovements();
  }, [activeTab]);

  // Dispense Prescription with auto-FEFO allocation
  const handleDispenseRx = async () => {
    if (!selectedRx) return;
    setDispenseLoading(true);

    try {
      const lines = selectedRx.items
        .filter((i) => i.quantityRemaining > 0)
        .map((i) => ({
          prescriptionItemId: i.prescriptionItemId,
          quantityToDispense: i.quantityRemaining,
          inventoryBatchId: undefined, // Auto-FEFO
        }));

      if (lines.length === 0) {
        alert('All items in this prescription are already fully dispensed.');
        return;
      }

      const idempotencyKey = `DISP-${selectedRx.id}-${Date.now()}`;
      const record = await api.dispensePrescription(selectedRx.id, {
        idempotencyKey,
        lines,
      });

      showToast(`Medication dispensed for RX ${record.prescriptionNumber} ($${record.totalDispensedPrice.toFixed(2)}).`);
      fetchMetrics();
      fetchQueue();
      fetchBatches();
      fetchMovements();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Dispensing failed. Check stock availability.');
    } finally {
      setDispenseLoading(false);
    }
  };

  // Submit Add Drug
  const handleAddDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDrug(true);
    try {
      const drug = await api.createPharmacyDrug({
        code: newDrugCode.trim().toUpperCase(),
        brandName: newDrugBrand.trim(),
        genericName: newDrugGeneric.trim(),
        dosageForm: newDrugForm.trim(),
        strength: newDrugStrength.trim(),
        reorderLevel: parseInt(newDrugReorder, 10) || 10,
      });

      showToast(`Added '${drug.brandName}' (${drug.code}) to formulary.`);
      setShowAddDrugModal(false);
      setNewDrugCode('');
      setNewDrugBrand('');
      setNewDrugGeneric('');
      fetchDrugs();
      fetchMetrics();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to add medication.');
    } finally {
      setSavingDrug(false);
    }
  };

  // Submit Receive Batch
  const handleReceiveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveExpiry) {
      alert('Please select a valid expiry date.');
      return;
    }

    setReceivingBatch(true);
    try {
      const batch = await api.receiveBatch({
        drugId: receiveDrugId,
        batchNumber: receiveBatchNo.trim().toUpperCase(),
        expiryDate: receiveExpiry,
        quantity: parseInt(receiveQty, 10) || 1,
        unitCost: parseFloat(receiveCost) || 0,
        sellingPrice: parseFloat(receivePrice) || 0,
      });

      showToast(`Received batch ${batch.batchNumber} with ${batch.quantityReceived} units.`);
      setShowReceiveBatchModal(false);
      setReceiveBatchNo('');
      fetchBatches();
      fetchDrugs();
      fetchMovements();
      fetchMetrics();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to receive inventory batch.');
    } finally {
      setReceivingBatch(false);
    }
  };

  // Submit Stock Adjustment
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustingStock(true);
    try {
      const batch = await api.adjustStock({
        batchId: adjustBatchId,
        movementType: adjustType,
        quantityDelta: parseInt(adjustDelta, 10) || 1,
        reason: adjustReason.trim(),
      });

      showToast(`Stock updated for batch ${batch.batchNumber}. Remaining: ${batch.quantityOnHand}.`);
      setShowAdjustStockModal(false);
      fetchBatches();
      fetchDrugs();
      fetchMovements();
      fetchMetrics();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to adjust stock.');
    } finally {
      setAdjustingStock(false);
    }
  };

  return (
    <div className="module-container" style={{ padding: '0 0.5rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0f172a',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 9999,
            fontSize: '0.9rem',
          }}
        >
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Pill size={22} color="var(--primary)" />
            Hospital Pharmacy & Inventory Control
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Module F • Drug formulary, FEFO batch tracking, expiry monitoring, atomic dispensing, and immutable stock movement ledger.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowAdjustStockModal(true)}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ArrowUpDown size={14} />
            Stock Adjustment / Waste
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowReceiveBatchModal(true)}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Package size={14} />
            Receive Stock Batch
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddDrugModal(true)}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            Add Formulary Drug
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Formulary Drugs</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>{metrics?.totalDrugsCount ?? drugs.length}</div>
        </div>
        <div className="card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>Low Stock Alert</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: '#ef4444' }}>{metrics?.lowStockAlertsCount ?? 0}</div>
        </div>
        <div className="card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>Expiring (&lt;30 Days)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: '#f59e0b' }}>{metrics?.expiringBatches30DaysCount ?? 0}</div>
        </div>
        <div className="card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #b91c1c' }}>
          <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>Expired Stock</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: '#b91c1c' }}>{metrics?.expiredBatchesCount ?? 0}</div>
        </div>
        <div className="card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>Pending Dispense</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: '#0284c7' }}>{metrics?.pendingPrescriptionsCount ?? queue.length}</div>
        </div>
        <div className="card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Dispensed Today</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: '#10b981' }}>{metrics?.dispensedTodayCount ?? 0}</div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
        {[
          { id: 'queue' as const, label: 'Prescription Queue', icon: ClipboardCheck, count: queue.length },
          { id: 'formulary' as const, label: 'Drug Formulary', icon: Layers, count: drugs.length },
          { id: 'batches' as const, label: 'Inventory Batches (FEFO)', icon: Package, count: batches.length },
          { id: 'ledger' as const, label: 'Stock Movement Ledger', icon: History, count: movements.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 500,
                border: 'none',
                borderBottom: isActive ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--primary)' : '#64748b',
                cursor: 'pointer',
              }}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'rgba(13, 148, 136, 0.15)' : '#f1f5f9',
                    color: isActive ? 'var(--primary)' : '#64748b',
                    fontWeight: 600,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PRESCRIPTION QUEUE & ATOMIC DISPENSING */}
      {activeTab === 'queue' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Left: Queue List */}
          <div className="card" style={{ padding: '1rem', height: 'calc(100vh - 270px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                placeholder="Search patient or RX number..."
                className="input-field"
                value={rxSearch}
                onChange={(e) => setRxSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchQueue()}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', flex: 1 }}
              />
              <button className="btn btn-outline" onClick={fetchQueue} style={{ padding: '0.35rem 0.6rem' }}>
                <Search size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {rxLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <RefreshCw size={18} className="spin" style={{ margin: '0 auto 0.5rem auto' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading prescription queue...</span>
                </div>
              ) : queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No pending prescriptions in queue.
                </div>
              ) : (
                queue.map((rx) => {
                  const isSelected = selectedRx?.id === rx.id;
                  const hasAllergies = rx.patientAllergies.length > 0;
                  return (
                    <div
                      key={rx.id}
                      onClick={() => setSelectedRx(rx)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '6px',
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.05)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{rx.prescriptionNumber}</span>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: rx.status === 1 ? '#dcfce7' : '#fef3c7',
                            color: rx.status === 1 ? '#15803d' : '#b45309',
                            fontSize: '0.7rem',
                          }}
                        >
                          {rx.status === 1 ? 'Ready to Dispense' : 'Partially Dispensed'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>
                        {rx.patientName} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({rx.patientNumber})</span>
                      </div>

                      {hasAllergies && (
                        <div style={{ marginTop: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 5px', borderRadius: '3px', fontWeight: 600 }}>
                          <AlertTriangle size={11} /> Allergy: {rx.patientAllergies.join(', ')}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                        <span>{rx.items.length} Drug{rx.items.length !== 1 ? 's' : ''} • Dr. {rx.doctorName}</span>
                        <span>{new Date(rx.signedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Selected Prescription Dispensing Workbench */}
          <div className="card" style={{ padding: '1.25rem', minHeight: 'calc(100vh - 270px)' }}>
            {!selectedRx ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <ClipboardCheck size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                <h3>Select a Prescription</h3>
                <p style={{ fontSize: '0.85rem' }}>Choose an item from the left queue to review drugs and execute FEFO dispensing.</p>
              </div>
            ) : (
              <div>
                {/* Header Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                        {selectedRx.prescriptionNumber}
                      </h2>
                      <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                        Signed by Dr. {selectedRx.doctorName}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.3rem' }}>
                      Patient: <strong>{selectedRx.patientName}</strong> ({selectedRx.patientNumber}) • {selectedRx.patientGender} • Signed: {new Date(selectedRx.signedAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowPrintLabelModal(true)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Printer size={15} /> Print Medication Labels
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleDispenseRx}
                      disabled={dispenseLoading || selectedRx.items.every((i) => i.quantityRemaining === 0)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Sparkles size={15} />
                      {dispenseLoading ? 'Dispensing...' : 'Auto-FEFO Dispense All'}
                    </button>
                  </div>
                </div>

                {/* Patient Allergy Warning Banner */}
                {selectedRx.patientAllergies.length > 0 && (
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      marginBottom: '1.25rem',
                      color: '#991b1b',
                    }}
                  >
                    <AlertTriangle size={20} color="#dc2626" />
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong>Patient Allergy Alert:</strong> {selectedRx.patientAllergies.join('; ')}. Verify cross-sensitivity before releasing medication.
                    </div>
                  </div>
                )}

                {/* Prescribed Items & FEFO Allocations */}
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>
                  Prescribed Medication Items ({selectedRx.items.length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedRx.items.map((item) => {
                    const hasStock = item.availableStockOnHand >= item.quantityRemaining;
                    const isFullyDispensed = item.quantityRemaining === 0;

                    return (
                      <div
                        key={item.prescriptionItemId}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '1rem',
                          backgroundColor: isFullyDispensed ? '#f8fafc' : '#fff',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                              {item.drugName} <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 400 }}>({item.drugCode})</span>
                            </div>
                            <div style={{ fontSize: '0.825rem', color: '#475569', marginTop: '0.2rem' }}>
                              Directions: <strong>{item.dosage}</strong> • <strong>{item.frequency}</strong> • Route: <strong>{item.route}</strong> • Duration: {item.durationDays} day(s)
                            </div>
                            {item.instructions && (
                              <div style={{ fontSize: '0.75rem', color: '#0d9488', marginTop: '0.2rem' }}>
                                Instructions: <em>{item.instructions}</em>
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.85rem' }}>
                              Prescribed: <strong>{item.quantityPrescribed}</strong> | Dispensed: <strong>{item.quantityDispensed}</strong>
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '0.2rem', color: isFullyDispensed ? '#10b981' : '#b45309' }}>
                              {isFullyDispensed ? 'Fully Dispensed' : `Remaining Needed: ${item.quantityRemaining}`}
                            </div>
                          </div>
                        </div>

                        {/* FEFO Batch Allocation Suggestion Box */}
                        {!isFullyDispensed && (
                          <div
                            style={{
                              marginTop: '0.75rem',
                              padding: '0.6rem 0.8rem',
                              borderRadius: '4px',
                              backgroundColor: hasStock ? 'rgba(13, 148, 136, 0.05)' : '#fff1f2',
                              border: hasStock ? '1px solid #ccfbf1' : '1px solid #fecdd3',
                              fontSize: '0.8rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, color: hasStock ? '#0f766e' : '#be123c', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Package size={14} />
                                Available Non-Expired Stock on Hand: {item.availableStockOnHand} units
                              </span>
                              {!hasStock && (
                                <span style={{ color: '#be123c', fontWeight: 700 }}>
                                  ⚠️ INSUFFICIENT STOCK TO FULLY DISPENSE
                                </span>
                              )}
                            </div>

                            {item.suggestedFefoBatches.length > 0 && (
                              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#475569' }}>
                                <strong>FEFO Allocation Sequence (Earliest Expiry First):</strong>
                                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                                  {item.suggestedFefoBatches.map((b) => (
                                    <span
                                      key={b.id}
                                      style={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #cbd5e1',
                                        padding: '2px 6px',
                                        borderRadius: '3px',
                                      }}
                                    >
                                      Batch: <strong>{b.batchNumber}</strong> (Qty: {b.quantityOnHand}, Exp: {new Date(b.expiryDate).toLocaleDateString()}, ${b.sellingPrice.toFixed(2)}/unit)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DRUG FORMULARY CATALOG */}
      {activeTab === 'formulary' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', width: '320px' }}>
              <input
                type="text"
                placeholder="Search drug code, generic, brand..."
                className="input-field"
                value={drugSearch}
                onChange={(e) => setDrugSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchDrugs()}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', flex: 1 }}
              />
              <button className="btn btn-outline" onClick={fetchDrugs} style={{ padding: '0.35rem 0.6rem' }}>
                <Search size={14} />
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Showing {drugs.length} active formulary medications
            </div>
          </div>

          <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Code</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Brand Name</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Generic Name</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Form & Strength</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Stock on Hand</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Reorder Level</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Active Batches</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {drugs.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.75rem' }}><code>{d.code}</code></td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>{d.brandName}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>{d.genericName}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{d.dosageForm} • {d.strength}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <strong style={{ color: d.isLowStock ? '#ef4444' : '#0f172a' }}>
                        {d.totalStockOnHand} units
                      </strong>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>{d.reorderLevel} units</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                      {d.batches.length} batch(es)
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      {d.isLowStock ? (
                        <span style={{ color: '#b91c1c', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                          LOW STOCK
                        </span>
                      ) : (
                        <span style={{ color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                          OPTIMAL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY BATCHES (FEFO ORDER) */}
      {activeTab === 'batches' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Physical Inventory Batches (Ordered by Expiry Date • FEFO Compliant)
            </h3>
            <button className="btn btn-primary" onClick={() => setShowReceiveBatchModal(true)} style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}>
              <Package size={15} /> Receive Batch Shipment
            </button>
          </div>

          <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Batch Number</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Medication</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Expiry Date</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Days Left</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Received</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>On Hand</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Unit Cost</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Sell Price</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const isExpiringSoon = b.daysUntilExpiry > 0 && b.daysUntilExpiry <= 60;
                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: b.isExpired ? '#fff1f2' : isExpiringSoon ? '#fffbeb' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.6rem 0.75rem' }}><code>{b.batchNumber}</code></td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{b.drugName} ({b.drugCode})</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>{new Date(b.expiryDate).toLocaleDateString()}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        {b.isExpired ? (
                          <span style={{ color: '#b91c1c', fontWeight: 700 }}>EXPIRED</span>
                        ) : (
                          <span style={{ color: isExpiringSoon ? '#b45309' : '#0f172a', fontWeight: isExpiringSoon ? 700 : 400 }}>
                            {b.daysUntilExpiry} days
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>{b.quantityReceived}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <strong style={{ color: b.quantityOnHand === 0 ? '#94a3b8' : '#0f172a' }}>
                          {b.quantityOnHand}
                        </strong>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>${b.unitCost.toFixed(2)}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>${b.sellingPrice.toFixed(2)}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        {b.quantityOnHand === 0 ? (
                          <span style={{ fontSize: '0.72rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 5px', borderRadius: '3px' }}>Depleted</span>
                        ) : b.isExpired ? (
                          <span style={{ fontSize: '0.72rem', color: '#b91c1c', backgroundColor: '#fee2e2', padding: '2px 5px', borderRadius: '3px', fontWeight: 700 }}>Expired</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 5px', borderRadius: '3px', fontWeight: 600 }}>Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: STOCK MOVEMENTS LEDGER */}
      {activeTab === 'ledger' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Authoritative Stock Movement Ledger (Every delta tracked with timestamp & actor)
            </h3>
            <button className="btn btn-outline" onClick={fetchMovements} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
              <RefreshCw size={14} /> Refresh Ledger
            </button>
          </div>

          <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Timestamp</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Medication & Batch</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Movement Type</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Delta</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Balance After</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Reference</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Reason / Clinical Note</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Authorized By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <strong>{m.drugName}</strong> <span style={{ color: '#64748b' }}>({m.batchNumber})</span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '0.72rem' }}>
                        {STOCK_MOVEMENT_TYPE_NAMES[m.movementType] || 'Adjustment'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <strong style={{ color: m.quantityDelta > 0 ? '#15803d' : '#b91c1c' }}>
                        {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                      </strong>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{m.balanceAfter}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem' }}><code>{m.referenceId}</code></td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#475569' }}>{m.reason}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>{m.performedByUserName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD FORMULARY DRUG */}
      {showAddDrugModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} color="var(--primary)" /> Add Formulary Medication
              </h2>
              <button className="modal-close" onClick={() => setShowAddDrugModal(false)}>×</button>
            </div>

            <form onSubmit={handleAddDrug} style={{ marginTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Drug Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. MED-AMOX-500"
                    className="input-field"
                    value={newDrugCode}
                    onChange={(e) => setNewDrugCode(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Brand Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Amoxil"
                    className="input-field"
                    value={newDrugBrand}
                    onChange={(e) => setNewDrugBrand(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Generic Name (Active Ingredient) *</label>
                <input
                  type="text"
                  placeholder="e.g. Amoxicillin Trihydrate"
                  className="input-field"
                  value={newDrugGeneric}
                  onChange={(e) => setNewDrugGeneric(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Dosage Form</label>
                  <select className="input-field" value={newDrugForm} onChange={(e) => setNewDrugForm(e.target.value)}>
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Ointment">Ointment</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Strength</label>
                  <input
                    type="text"
                    placeholder="e.g. 500mg"
                    className="input-field"
                    value={newDrugStrength}
                    onChange={(e) => setNewDrugStrength(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Reorder Level</label>
                  <input
                    type="number"
                    className="input-field"
                    value={newDrugReorder}
                    onChange={(e) => setNewDrugReorder(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddDrugModal(false)} disabled={savingDrug}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingDrug}>
                  {savingDrug ? 'Saving...' : 'Add to Formulary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIVE BATCH SHIPMENT */}
      {showReceiveBatchModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '540px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} color="var(--primary)" /> Receive Inventory Shipment Batch
              </h2>
              <button className="modal-close" onClick={() => setShowReceiveBatchModal(false)}>×</button>
            </div>

            <form onSubmit={handleReceiveBatch} style={{ marginTop: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Medication *</label>
                <select className="input-field" value={receiveDrugId} onChange={(e) => setReceiveDrugId(e.target.value)} required>
                  {drugs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.brandName} ({d.genericName} {d.strength}) • {d.code}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Batch / Lot Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. AMX-2026-B2"
                    className="input-field"
                    value={receiveBatchNo}
                    onChange={(e) => setNewDrugBrand(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Expiry Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={receiveExpiry}
                    onChange={(e) => setReceiveExpiry(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Quantity Received *</label>
                  <input
                    type="number"
                    className="input-field"
                    value={receiveQty}
                    onChange={(e) => setReceiveQty(e.target.value)}
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="form-label">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={receiveCost}
                    onChange={(e) => setReceiveCost(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={receivePrice}
                    onChange={(e) => setReceivePrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowReceiveBatchModal(false)} disabled={receivingBatch}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={receivingBatch}>
                  {receivingBatch ? 'Receiving...' : 'Record Intake Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: STOCK ADJUSTMENT / WASTAGE */}
      {showAdjustStockModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowUpDown size={18} color="var(--primary)" /> Stock Adjustment & Wastage
              </h2>
              <button className="modal-close" onClick={() => setShowAdjustStockModal(false)}>×</button>
            </div>

            <form onSubmit={handleAdjustStock} style={{ marginTop: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Select Inventory Batch *</label>
                <select className="input-field" value={adjustBatchId} onChange={(e) => setAdjustBatchId(e.target.value)} required>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.drugName} • Batch: {b.batchNumber} (Avail: {b.quantityOnHand}, Exp: {new Date(b.expiryDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Reason / Type *</label>
                  <select className="input-field" value={adjustType} onChange={(e) => setAdjustType(parseInt(e.target.value, 10) as StockMovementType)}>
                    <option value={7}>Damaged Packaging (Waste)</option>
                    <option value={6}>Expired (Wastage)</option>
                    <option value={5}>Physical Count Discrepancy (-)</option>
                    <option value={4}>Found Stock / Reconciliation (+)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    className="input-field"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Clinical Audit Reason *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Detail the root cause..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAdjustStockModal(false)} disabled={adjustingStock}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={adjustingStock}>
                  {adjustingStock ? 'Saving...' : 'Apply Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINTABLE MEDICATION LABELS & RECEIPT */}
      {showPrintLabelModal && selectedRx && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '600px', width: '100%' }}>
            <div className="modal-header">
              <button
                className="btn btn-primary"
                onClick={() => window.print()}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Printer size={15} /> Print Physical Labels
              </button>
              <button className="modal-close" onClick={() => setShowPrintLabelModal(false)}>×</button>
            </div>

            <div id="printable-rx-labels" style={{ padding: '1.25rem', backgroundColor: '#fff', color: '#000' }}>
              <div style={{ textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>MERCY COMMUNITY HOSPITAL</h2>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>Outpatient & Clinical Pharmacy • Ph: +1-555-0199</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '0.3rem' }}>
                  DISPENSING SLIP & PATIENT MEDICATION LABELS
                </div>
              </div>

              <div style={{ fontSize: '0.825rem', marginBottom: '1rem', backgroundColor: '#f8fafc', padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div><strong>Patient:</strong> {selectedRx.patientName} ({selectedRx.patientNumber})</div>
                <div><strong>Prescription:</strong> {selectedRx.prescriptionNumber} • <strong>Doctor:</strong> Dr. {selectedRx.doctorName}</div>
                <div><strong>Date Dispensed:</strong> {new Date().toLocaleString()} • <strong>Pharmacist:</strong> {user?.fullName || 'Staff'}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedRx.items.map((item, idx) => (
                  <div
                    key={item.prescriptionItemId}
                    style={{
                      border: '1.5px dashed #000',
                      padding: '0.75rem',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem' }}>
                      <span>LABEL #{idx + 1}: {item.drugName}</span>
                      <span>Qty: {item.quantityPrescribed}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      <strong>Directions:</strong> Take {item.dosage} {item.frequency} via {item.route} for {item.durationDays} days.
                    </div>
                    {item.instructions && (
                      <div style={{ fontSize: '0.8rem', color: '#0d9488', marginTop: '0.2rem' }}>
                        Special Warning: {item.instructions}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.4rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.3rem' }}>
                      Patient: {selectedRx.patientName} • Keep out of reach of children.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
