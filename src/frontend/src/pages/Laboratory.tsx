import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ShieldCheck,
  Barcode,
  Layers,
  Save
} from 'lucide-react';
import {
  api,
  type LabOrderDto,
  type LabTestDto,
  type LabOrderStatus,
  type LabPriority,
  type EncounterDto,
  LAB_ORDER_STATUS_NAMES,
  LAB_PRIORITY_NAMES,
  type ApiError
} from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Laboratory: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<LabOrderDto[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<LabOrderDto | null>(null);
  const [labTests, setLabTests] = useState<LabTestDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Modals state
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // New Order Form
  const [encounters, setEncounters] = useState<EncounterDto[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState('');
  const [newOrderPriority, setNewOrderPriority] = useState<LabPriority>(0);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Result entry edit state
  const [resultEdits, setResultEdits] = useState<Record<string, { value: string; unit: string; isAbnormal: boolean; comments: string }>>({});
  const [savingResults, setSavingResults] = useState(false);

  // Verification Form
  const [verifyReleaseImmediately, setVerifyReleaseImmediately] = useState(true);
  const [verifying, setVerifying] = useState(false);

  // New Lab Test definition Form
  const [newTestCode, setNewTestCode] = useState('');
  const [newTestName, setNewTestName] = useState('');
  const [newTestCategory, setNewTestCategory] = useState('Biochemistry');
  const [newTestSpecimen, setNewTestSpecimen] = useState('Serum');
  const [newTestUnit, setNewTestUnit] = useState('mg/dL');
  const [newTestRange, setNewTestRange] = useState('');
  const [newTestPrice, setNewTestPrice] = useState('25.00');
  const [savingTest, setSavingTest] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Load Lab Tests & Orders
  const fetchTests = async () => {
    try {
      const tests = await api.getLabTests();
      setLabTests(tests);
    } catch (err) {
      console.error('Failed to load lab tests catalog:', err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let st: LabOrderStatus | undefined = undefined;
      if (statusFilter === 'ordered') st = 0;
      else if (statusFilter === 'collected') st = 1;
      else if (statusFilter === 'processing') st = 3;
      else if (statusFilter === 'draft') st = 4;
      else if (statusFilter === 'released') st = 6;

      let pr: LabPriority | undefined = undefined;
      if (priorityFilter === 'routine') pr = 0;
      else if (priorityFilter === 'urgent') pr = 1;
      else if (priorityFilter === 'stat') pr = 2;

      const res = await api.getLabOrders({
        status: st,
        priority: pr,
        date: selectedDate || undefined,
        query: searchQuery.trim() || undefined,
        pageSize: 50,
      });

      setOrders(res.items);
      if (res.items.length > 0) {
        if (!selectedOrder || !res.items.some((o) => o.id === selectedOrder.id)) {
          loadOrderDetails(res.items[0].id);
        }
      } else {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Failed to fetch lab orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, priorityFilter, selectedDate]);

  // Load Order Details & initialize result edits
  const loadOrderDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const order = await api.getLabOrderById(id);
      setSelectedOrder(order);

      // Initialize result edits dictionary
      const edits: Record<string, { value: string; unit: string; isAbnormal: boolean; comments: string }> = {};
      for (const item of order.items) {
        edits[item.id] = {
          value: item.resultValue || '',
          unit: item.resultUnit || item.labTestCode || '',
          isAbnormal: item.isAbnormal || false,
          comments: item.comments || '',
        };
      }
      setResultEdits(edits);
    } catch (err) {
      console.error('Failed to load lab order details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open New Order modal: fetch open encounters
  const handleOpenNewOrder = async () => {
    setShowNewOrderModal(true);
    setSelectedTestIds([]);
    try {
      const encRes = await api.getEncounters({ pageSize: 20 });
      const openEncounters = encRes.items.filter((e) => e.status !== 4); // not closed
      setEncounters(openEncounters);
      if (openEncounters.length > 0) {
        setSelectedEncounterId(openEncounters[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch encounters for lab order:', err);
    }
  };

  // Submit New Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncounterId) {
      alert('Please select an active clinical encounter.');
      return;
    }
    if (selectedTestIds.length === 0) {
      alert('Please select at least one diagnostic test.');
      return;
    }

    setOrderSubmitting(true);
    try {
      const created = await api.createLabOrder({
        encounterId: selectedEncounterId,
        priority: newOrderPriority,
        testIds: selectedTestIds,
      });

      showToast(`Lab order ${created.orderNumber} placed successfully.`);
      setShowNewOrderModal(false);
      fetchOrders();
      loadOrderDetails(created.id);
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to create lab order.');
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Collect Specimen
  const handleCollectSpecimen = async () => {
    if (!selectedOrder) return;
    try {
      const updated = await api.collectSpecimen(selectedOrder.id);
      showToast(`Specimens collected for order ${updated.orderNumber}.`);
      setShowCollectModal(false);
      loadOrderDetails(selectedOrder.id);
      fetchOrders();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to record specimen collection.');
    }
  };

  // Receive Specimen in Lab
  const handleReceiveSpecimen = async () => {
    if (!selectedOrder) return;
    try {
      const updated = await api.receiveSpecimen(selectedOrder.id);
      showToast(`Specimens marked as received and processing in lab (${updated.orderNumber}).`);
      loadOrderDetails(selectedOrder.id);
      fetchOrders();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to mark specimen received.');
    }
  };

  // Save Draft Results
  const handleSaveResults = async () => {
    if (!selectedOrder) return;
    setSavingResults(true);
    try {
      const payload = selectedOrder.items.map((i) => {
        const edit = resultEdits[i.id] || { value: '', unit: '', isAbnormal: false, comments: '' };
        return {
          labOrderItemId: i.id,
          resultValue: edit.value,
          resultUnit: edit.unit,
          isAbnormal: edit.isAbnormal,
          comments: edit.comments,
        };
      });

      await api.recordLabResults(selectedOrder.id, { results: payload });
      showToast(`Diagnostic results saved as draft for ${selectedOrder.orderNumber}.`);
      loadOrderDetails(selectedOrder.id);
      fetchOrders();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to record test results.');
    } finally {
      setSavingResults(false);
    }
  };

  // Verify and Release Results
  const handleVerifyResults = async () => {
    if (!selectedOrder) return;
    setVerifying(true);
    try {
      // First save any unsaved result edits
      const payload = selectedOrder.items.map((i) => {
        const edit = resultEdits[i.id] || { value: '', unit: '', isAbnormal: false, comments: '' };
        return {
          labOrderItemId: i.id,
          resultValue: edit.value,
          resultUnit: edit.unit,
          isAbnormal: edit.isAbnormal,
          comments: edit.comments,
        };
      });
      await api.recordLabResults(selectedOrder.id, { results: payload });

      // Then verify and release
      const verified = await api.verifyAndReleaseOrder(selectedOrder.id, {
        releaseImmediately: verifyReleaseImmediately,
        verificationNotes: `Verified by ${user?.fullName || 'Technician'}`,
      });

      showToast(`Order ${verified.orderNumber} verified, sealed, and released!`);
      setShowVerifyModal(false);
      loadOrderDetails(selectedOrder.id);
      fetchOrders();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to verify and release lab order.');
    } finally {
      setVerifying(false);
    }
  };

  // Cancel Order
  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    const reason = prompt('Please enter the reason for cancelling this lab order:');
    if (!reason || !reason.trim()) return;

    try {
      await api.cancelLabOrder(selectedOrder.id, reason.trim());
      showToast(`Order ${selectedOrder.orderNumber} cancelled.`);
      loadOrderDetails(selectedOrder.id);
      fetchOrders();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to cancel order.');
    }
  };

  // Create Lab Test definition
  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTest(true);
    try {
      const test = await api.createLabTest({
        code: newTestCode.trim().toUpperCase(),
        name: newTestName.trim(),
        category: newTestCategory.trim(),
        specimenType: newTestSpecimen.trim(),
        unitOfMeasure: newTestUnit.trim(),
        referenceRange: newTestRange.trim(),
        price: parseFloat(newTestPrice) || 0,
      });

      showToast(`Created test '${test.name}' (${test.code}).`);
      setNewTestCode('');
      setNewTestName('');
      setNewTestRange('');
      fetchTests();
    } catch (err: any) {
      const apiErr = err as ApiError;
      alert(apiErr.message || 'Failed to create diagnostic test.');
    } finally {
      setSavingTest(false);
    }
  };

  // Render Status Badge
  const getStatusBadge = (status: LabOrderStatus) => {
    switch (status) {
      case 0: // Ordered
        return <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>Ordered</span>;
      case 1: // Collected
        return <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>Specimen Collected</span>;
      case 2: // Received
      case 3: // Processing
        return <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>Processing</span>;
      case 4: // DraftResult
        return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>Draft Results</span>;
      case 5: // Verified
      case 6: // Released
        return <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>Verified & Released</span>;
      case 8: // Cancelled
        return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>Cancelled</span>;
      default:
        return <span className="badge">{LAB_ORDER_STATUS_NAMES[status] || 'Unknown'}</span>;
    }
  };

  // Render Priority Badge
  const getPriorityBadge = (priority: LabPriority) => {
    switch (priority) {
      case 0:
        return <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>Routine</span>;
      case 1:
        return <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 600 }}>Urgent</span>;
      case 2:
        return (
          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <AlertTriangle size={11} /> STAT
          </span>
        );
      default:
        return null;
    }
  };

  // Metrics summary
  const totalCount = orders.length;
  const pendingCollectionCount = orders.filter((o) => o.status === 0).length;
  const inLabCount = orders.filter((o) => o.status === 1 || o.status === 2 || o.status === 3).length;
  const draftCount = orders.filter((o) => o.status === 4).length;
  const releasedCount = orders.filter((o) => o.status === 5 || o.status === 6).length;

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
            <FlaskConical size={22} color="var(--primary)" />
            Diagnostic Laboratory Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Module E • Test catalog, specimen collection & barcodes, result entry, dual-step verification, and clinical reports.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowCatalogModal(true)}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Layers size={14} />
            Test Catalog ({labTests.length})
          </button>
          <button
            className="btn btn-outline"
            onClick={fetchOrders}
            disabled={loading}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenNewOrder}
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            Order Lab Tests
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.8rem', marginBottom: '1.2rem' }}>
        <div className="card" style={{ padding: '0.8rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Orders</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '0.2rem' }}>{totalCount}</div>
        </div>
        <div className="card" style={{ padding: '0.8rem 1rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>Pending Collection</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '0.2rem', color: '#0284c7' }}>{pendingCollectionCount}</div>
        </div>
        <div className="card" style={{ padding: '0.8rem 1rem', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600 }}>In Processing</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '0.2rem', color: '#6366f1' }}>{inLabCount}</div>
        </div>
        <div className="card" style={{ padding: '0.8rem 1rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 600 }}>Draft Results</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '0.2rem', color: '#8b5cf6' }}>{draftCount}</div>
        </div>
        <div className="card" style={{ padding: '0.8rem 1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Released & Verified</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '0.2rem', color: '#10b981' }}>{releasedCount}</div>
        </div>
      </div>

      {/* Main Split LIMS Workstation Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '370px 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* LEFT COLUMN: ORDERS WORKLIST */}
        <div className="card" style={{ padding: '1rem', height: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
          {/* Search & Filter */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <input
                type="text"
                placeholder="Search patient, order #, barcode..."
                className="input-field"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', flex: 1 }}
              />
              <button className="btn btn-outline" onClick={fetchOrders} style={{ padding: '0.35rem 0.6rem' }} title="Search">
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
                title="Filter by order date"
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

            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'ordered', label: 'Ordered' },
                { id: 'processing', label: 'In Lab' },
                { id: 'draft', label: 'Draft' },
                { id: 'released', label: 'Released' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStatusFilter(t.id)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.72rem',
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

            {/* Priority Filter */}
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {[
                { id: 'all', label: 'All Pri' },
                { id: 'urgent', label: 'Urgent' },
                { id: 'stat', label: 'STAT Only' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPriorityFilter(p.id)}
                  style={{
                    padding: '0.2rem 0.45rem',
                    fontSize: '0.7rem',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    backgroundColor: priorityFilter === p.id ? '#0f172a' : '#fff',
                    color: priorityFilter === p.id ? '#fff' : '#64748b',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <RefreshCw size={18} className="spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading lab orders...</span>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No lab orders matching criteria.
              </div>
            ) : (
              orders.map((o) => {
                const isSelected = selectedOrder?.id === o.id;
                return (
                  <div
                    key={o.id}
                    onClick={() => loadOrderDetails(o.id)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.05)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{o.orderNumber}</span>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        {getPriorityBadge(o.priority)}
                        {getStatusBadge(o.status)}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.15rem' }}>
                      {o.patientName} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({o.patientNumber})</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                      <span>{o.items.length} Test{o.items.length !== 1 ? 's' : ''} • ${o.totalPrice.toFixed(2)}</span>
                      <span>{new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LIMS DETAIL & WORKBENCH */}
        <div className="card" style={{ padding: '1.25rem', minHeight: 'calc(100vh - 220px)' }}>
          {detailsLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 1rem auto' }} />
              <div>Loading lab order details...</div>
            </div>
          ) : !selectedOrder ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <FlaskConical size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
              <h3>Select a Lab Order</h3>
              <p style={{ fontSize: '0.85rem' }}>Select an order from the list on the left to enter results or perform verification.</p>
            </div>
          ) : (
            <div>
              {/* Order Header Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid #e2e8f0',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                      Order {selectedOrder.orderNumber}
                    </h2>
                    {getStatusBadge(selectedOrder.status)}
                    {getPriorityBadge(selectedOrder.priority)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.3rem' }}>
                    Patient: <strong>{selectedOrder.patientName}</strong> ({selectedOrder.patientNumber}) • {selectedOrder.patientGender} • Ordered by: <strong>{selectedOrder.doctorName}</strong> ({selectedOrder.doctorDepartment})
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowPrintModal(true)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Printer size={15} />
                    Print Report
                  </button>

                  {selectedOrder.status !== 5 && selectedOrder.status !== 6 && selectedOrder.status !== 8 && (
                    <button
                      className="btn btn-outline"
                      onClick={handleCancelOrder}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', color: '#ef4444', borderColor: '#fca5a5' }}
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>

              {/* Specimen Lifecycle Step Tracker */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Specimen Status: </span>
                    <strong style={{ color: selectedOrder.status >= 1 ? '#10b981' : '#f59e0b' }}>
                      {selectedOrder.status === 0 ? 'Pending Collection' : selectedOrder.status === 1 ? 'Collected' : 'Received in Laboratory'}
                    </strong>
                  </div>
                  {selectedOrder.items[0]?.specimenCollectedAt && (
                    <div>
                      <span style={{ color: '#94a3b8' }}>Collected: </span>
                      <strong>{new Date(selectedOrder.items[0].specimenCollectedAt).toLocaleString()}</strong>
                    </div>
                  )}
                  {selectedOrder.items[0]?.specimenBarcode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Barcode size={15} color="#0d9488" />
                      <span>Barcode: <code>{selectedOrder.items[0].specimenBarcode}</code></span>
                    </div>
                  )}
                </div>

                {/* Workflow advance action buttons */}
                <div>
                  {selectedOrder.status === 0 && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowCollectModal(true)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      Record Specimen Collection
                    </button>
                  )}
                  {selectedOrder.status === 1 && (
                    <button
                      className="btn btn-primary"
                      onClick={handleReceiveSpecimen}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      Mark Received in Lab
                    </button>
                  )}
                </div>
              </div>

              {/* TEST RESULTS WORKBENCH TABLE */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                    Diagnostic Test Results ({selectedOrder.items.length})
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {selectedOrder.status === 6 || selectedOrder.status === 5 ? (
                      <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <ShieldCheck size={16} /> Results finalized and locked
                      </span>
                    ) : (
                      <span>Enter values and flags, then verify to seal results</span>
                    )}
                  </div>
                </div>

                <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Test Name & Code</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Specimen</th>
                        <th style={{ padding: '0.6rem 0.75rem', width: '160px' }}>Result Value</th>
                        <th style={{ padding: '0.6rem 0.75rem', width: '90px' }}>Unit</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Reference Range</th>
                        <th style={{ padding: '0.6rem 0.75rem', width: '100px' }}>Abnormal Flag</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Comments / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => {
                        const isLocked = selectedOrder.status === 5 || selectedOrder.status === 6 || selectedOrder.status === 8;
                        const edit = resultEdits[item.id] || { value: '', unit: '', isAbnormal: false, comments: '' };

                        return (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              backgroundColor: edit.isAbnormal ? '#fff1f2' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              <div style={{ fontWeight: 600 }}>{item.labTestName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                <code>{item.labTestCode}</code> • {item.category}
                              </div>
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                              {item.specimenType}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              {isLocked ? (
                                <strong style={{ color: item.isAbnormal ? '#b91c1c' : '#0f172a' }}>
                                  {item.resultValue || 'N/A'}
                                </strong>
                              ) : (
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="e.g. 5.4"
                                  value={edit.value}
                                  onChange={(e) => {
                                    setResultEdits({
                                      ...resultEdits,
                                      [item.id]: { ...edit, value: e.target.value },
                                    });
                                  }}
                                  style={{
                                    fontSize: '0.825rem',
                                    padding: '0.35rem 0.5rem',
                                    width: '100%',
                                    fontWeight: edit.isAbnormal ? 700 : 400,
                                    borderColor: edit.isAbnormal ? '#f87171' : undefined,
                                  }}
                                />
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              {isLocked ? (
                                <span>{item.resultUnit}</span>
                              ) : (
                                <input
                                  type="text"
                                  className="input-field"
                                  value={edit.unit}
                                  onChange={(e) => {
                                    setResultEdits({
                                      ...resultEdits,
                                      [item.id]: { ...edit, unit: e.target.value },
                                    });
                                  }}
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', width: '100%' }}
                                />
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                              {item.referenceRangeSnapshot || 'N/A'}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              {isLocked ? (
                                item.isAbnormal ? (
                                  <span style={{ color: '#b91c1c', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <AlertTriangle size={14} /> ABNORMAL
                                  </span>
                                ) : (
                                  <span style={{ color: '#15803d', fontWeight: 600 }}>Normal</span>
                                )
                              ) : (
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.78rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={edit.isAbnormal}
                                    onChange={(e) => {
                                      setResultEdits({
                                        ...resultEdits,
                                        [item.id]: { ...edit, isAbnormal: e.target.checked },
                                      });
                                    }}
                                  />
                                  <span style={{ color: edit.isAbnormal ? '#b91c1c' : '#64748b', fontWeight: edit.isAbnormal ? 700 : 400 }}>
                                    Abnormal
                                  </span>
                                </label>
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              {isLocked ? (
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.comments || '—'}</span>
                              ) : (
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Clinical remarks..."
                                  value={edit.comments}
                                  onChange={(e) => {
                                    setResultEdits({
                                      ...resultEdits,
                                      [item.id]: { ...edit, comments: e.target.value },
                                    });
                                  }}
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', width: '100%' }}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Verification & Audit Footer */}
              {selectedOrder.status === 6 || selectedOrder.status === 5 ? (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '6px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <ShieldCheck size={22} color="#059669" />
                  <div style={{ fontSize: '0.85rem', color: '#065f46' }}>
                    <strong>Verified and Digitally Released:</strong> Stamped by{' '}
                    <strong>{selectedOrder.items[0]?.verifiedByUserName || 'Clinical Supervisor'}</strong> on{' '}
                    {selectedOrder.items[0]?.verifiedAt
                      ? new Date(selectedOrder.items[0].verifiedAt).toLocaleString()
                      : 'N/A'}.
                    Results are immutable and stored in the authoritative electronic medical record.
                  </div>
                </div>
              ) : selectedOrder.status !== 8 ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    className="btn btn-outline"
                    onClick={handleSaveResults}
                    disabled={savingResults}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Save size={16} />
                    {savingResults ? 'Saving...' : 'Save Draft Results'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowVerifyModal(true)}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <ShieldCheck size={16} />
                    Verify & Release Results
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: NEW LAB ORDER */}
      {showNewOrderModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '640px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} color="var(--primary)" />
                Order Diagnostic Laboratory Tests
              </h2>
              <button className="modal-close" onClick={() => setShowNewOrderModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ marginTop: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Active Clinical Encounter *</label>
                {encounters.length === 0 ? (
                  <div style={{ padding: '0.6rem', backgroundColor: '#fff1f2', color: '#b91c1c', borderRadius: '4px', fontSize: '0.825rem' }}>
                    No open encounters found. Start an encounter in the Clinical Workstation first.
                  </div>
                ) : (
                  <select
                    className="input-field"
                    value={selectedEncounterId}
                    onChange={(e) => setSelectedEncounterId(e.target.value)}
                    required
                  >
                    {encounters.map((enc) => (
                      <option key={enc.id} value={enc.id}>
                        {enc.patientName} ({enc.patientNumber}) • Dr. {enc.doctorName} • {new Date(enc.startedAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Priority Level *</label>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  {[
                    { id: 0 as LabPriority, label: 'Routine (Standard turnaround)' },
                    { id: 1 as LabPriority, label: 'Urgent (Priority processing)' },
                    { id: 2 as LabPriority, label: 'STAT (Immediate escalation)' },
                  ].map((p) => (
                    <label
                      key={p.id}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        borderRadius: '6px',
                        border: newOrderPriority === p.id ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                        backgroundColor: newOrderPriority === p.id ? 'rgba(13, 148, 136, 0.05)' : '#fff',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <input
                        type="radio"
                        name="priority"
                        checked={newOrderPriority === p.id}
                        onChange={() => setNewOrderPriority(p.id)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Select Diagnostic Tests ({selectedTestIds.length} selected)
                </label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem' }}>
                  {labTests.map((test) => {
                    const isChecked = selectedTestIds.includes(test.id);
                    return (
                      <label
                        key={test.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.45rem 0.6rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: isChecked ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                          marginBottom: '0.2rem',
                          fontSize: '0.825rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTestIds([...selectedTestIds, test.id]);
                              } else {
                                setSelectedTestIds(selectedTestIds.filter((id) => id !== test.id));
                              }
                            }}
                          />
                          <div>
                            <strong>{test.name}</strong> <span style={{ color: '#64748b' }}>({test.code})</span>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              {test.category} • Specimen: {test.specimenType}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>${test.price.toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowNewOrderModal(false)}
                  disabled={orderSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={orderSubmitting || selectedTestIds.length === 0}
                >
                  {orderSubmitting ? 'Placing Order...' : 'Submit Lab Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SPECIMEN COLLECTION CONFIRMATION */}
      {showCollectModal && selectedOrder && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '480px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Barcode size={18} color="var(--primary)" />
                Record Specimen Collection
              </h2>
              <button className="modal-close" onClick={() => setShowCollectModal(false)}>×</button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              <p style={{ color: '#475569', marginBottom: '1rem' }}>
                Confirm physical specimen collection for <strong>{selectedOrder.patientName}</strong> ({selectedOrder.patientNumber}).
              </p>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Specimens to Collect:</div>
                {selectedOrder.items.map((i, idx) => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' }}>
                    <span>{idx + 1}. {i.labTestName} ({i.specimenType})</span>
                    <code>{i.specimenBarcode}</code>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Barcodes will be locked and timestamp recorded to current UTC time.
              </p>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
                <button className="btn btn-outline" onClick={() => setShowCollectModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleCollectSpecimen}>
                  Confirm Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VERIFY & RELEASE RESULTS */}
      {showVerifyModal && selectedOrder && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="var(--primary)" />
                Two-Step Verification & Release
              </h2>
              <button className="modal-close" onClick={() => setShowVerifyModal(false)}>×</button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              <p style={{ color: '#475569', marginBottom: '0.8rem' }}>
                You are about to finalize, verify, and seal the test results for order <strong>{selectedOrder.orderNumber}</strong>.
              </p>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Summary of Results:</div>
                {selectedOrder.items.map((item) => {
                  const val = resultEdits[item.id]?.value || item.resultValue;
                  const isAbn = resultEdits[item.id]?.isAbnormal || item.isAbnormal;
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' }}>
                      <span>{item.labTestName}:</span>
                      <strong style={{ color: isAbn ? '#b91c1c' : '#0f172a' }}>
                        {val || 'NOT ENTERED'} {resultEdits[item.id]?.unit || item.resultUnit} {isAbn ? '(ABNORMAL)' : ''}
                      </strong>
                    </div>
                  );
                })}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={verifyReleaseImmediately}
                  onChange={(e) => setVerifyReleaseImmediately(e.target.checked)}
                />
                <span><strong>Release immediately</strong> to patient clinical chart and reports.</span>
              </label>

              <div style={{ backgroundColor: '#ecfdf5', padding: '0.6rem', borderRadius: '4px', fontSize: '0.75rem', color: '#065f46' }}>
                Digitally stamped with Verifier ID: <strong>{user?.fullName || 'Staff'}</strong> ({user?.roleName || 'Technician'}). Once released, results are strictly immutable.
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
                <button className="btn btn-outline" onClick={() => setShowVerifyModal(false)} disabled={verifying}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleVerifyResults} disabled={verifying}>
                  {verifying ? 'Verifying...' : 'Sign, Seal & Release'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINTABLE MEDICAL LAB REPORT */}
      {showPrintModal && selectedOrder && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Printer size={15} /> Print Physical Report
                </button>
              </div>
              <button className="modal-close" onClick={() => setShowPrintModal(false)}>×</button>
            </div>

            {/* Clean Medical Document Format */}
            <div
              id="printable-lab-report"
              style={{
                padding: '1.5rem',
                backgroundColor: '#fff',
                color: '#000',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {/* Hospital Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Mercy Community Hospital
                </h1>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
                  Diagnostic Pathology & Clinical Laboratory Department • 100 Healthcare Blvd
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.6rem', letterSpacing: '1px' }}>
                  CLINICAL LABORATORY REPORT
                </div>
              </div>

              {/* Patient & Order Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.6rem 2rem',
                  fontSize: '0.85rem',
                  backgroundColor: '#f8fafc',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  marginBottom: '1.25rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div><strong>Patient Name:</strong> {selectedOrder.patientName}</div>
                <div><strong>Order Number:</strong> {selectedOrder.orderNumber}</div>
                <div><strong>Patient ID:</strong> {selectedOrder.patientNumber}</div>
                <div><strong>Ordering Doctor:</strong> Dr. {selectedOrder.doctorName} ({selectedOrder.doctorDepartment})</div>
                <div><strong>Gender / DOB:</strong> {selectedOrder.patientGender} • {new Date(selectedOrder.patientDateOfBirth).toLocaleDateString()}</div>
                <div><strong>Order Date:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</div>
                <div><strong>Specimen Barcode:</strong> {selectedOrder.items[0]?.specimenBarcode || 'N/A'}</div>
                <div><strong>Priority:</strong> {LAB_PRIORITY_NAMES[selectedOrder.priority]}</div>
              </div>

              {/* Result Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #0f172a', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '0.6rem' }}>Test Investigation</th>
                    <th style={{ padding: '0.6rem' }}>Specimen</th>
                    <th style={{ padding: '0.6rem' }}>Result Value</th>
                    <th style={{ padding: '0.6rem' }}>Units</th>
                    <th style={{ padding: '0.6rem' }}>Reference Interval</th>
                    <th style={{ padding: '0.6rem' }}>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((i) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.55rem' }}>
                        <strong>{i.labTestName}</strong> <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({i.labTestCode})</span>
                      </td>
                      <td style={{ padding: '0.55rem', color: '#475569' }}>{i.specimenType}</td>
                      <td style={{ padding: '0.55rem', fontWeight: i.isAbnormal ? 700 : 600, color: i.isAbnormal ? '#b91c1c' : '#0f172a' }}>
                        {i.resultValue || 'Pending'}
                      </td>
                      <td style={{ padding: '0.55rem', color: '#475569' }}>{i.resultUnit || '—'}</td>
                      <td style={{ padding: '0.55rem', color: '#475569' }}>{i.referenceRangeSnapshot || '—'}</td>
                      <td style={{ padding: '0.55rem' }}>
                        {i.isAbnormal ? (
                          <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', border: '1px solid #b91c1c', padding: '1px 4px', borderRadius: '3px' }}>
                            ABNORMAL
                          </span>
                        ) : (
                          <span style={{ color: '#166534', fontSize: '0.75rem' }}>NORMAL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures & Certification */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                <div>
                  <div style={{ color: '#64748b' }}>Entered by:</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {selectedOrder.items[0]?.enteredByUserName || 'Medical Laboratory Technician'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748b' }}>Electronically Verified & Approved by:</div>
                  <div style={{ fontWeight: 700, marginTop: '0.2rem', color: '#0f172a' }}>
                    {selectedOrder.items[0]?.verifiedByUserName || 'Consultant Pathologist, MD'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Timestamp: {selectedOrder.items[0]?.verifiedAt ? new Date(selectedOrder.items[0].verifiedAt).toLocaleString() : 'Pending verification'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: TEST CATALOG MANAGEMENT */}
      {showCatalogModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="var(--primary)" />
                Standard Diagnostic Test Catalog
              </h2>
              <button className="modal-close" onClick={() => setShowCatalogModal(false)}>×</button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              {/* Add New Test Form */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>Register New Diagnostic Test</h3>
                <form onSubmit={handleCreateTest}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <div>
                      <label className="form-label">Code *</label>
                      <input
                        type="text"
                        placeholder="e.g. TROP-I"
                        className="input-field"
                        value={newTestCode}
                        onChange={(e) => setNewTestCode(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Troponin-I High Sensitivity"
                        className="input-field"
                        value={newTestName}
                        onChange={(e) => setNewTestName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Category *</label>
                      <select className="input-field" value={newTestCategory} onChange={(e) => setNewTestCategory(e.target.value)}>
                        <option value="Hematology">Hematology</option>
                        <option value="Biochemistry">Biochemistry</option>
                        <option value="Microbiology">Microbiology</option>
                        <option value="Immunology">Immunology</option>
                        <option value="Cardiology">Cardiology</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label className="form-label">Specimen *</label>
                      <input
                        type="text"
                        placeholder="Serum / Whole Blood"
                        className="input-field"
                        value={newTestSpecimen}
                        onChange={(e) => setNewTestSpecimen(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Units</label>
                      <input
                        type="text"
                        placeholder="mg/dL, mmol/L"
                        className="input-field"
                        value={newTestUnit}
                        onChange={(e) => setNewTestUnit(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Reference Range</label>
                      <input
                        type="text"
                        placeholder="e.g. 70 - 99 mg/dL"
                        className="input-field"
                        value={newTestRange}
                        onChange={(e) => setNewTestRange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={newTestPrice}
                        onChange={(e) => setNewTestPrice(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" disabled={savingTest} style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}>
                      {savingTest ? 'Saving...' : 'Add Test to Catalog'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Tests Table */}
              <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <table style={{ width: '100%', fontSize: '0.825rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Code</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Category</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Specimen</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Ref Range & Units</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Price</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labTests.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}><code>{t.code}</code></td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{t.name}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{t.category}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>{t.specimenType}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>
                          {t.referenceRange || 'N/A'} {t.unitOfMeasure ? `(${t.unitOfMeasure})` : ''}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>${t.price.toFixed(2)}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <span style={{ color: t.isActive ? '#166534' : '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
