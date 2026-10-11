import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  Receipt,
  Printer,
  DollarSign,
  TrendingUp,
  Clock,
  Ban,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import {
  api,
  type InvoiceDto,
  type PaymentDto,
  type ServiceItemDto,
  type CashierShiftSummaryDto,
  type BillingDashboardMetricsDto,
  type InvoiceStatus,
  type PaymentMethod,
  INVOICE_STATUS_NAMES,
  PAYMENT_METHOD_NAMES,
  type ApiError
} from '../api/client';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';

export const Billing: React.FC = () => {
  const {
    activePatient,
    workflowAction,
    clearWorkflowAction
  } = useNavigation();
  const toast = useToast();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<'invoices' | 'terminal' | 'chargemaster' | 'shift'>('invoices');

  // Metrics
  const [metrics, setMetrics] = useState<BillingDashboardMetricsDto | null>(null);

  // Invoices tab
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDto | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Chargemaster tab
  const [services, setServices] = useState<ServiceItemDto[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Fast Payment Terminal tab
  const [terminalInvoiceId, setTerminalInvoiceId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>(0); // Cash
  const [payReference, setPayReference] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [lastPaymentReceipt, setLastPaymentReceipt] = useState<PaymentDto | null>(null);

  // Shift reconciliation tab
  const [shiftSummary, setShiftSummary] = useState<CashierShiftSummaryDto | null>(null);
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split('T')[0]);

  // Modals state
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showPrintInvoiceModal, setShowPrintInvoiceModal] = useState(false);
  const [showPrintReceiptModal, setShowPrintReceiptModal] = useState(false);

  // Form: Create Manual Invoice
  const [newInvPatientId, setNewInvPatientId] = useState('');
  const [newInvDiscount, setNewInvDiscount] = useState('0');
  const [newInvTax, setNewInvTax] = useState('0');
  const [newInvLines, setNewInvLines] = useState<Array<{ desc: string; qty: number; price: number }>>([
    { desc: 'Outpatient Medical Service', qty: 1, price: 35.00 }
  ]);
  const [patientsList, setPatientsList] = useState<Array<{ id: string; fullName: string; patientNumber: string }>>([]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Form: Add Service
  const [newSrvCode, setNewSrvCode] = useState('');
  const [newSrvName, setNewSrvName] = useState('');
  const [newSrvCategory, setNewSrvCategory] = useState('Consultation');
  const [newSrvPrice, setNewSrvPrice] = useState('50.00');
  const [savingService, setSavingService] = useState(false);

  // Form: Void Invoice
  const [voidReason, setVoidReason] = useState('Administrative cancellation / Duplicate invoice');
  const [voidingInvoice, setVoidingInvoice] = useState(false);

  // Form: Refund Payment
  const [targetPaymentId, setTargetPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('Patient requested refund / Rescheduled service');
  const [refunding, setRefunding] = useState(false);

  const showToast = (msg: string) => {
    toast.success(msg);
  };

  // 1. Load Metrics
  const fetchMetrics = async () => {
    try {
      const data = await api.getBillingMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load billing metrics:', err);
    }
  };

  // 2. Load Invoices
  const fetchInvoices = async () => {
    setInvoiceLoading(true);
    try {
      const filterStatus = statusFilter !== 'all' ? (parseInt(statusFilter) as InvoiceStatus) : undefined;
      const res = await api.getInvoices({
        query: invoiceSearch.trim() || undefined,
        status: filterStatus,
        pageSize: 50
      });
      setInvoices(res.items);
      if (res.items.length > 0) {
        if (!selectedInvoice || !res.items.some(i => i.id === selectedInvoice.id)) {
          setSelectedInvoice(res.items[0]);
        }
      } else {
        setSelectedInvoice(null);
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setInvoiceLoading(false);
    }
  };

  // 3. Load Chargemaster Services
  const fetchServices = async () => {
    try {
      const cat = categoryFilter !== 'all' ? categoryFilter : undefined;
      const data = await api.getServices({
        query: serviceSearch.trim() || undefined,
        category: cat
      });
      setServices(data);
    } catch (err) {
      console.error('Failed to load chargemaster services:', err);
    }
  };

  // 4. Load Cashier Shift Summary
  const fetchShiftSummary = async () => {
    try {
      const data = await api.getCashierShiftSummary({ date: shiftDate });
      setShiftSummary(data);
    } catch (err) {
      console.error('Failed to load shift summary:', err);
    }
  };

  // Load Patient list for manual invoice
  const fetchPatients = async () => {
    try {
      const res = await api.getPatients({ pageSize: 100 });
      setPatientsList(res.items.map(p => ({
        id: p.id,
        fullName: `${p.firstName} ${p.lastName}`,
        patientNumber: p.patientNumber
      })));
      if (res.items.length > 0 && !newInvPatientId) {
        setNewInvPatientId(res.items[0].id);
      }
    } catch (err) {
      console.error('Failed to load patients for billing:', err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchInvoices();
    fetchServices();
    fetchShiftSummary();
    fetchPatients();
  }, []);

  // Phase 12: Handle cross-module workflow actions
  useEffect(() => {
    if (workflowAction) {
      if (workflowAction.action === 'open-terminal') {
        setActiveTab('terminal');
        clearWorkflowAction();
      } else if (workflowAction.action === 'view-invoices') {
        setActiveTab('invoices');
        if (activePatient) {
          setInvoiceSearch(activePatient.patientNumber || activePatient.fullName);
        }
        clearWorkflowAction();
      }
    }
  }, [workflowAction, activePatient]);

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  useEffect(() => {
    fetchServices();
  }, [categoryFilter]);

  useEffect(() => {
    fetchShiftSummary();
  }, [shiftDate]);

  // Quick select an invoice into Payment Terminal
  const selectForPayment = (inv: InvoiceDto) => {
    setSelectedInvoice(inv);
    setTerminalInvoiceId(inv.id);
    setPayAmount(inv.balance.toString());
    setActiveTab('terminal');
  };

  // Handle Recording Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInvoiceId) {
      showToast('Please select an invoice to record payment.');
      return;
    }

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount greater than zero.');
      return;
    }

    setPaymentProcessing(true);
    try {
      const idempotencyKey = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await api.recordPayment({
        invoiceId: terminalInvoiceId,
        amount: amt,
        method: payMethod,
        providerReference: payReference.trim() || undefined,
        idempotencyKey
      });

      setLastPaymentReceipt(res);
      showToast(`Payment of $${amt.toFixed(2)} recorded successfully! Receipt: ${res.receiptNumber}`);
      await fetchInvoices();
      await fetchMetrics();
      await fetchShiftSummary();

      // Refresh currently selected invoice
      const updated = await api.getInvoiceById(terminalInvoiceId);
      setSelectedInvoice(updated);
      setPayAmount(updated.balance.toString());
      setPayReference('');
    } catch (err: any) {
      const apiErr = err as ApiError;
      showToast(apiErr.message || 'Failed to capture payment.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Handle Void Invoice
  const handleVoidInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setVoidingInvoice(true);
    try {
      await api.voidInvoice(selectedInvoice.id, voidReason);
      showToast(`Invoice ${selectedInvoice.invoiceNumber} voided.`);
      setShowVoidModal(false);
      await fetchInvoices();
      await fetchMetrics();
    } catch (err: any) {
      const apiErr = err as ApiError;
      showToast(apiErr.message || 'Failed to void invoice.');
    } finally {
      setVoidingInvoice(false);
    }
  };

  // Handle Refund
  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPaymentId) return;

    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Enter a valid refund amount.');
      return;
    }

    setRefunding(true);
    try {
      await api.processRefund(targetPaymentId, {
        amount: amt,
        reason: refundReason
      });
      showToast(`Refund of $${amt.toFixed(2)} processed successfully.`);
      setShowRefundModal(false);
      await fetchInvoices();
      await fetchShiftSummary();
      await fetchMetrics();
    } catch (err: any) {
      const apiErr = err as ApiError;
      showToast(apiErr.message || 'Failed to process refund.');
    } finally {
      setRefunding(false);
    }
  };

  // Handle Create Service
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingService(true);
    try {
      await api.createService({
        code: newSrvCode.trim().toUpperCase(),
        name: newSrvName.trim(),
        category: newSrvCategory.trim(),
        defaultPrice: parseFloat(newSrvPrice) || 0
      });
      showToast(`Service '${newSrvName}' added to chargemaster.`);
      setShowAddServiceModal(false);
      setNewSrvCode('');
      setNewSrvName('');
      setNewSrvPrice('50.00');
      await fetchServices();
      await fetchMetrics();
    } catch (err: any) {
      const apiErr = err as ApiError;
      showToast(apiErr.message || 'Failed to add service.');
    } finally {
      setSavingService(false);
    }
  };

  // Handle Create Manual Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvPatientId) {
      showToast('Please select a patient.');
      return;
    }

    setCreatingInvoice(true);
    try {
      const res = await api.createInvoice({
        patientId: newInvPatientId,
        discount: parseFloat(newInvDiscount) || 0,
        taxPercentage: parseFloat(newInvTax) || 0,
        lines: newInvLines.map(l => ({
          itemDescription: l.desc,
          quantity: l.qty,
          unitPrice: l.price,
          sourceType: 'ManualService'
        }))
      });
      showToast(`Invoice ${res.invoiceNumber} created successfully!`);
      setShowCreateInvoiceModal(false);
      await fetchInvoices();
      await fetchMetrics();
      setSelectedInvoice(res);
    } catch (err: any) {
      const apiErr = err as ApiError;
      showToast(apiErr.message || 'Failed to create invoice.');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 0:
        return <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>Draft</span>;
      case 1:
        return <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>Issued (Unpaid)</span>;
      case 2:
        return <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>Partially Paid</span>;
      case 3:
        return <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>Fully Paid</span>;
      case 4:
        return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>Voided</span>;
      case 5:
      case 6:
        return <span className="badge" style={{ backgroundColor: '#fae8ff', color: '#86198f' }}>Refunded</span>;
      default:
        return <span className="badge">Unknown</span>;
    }
  };

  return (
    <div className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top Banner & Fast Metrics */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={22} color="var(--primary)" />
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Hospital Billing, Chargemaster & Cashier Workstation
              </h1>
              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                Module G • Decimal Exact
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Integrated clinical chargemaster, automated encounter invoicing, offline multi-method payment capture, and daily drawer reconciliation.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                fetchMetrics();
                fetchInvoices();
                fetchServices();
                fetchShiftSummary();
              }}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
            >
              <RefreshCw size={14} /> Refresh Data
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateInvoiceModal(true)}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
            >
              <Plus size={14} /> Create Manual Invoice
            </button>
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <TrendingUp size={13} /> TODAY'S REVENUE
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
              ${metrics?.todayRevenue ? metrics.todayRevenue.toFixed(2) : '0.00'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#166534' }}>Net collected payments</div>
          </div>

          <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <DollarSign size={13} /> TOTAL OUTSTANDING
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>
              ${metrics?.totalOutstandingBalance ? metrics.totalOutstandingBalance.toFixed(2) : '0.00'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#991b1b' }}>Pending balance across patients</div>
          </div>

          <div style={{ padding: '0.75rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={13} /> PENDING INVOICES
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309', marginTop: '0.2rem' }}>
              {metrics?.pendingInvoicesCount ?? 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#92400e' }}>Issued & partially paid</div>
          </div>

          <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={13} /> FULLY SETTLED
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.2rem' }}>
              {metrics?.totalPaidInvoicesCount ?? 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#1e40af' }}>Zero balance completed</div>
          </div>

          <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <SlidersHorizontal size={13} /> CHARGEMASTER
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {metrics?.activeServicesCount ?? 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Active billable services</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('invoices')}
          style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Receipt size={15} /> Invoices & Billing Queue ({invoices.length})
        </button>

        <button
          className={`btn ${activeTab === 'terminal' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('terminal')}
          style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <CreditCard size={15} /> Cashier Register & Payment Terminal
        </button>

        <button
          className={`btn ${activeTab === 'chargemaster' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('chargemaster')}
          style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <SlidersHorizontal size={15} /> Hospital Fee Schedule ({services.length})
        </button>

        <button
          className={`btn ${activeTab === 'shift' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('shift')}
          style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <DollarSign size={15} /> Cashier Shift Closure & Reconciliation
        </button>
      </div>

      {/* TAB 1: INVOICES & BILLING QUEUE */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '1rem', alignItems: 'start' }}>
          {/* Left: Invoices Table with Search and Filter */}
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search invoice number, patient name, patient ID..."
                  className="input-field"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchInvoices()}
                  style={{ paddingLeft: '2rem', fontSize: '0.8rem', padding: '0.4rem 0.6rem 0.4rem 2rem' }}
                />
              </div>

              <select
                className="input-field"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '150px', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="all">All Statuses</option>
                <option value="1">Issued (Unpaid)</option>
                <option value="2">Partially Paid</option>
                <option value="3">Fully Paid</option>
                <option value="4">Voided</option>
              </select>

              <button className="btn btn-outline" onClick={fetchInvoices} style={{ padding: '0.4rem 0.6rem' }}>
                <RefreshCw size={13} className={invoiceLoading ? 'spin' : ''} />
              </button>
            </div>

            <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px', maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Invoice #</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Patient</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Total</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Balance</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        No invoices found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => {
                      const isSelected = selectedInvoice?.id === inv.id;
                      return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedInvoice(inv)}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            <code style={{ fontWeight: 700, color: '#0f172a' }}>{inv.invoiceNumber}</code>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {new Date(inv.issuedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            <div style={{ fontWeight: 600 }}>{inv.patientName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{inv.patientNumber}</div>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>
                            ${inv.total.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            <strong style={{ color: inv.balance > 0 ? '#b91c1c' : '#15803d' }}>
                              ${inv.balance.toFixed(2)}
                            </strong>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            {getStatusBadge(inv.status)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Selected Invoice Detail Inspector Drawer */}
          <div className="card" style={{ padding: '1.25rem', minHeight: 'calc(100vh - 290px)' }}>
            {!selectedInvoice ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <Receipt size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                <h3>Select an Invoice</h3>
                <p style={{ fontSize: '0.85rem' }}>Choose an invoice from the left list to review line items, capture payment, or print official receipts.</p>
              </div>
            ) : (
              <div>
                {/* Header Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                        {selectedInvoice.invoiceNumber}
                      </h2>
                      {getStatusBadge(selectedInvoice.status)}
                    </div>
                    <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Patient: <strong>{selectedInvoice.patientName}</strong> ({selectedInvoice.patientNumber}) • Issued by {selectedInvoice.createdByUserName} on {new Date(selectedInvoice.issuedAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowPrintInvoiceModal(true)}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Printer size={13} /> Print Invoice
                    </button>
                    {selectedInvoice.balance > 0 && selectedInvoice.status !== 4 && (
                      <button
                        className="btn btn-primary"
                        onClick={() => selectForPayment(selectedInvoice)}
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <CreditCard size={13} /> Collect Payment
                      </button>
                    )}
                    {selectedInvoice.status !== 4 && selectedInvoice.paidAmount === 0 && (
                      <button
                        className="btn btn-outline"
                        onClick={() => setShowVoidModal(true)}
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', color: '#b91c1c' }}
                      >
                        <Ban size={13} /> Void
                      </button>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0.5rem 0' }}>Itemized Bill Breakdown</h4>
                <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '1rem' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Description</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Source</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.lines.map((l) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{l.itemDescription}</td>
                          <td style={{ padding: '0.4rem 0.6rem', color: '#64748b' }}>{l.sourceType}</td>
                          <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>{l.quantity}</td>
                          <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>${l.unitPriceSnapshot.toFixed(2)}</td>
                          <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>${l.totalPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary Card */}
                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#64748b' }}>Subtotal:</span>
                    <span>${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem', color: '#16a34a' }}>
                      <span>Discount:</span>
                      <span>-${selectedInvoice.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedInvoice.tax > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#64748b' }}>Tax:</span>
                      <span>+${selectedInvoice.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 800, borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                    <span>Total Amount:</span>
                    <span>${selectedInvoice.total.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#15803d', marginTop: '0.25rem' }}>
                    <span>Amount Paid:</span>
                    <span>${selectedInvoice.paidAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, color: selectedInvoice.balance > 0 ? '#b91c1c' : '#15803d', borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                    <span>Outstanding Balance Due:</span>
                    <span>${selectedInvoice.balance.toFixed(2)}</span>
                  </div>
                </div>

                {/* Recorded Payments List */}
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0.75rem 0 0.35rem 0' }}>Payment Transactions ({selectedInvoice.payments.length})</h4>
                {selectedInvoice.payments.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No payment transactions recorded for this invoice yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selectedInvoice.payments.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          padding: '0.6rem 0.75rem',
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div>
                          <div>
                            <strong>{p.receiptNumber}</strong> • <span style={{ color: '#0284c7', fontWeight: 600 }}>{PAYMENT_METHOD_NAMES[p.method]}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Received by {p.cashierUserName} on {new Date(p.receivedAt).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 800, color: '#15803d' }}>+${p.amount.toFixed(2)}</span>
                          <button
                            className="btn btn-outline"
                            onClick={() => {
                              setLastPaymentReceipt(p);
                              setShowPrintReceiptModal(true);
                            }}
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                            title="Print Voucher Receipt"
                          >
                            <Printer size={12} /> Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CASHIER REGISTER & PAYMENT TERMINAL */}
      {activeTab === 'terminal' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', alignItems: 'start' }}>
          {/* Left: Interactive Payment Capture Box */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={20} color="var(--primary)" />
              Point-of-Sale Payment Collection Terminal
            </h2>
            <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Capture cash, card, bank transfer, or co-pay settlements with sequential audit receipt generation and automatic balance deduction.
            </p>

            <form onSubmit={handleRecordPayment}>
              {/* Select Unpaid Invoice */}
              <div className="form-group">
                <label className="form-label">Select Outstanding Invoice *</label>
                <select
                  className="input-field"
                  value={terminalInvoiceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTerminalInvoiceId(id);
                    const inv = invoices.find(i => i.id === id);
                    if (inv) {
                      setSelectedInvoice(inv);
                      setPayAmount(inv.balance.toString());
                    }
                  }}
                  required
                >
                  <option value="">-- Choose Invoice to Pay --</option>
                  {invoices.filter(i => i.balance > 0 && i.status !== 4).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoiceNumber} - {i.patientName} (${i.patientNumber}) [Due: ${i.balance.toFixed(2)}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount to Pay */}
              <div className="form-group">
                <label className="form-label">Payment Amount ($ USD) *</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-field"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    style={{ fontSize: '1.1rem', fontWeight: 700 }}
                  />
                  {selectedInvoice && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setPayAmount(selectedInvoice.balance.toString())}
                      style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    >
                      Full Balance (${selectedInvoice.balance.toFixed(2)})
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label className="form-label">Payment Tender Method *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {[0, 1, 2, 3, 4, 5].map((m) => {
                    const isSelected = payMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m as PaymentMethod)}
                        style={{
                          padding: '0.6rem 0.5rem',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.08)' : '#fff',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          color: isSelected ? 'var(--primary)' : '#334155',
                        }}
                      >
                        {PAYMENT_METHOD_NAMES[m as PaymentMethod]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider / Reference Code */}
              <div className="form-group">
                <label className="form-label">Transaction Reference / Auth Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Card Approval Ref: #90483, Cheque No, or Mobile Ref"
                  className="input-field"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={paymentProcessing || !terminalInvoiceId}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                  <DollarSign size={18} />
                  {paymentProcessing ? 'Processing Transaction...' : 'Capture Payment & Generate Official Receipt'}
                </button>
              </div>
            </form>
          </div>

          {/* Right: Selected Invoice Summary or Recent Receipt */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>Transaction Context</h3>

            {selectedInvoice ? (
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedInvoice.invoiceNumber}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Patient: {selectedInvoice.patientName} ({selectedInvoice.patientNumber})
                </div>

                <div style={{ margin: '1rem 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Invoice Total:</span>
                    <strong>${selectedInvoice.total.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#16a34a', marginTop: '0.25rem' }}>
                    <span>Already Paid:</span>
                    <strong>${selectedInvoice.paidAmount.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: '#b91c1c', fontWeight: 800, marginTop: '0.5rem' }}>
                    <span>Remaining Balance:</span>
                    <strong>${selectedInvoice.balance.toFixed(2)}</strong>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Items billed: {selectedInvoice.lines.length} service(s)
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                Select an invoice on the left to review billing balance before payment.
              </div>
            )}

            {lastPaymentReceipt && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontWeight: 700, fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} /> Latest Receipt Issued
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0' }}>
                  {lastPaymentReceipt.receiptNumber}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#166534' }}>
                  Amount: <strong>${lastPaymentReceipt.amount.toFixed(2)}</strong> via {PAYMENT_METHOD_NAMES[lastPaymentReceipt.method as PaymentMethod]}
                </div>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowPrintReceiptModal(true)}
                  style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.8rem', padding: '0.4rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Printer size={14} /> Print Patient Receipt Voucher
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HOSPITAL CHARGEMASTER (FEE SCHEDULE) */}
      {activeTab === 'chargemaster' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                Hospital Chargemaster & Fee Schedule
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Authoritative pricing catalog for clinical encounters, nursing procedures, therapies, and diagnostics.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddServiceModal(true)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} /> Add Billable Service
              </button>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search service name, service code, or category..."
                className="input-field"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchServices()}
                style={{ paddingLeft: '2rem', fontSize: '0.8rem', padding: '0.4rem 0.6rem 0.4rem 2rem' }}
              />
            </div>

            <select
              className="input-field"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: '170px', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
            >
              <option value="all">All Categories</option>
              <option value="Consultation">Consultation</option>
              <option value="Emergency">Emergency</option>
              <option value="Nursing">Nursing</option>
              <option value="Diagnostics">Diagnostics</option>
              <option value="Therapy">Therapy</option>
            </select>

            <button className="btn btn-outline" onClick={fetchServices} style={{ padding: '0.4rem 0.6rem' }}>
              <Search size={13} />
            </button>
          </div>

          <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Service Code</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Service Name</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Category</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Default Price</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.75rem' }}><code>{s.code}</code></td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>{s.name}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                        {s.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, color: '#0f172a' }}>
                      ${s.defaultPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      {s.isActive ? (
                        <span style={{ color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                          Active
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                          Inactive
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

      {/* TAB 4: CASHIER SHIFT CLOSURE & RECONCILIATION */}
      {activeTab === 'shift' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                  Daily Cashier Shift Closing & Till Reconciliation
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Audited breakdown of today's collections by payment channel and net expected cash drawer amount.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Shift Date:</label>
                <input
                  type="date"
                  className="input-field"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                />
                <button className="btn btn-outline" onClick={fetchShiftSummary} style={{ padding: '0.35rem 0.6rem' }}>
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Shift Breakdown Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>PHYSICAL CASH IN DRAWER</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                  ${shiftSummary ? shiftSummary.cashTotal.toFixed(2) : '0.00'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#166534' }}>Tender currency collected</div>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700 }}>CREDIT / DEBIT CARDS</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.2rem' }}>
                  ${shiftSummary ? (shiftSummary.creditCardTotal + shiftSummary.debitCardTotal).toFixed(2) : '0.00'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#1e40af' }}>POS terminal electronic total</div>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b21a8', fontWeight: 700 }}>TRANSFERS & CO-PAY</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7e22ce', marginTop: '0.2rem' }}>
                  ${shiftSummary ? (shiftSummary.bankTransferTotal + shiftSummary.mobilePaymentTotal + shiftSummary.insuranceCoPayTotal).toFixed(2) : '0.00'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b21a8' }}>Non-cash electronic settlements</div>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.72rem', color: '#9f1239', fontWeight: 700 }}>TOTAL REFUNDED / VOID</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#be123c', marginTop: '0.2rem' }}>
                  -${shiftSummary ? shiftSummary.totalRefunded.toFixed(2) : '0.00'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9f1239' }}>Deducted disbursements</div>
              </div>
            </div>

            {/* Shift Transactions Table */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
              Receipts Issued During Shift ({shiftSummary?.recentPayments.length ?? 0})
            </h4>

            <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Receipt #</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Invoice #</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Method</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Amount</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Time</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Cashier</th>
                    <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!shiftSummary || shiftSummary.recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        No transactions found for selected date.
                      </td>
                    </tr>
                  ) : (
                    shiftSummary.recentPayments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.5rem 0.6rem' }}><code>{p.receiptNumber}</code></td>
                        <td style={{ padding: '0.5rem 0.6rem' }}><code>{p.invoiceNumber}</code></td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '0.72rem' }}>
                            {PAYMENT_METHOD_NAMES[p.method]}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#15803d' }}>
                          ${p.amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(p.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.8rem' }}>{p.cashierUserName}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                          <button
                            className="btn btn-outline"
                            onClick={() => {
                              setTargetPaymentId(p.id);
                              setRefundAmount(p.amount.toString());
                              setShowRefundModal(true);
                            }}
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', color: '#b91c1c' }}
                          >
                            <RotateCcw size={12} /> Refund
                          </button>
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

      {/* MODAL 1: CREATE MANUAL INVOICE */}
      {showCreateInvoiceModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '580px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} color="var(--primary)" /> Generate Patient Invoice
              </h2>
              <button className="modal-close" onClick={() => setShowCreateInvoiceModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateInvoice} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Patient *</label>
                <select
                  className="input-field"
                  value={newInvPatientId}
                  onChange={(e) => setNewInvPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Select Patient --</option>
                  {patientsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.patientNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Items */}
              <div style={{ margin: '1rem 0' }}>
                <label className="form-label">Itemized Services & Quantities</label>
                {newInvLines.map((line, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Service description"
                      value={line.desc}
                      onChange={(e) => {
                        const updated = [...newInvLines];
                        updated[idx].desc = e.target.value;
                        setNewInvLines(updated);
                      }}
                      required
                    />
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      placeholder="Qty"
                      value={line.qty}
                      onChange={(e) => {
                        const updated = [...newInvLines];
                        updated[idx].qty = parseInt(e.target.value) || 1;
                        setNewInvLines(updated);
                      }}
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="Price"
                      value={line.price}
                      onChange={(e) => {
                        const updated = [...newInvLines];
                        updated[idx].price = parseFloat(e.target.value) || 0;
                        setNewInvLines(updated);
                      }}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setNewInvLines(newInvLines.filter((_, i) => i !== idx))}
                      disabled={newInvLines.length === 1}
                      style={{ color: '#b91c1c' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setNewInvLines([...newInvLines, { desc: 'Standard Clinical Consultation', qty: 1, price: 35.00 }])}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', marginTop: '0.25rem' }}
                >
                  + Add Another Line
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Discount Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={newInvDiscount}
                    onChange={(e) => setNewInvDiscount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={newInvTax}
                    onChange={(e) => setNewInvTax(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateInvoiceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingInvoice}>
                  {creatingInvoice ? 'Creating Invoice...' : 'Generate & Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CHARGEMASTER SERVICE */}
      {showAddServiceModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '480px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} color="var(--primary)" /> Add Billable Service
              </h2>
              <button className="modal-close" onClick={() => setShowAddServiceModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateService} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Service Code *</label>
                <input
                  type="text"
                  placeholder="e.g. SRV-DIAG-XRAY"
                  className="input-field"
                  value={newSrvCode}
                  onChange={(e) => setNewSrvCode(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Service Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Chest X-Ray (Single View)"
                  className="input-field"
                  value={newSrvName}
                  onChange={(e) => setNewSrvName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Category *</label>
                  <select
                    className="input-field"
                    value={newSrvCategory}
                    onChange={(e) => setNewSrvCategory(e.target.value)}
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Nursing">Nursing</option>
                    <option value="Diagnostics">Diagnostics</option>
                    <option value="Therapy">Therapy</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Price ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={newSrvPrice}
                    onChange={(e) => setNewSrvPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddServiceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingService}>
                  {savingService ? 'Saving...' : 'Save to Chargemaster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VOID INVOICE */}
      {showVoidModal && selectedInvoice && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ban size={18} /> Void Invoice {selectedInvoice.invoiceNumber}
              </h2>
              <button className="modal-close" onClick={() => setShowVoidModal(false)}>×</button>
            </div>

            <form onSubmit={handleVoidInvoice} style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Voiding this invoice will immediately cancel the outstanding balance of <strong>${selectedInvoice.balance.toFixed(2)}</strong>. This action is permanently audited.
              </p>

              <div className="form-group">
                <label className="form-label">Mandatory Audit Reason *</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowVoidModal(false)}>
                  Keep Invoice
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#b91c1c' }} disabled={voidingInvoice}>
                  {voidingInvoice ? 'Voiding...' : 'Confirm Void Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PROCESS REFUND */}
      {showRefundModal && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#be123c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} /> Authorize Payment Refund
              </h2>
              <button className="modal-close" onClick={() => setShowRefundModal(false)}>×</button>
            </div>

            <form onSubmit={handleProcessRefund} style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Refund Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-field"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinical / Financial Reason *</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowRefundModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#be123c' }} disabled={refunding}>
                  {refunding ? 'Processing...' : 'Authorize Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PRINTABLE FORMAL INVOICE */}
      {showPrintInvoiceModal && selectedInvoice && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '640px', width: '100%', padding: '2rem' }}>
            {/* Hospital Printable Bill Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '0.5px' }}>
                MERCY COMMUNITY HOSPITAL
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0' }}>
                100 Healthcare Boulevard, Suite 100 • Phone: (555) 019-2831 • Tax ID: MCH-98102-OFFLINE
              </p>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.6rem 0 0 0', color: 'var(--primary)', letterSpacing: '1px' }}>
                OFFICIAL PATIENT MEDICAL INVOICE
              </h3>
            </div>

            {/* Bill Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <div><strong>Invoice Number:</strong> {selectedInvoice.invoiceNumber}</div>
                <div><strong>Date of Issue:</strong> {new Date(selectedInvoice.issuedAt).toLocaleDateString()}</div>
                <div><strong>Status:</strong> {INVOICE_STATUS_NAMES[selectedInvoice.status]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>Patient Name:</strong> {selectedInvoice.patientName}</div>
                <div><strong>Patient MRN:</strong> {selectedInvoice.patientNumber}</div>
                <div><strong>Billing Cashier:</strong> {selectedInvoice.createdByUserName}</div>
              </div>
            </div>

            {/* Bill Line Items */}
            <table style={{ width: '100%', fontSize: '0.825rem', borderCollapse: 'collapse', marginBottom: '1.25rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #0f172a', backgroundColor: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Description</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.lines.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem' }}>{l.itemDescription}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{l.quantity}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>${l.unitPriceSnapshot.toFixed(2)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>${l.totalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Calculation */}
            <div style={{ marginLeft: 'auto', width: '260px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Subtotal:</span>
                <span>${selectedInvoice.subtotal.toFixed(2)}</span>
              </div>
              {selectedInvoice.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#16a34a' }}>
                  <span>Discount:</span>
                  <span>-${selectedInvoice.discount.toFixed(2)}</span>
                </div>
              )}
              {selectedInvoice.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span>Tax:</span>
                  <span>+${selectedInvoice.tax.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #0f172a', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                <span>Invoice Total:</span>
                <span>${selectedInvoice.total.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', marginTop: '0.2rem' }}>
                <span>Amount Paid:</span>
                <span>${selectedInvoice.paidAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: selectedInvoice.balance > 0 ? '#b91c1c' : '#15803d', borderTop: '2px solid #0f172a', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                <span>Balance Due:</span>
                <span>${selectedInvoice.balance.toFixed(2)}</span>
              </div>
            </div>

            {/* Signature & Stamp */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
              <div>
                <div>Authorized Hospital Stamp</div>
                <div style={{ height: '40px' }} />
                <div>Mercy Community Billing Dept.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Patient / Representative Signature</div>
                <div style={{ height: '40px' }} />
                <div>Date: ________________________</div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowPrintInvoiceModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={15} /> Print Physical Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: PRINTABLE FORMAL PAYMENT RECEIPT */}
      {showPrintReceiptModal && lastPaymentReceipt && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '440px', width: '100%', padding: '1.75rem' }}>
            <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>MERCY COMMUNITY HOSPITAL</h2>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Offline Point-of-Sale Payment Voucher</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.4rem' }}>
                RECEIPT VOUCHER: {lastPaymentReceipt.receiptNumber}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Payment Date:</span>
                <strong>{new Date(lastPaymentReceipt.receivedAt).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Invoice Reference:</span>
                <strong>{lastPaymentReceipt.invoiceNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Payment Method:</span>
                <strong>{PAYMENT_METHOD_NAMES[lastPaymentReceipt.method as PaymentMethod]}</strong>
              </div>
              {lastPaymentReceipt.providerReference && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Auth Reference:</span>
                  <code>{lastPaymentReceipt.providerReference}</code>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Cashier:</span>
                <span>{lastPaymentReceipt.cashierUserName}</span>
              </div>

              <div style={{ borderTop: '1.5px dashed #0f172a', borderBottom: '1.5px dashed #0f172a', padding: '0.75rem 0', margin: '0.5rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>
                  <span>AMOUNT PAID:</span>
                  <span>${lastPaymentReceipt.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Thank you for choosing Mercy Community Hospital. This voucher serves as official proof of payment.
            </div>

            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button className="btn btn-outline" onClick={() => setShowPrintReceiptModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={15} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
