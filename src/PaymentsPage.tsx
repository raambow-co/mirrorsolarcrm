import { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, Search, CheckCircle2, Clock, 
  Upload, Eye, Download, ExternalLink, X, 
  CheckCircle, ArrowUpRight, ShieldCheck,
  AlertCircle, ChevronRight, User, Phone, MapPin, Loader2, IndianRupee,
  ArrowDownLeft, Plus, Filter, FileText, Check, XCircle, Trash2,
  TrendingUp, Wallet, DollarSign, Building2, Receipt, ArrowRightLeft, Sparkles
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import type { 
  MockLead, 
  PaymentMilestoneType, 
  CustomerPaymentRecord,
  CustomerPaymentType,
  CustomerPaymentMode
} from './context/CRMContext';
import { useUI } from './context/UIContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import './PaymentsPage.css';

interface PaymentsPageProps {
  onNavigate?: (path: string) => void;
}

export default function PaymentsPage({ onNavigate: _onNavigate }: PaymentsPageProps) {
  const { 
    leads, 
    dealers, 
    currentUser, 
    settleLeadPayment, 
    acknowledgeLeadPayment,
    addCustomerPayment,
    verifyCustomerPayment,
    deleteCustomerPayment
  } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  const isAdmin = currentUser?.role === 'Admin';
  const isDealer = currentUser?.role === 'Dealer';

  // Primary Tab: 'customer_to_admin' | 'admin_to_dealer' | 'overview'
  const [activePaymentTab, setActivePaymentTab] = useState<'customer_to_admin' | 'admin_to_dealer' | 'overview'>('customer_to_admin');

  // ==========================================
  // 1. CUSTOMER TO ADMIN STATE & FILTERING
  // ==========================================
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'Verified' | 'Pending Verification' | 'Rejected'>('all');
  const [customerModeFilter, setCustomerModeFilter] = useState('');
  const [customerDealerFilter, setCustomerDealerFilter] = useState('');

  // Record Customer Payment Modal
  const [showRecordCustomerModal, setShowRecordCustomerModal] = useState(false);
  const [recordForm, setRecordForm] = useState({
    leadId: '',
    amount: '',
    paymentType: 'Booking / Advance' as CustomerPaymentType,
    paymentMode: 'UPI' as CustomerPaymentMode,
    referenceNumber: '',
    paidAt: new Date().toISOString().split('T')[0],
    notes: '',
    file: null as File | null
  });
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Reject Customer Payment Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ leadId: string; paymentId: string; customerName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ==========================================
  // 2. ADMIN TO DEALER STATE & FILTERING
  // ==========================================
  const [dealerFilterStatus, setDealerFilterStatus] = useState<'all' | 'pending_admin' | 'awaiting_dealer' | 'received'>('all');
  const [dealerSearchQuery, setDealerSearchQuery] = useState('');
  const [selectedDealerFilter, setSelectedDealerFilter] = useState('');

  // Admin Settle Modal
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{ lead: MockLead; milestoneType: PaymentMilestoneType } | null>(null);
  const [settleForm, setSettleForm] = useState({
    amount: '',
    utrNumber: '',
    adminNotes: '',
    file: null as File | null
  });
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Dealer Confirm Modal
  const [showConfirmModalState, setShowConfirmModalState] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ lead: MockLead; milestoneType: PaymentMilestoneType } | null>(null);
  const [dealerNotes, setDealerNotes] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Lightbox
  const [showProofLightbox, setShowProofLightbox] = useState(false);
  const [activeProof, setActiveProof] = useState<{ url: string; fileName: string; title: string } | null>(null);

  // Eligible Leads for Admin to Dealer milestone payouts (Converted stage or beyond)
  const eligibleDealerLeads = useMemo(() => {
    return leads.filter(l => {
      if (isDealer && l.dealer !== currentUser?.name) return false;
      if (l.archived) return false;
      const isConvertedOrBeyond = l.stage === 'Converted' || l.stage === 'Loan' || l.stage === 'Material' || l.stage === 'Installation' || l.stage === 'Completed';
      return isConvertedOrBeyond;
    });
  }, [leads, isDealer, currentUser]);

  // All accessible leads for Customer Payments (all active leads Dealer / Admin can access)
  const accessibleLeads = useMemo(() => {
    return leads.filter(l => {
      if (isDealer && l.dealer !== currentUser?.name) return false;
      if (l.archived) return false;
      return true;
    });
  }, [leads, isDealer, currentUser]);

  // Synchronize modal targets if leads update in real-time
  useEffect(() => {
    if (settleTarget) {
      const liveLead = leads.find(l => l.id === settleTarget.lead.id);
      if (liveLead) {
        setSettleTarget(prev => prev ? { ...prev, lead: liveLead } : null);
      }
    }
    if (confirmTarget) {
      const liveLead = leads.find(l => l.id === confirmTarget.lead.id);
      if (liveLead) {
        setConfirmTarget(prev => prev ? { ...prev, lead: liveLead } : null);
      }
    }
  }, [leads]);

  // ==========================================
  // FLATTENED CUSTOMER PAYMENTS LIST
  // ==========================================
  const allCustomerPayments = useMemo(() => {
    const list: Array<CustomerPaymentRecord & { leadStage: string; leadDealer: string; leadPhone: string; leadLocation?: string }> = [];
    accessibleLeads.forEach(lead => {
      const payments = lead.payments?.customerPayments || [];
      payments.forEach(p => {
        list.push({
          ...p,
          leadStage: lead.stage,
          leadDealer: lead.dealer,
          leadPhone: lead.phone,
          leadLocation: lead.location
        });
      });
    });
    // Sort descending by paidAt
    return list.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [accessibleLeads]);

  const filteredCustomerPayments = useMemo(() => {
    return allCustomerPayments.filter(item => {
      // 1. Search Query
      if (customerSearchQuery.trim()) {
        const q = customerSearchQuery.toLowerCase();
        const matchesCust = item.customerName?.toLowerCase().includes(q);
        const matchesDealer = item.leadDealer?.toLowerCase().includes(q);
        const matchesPhone = item.leadPhone?.toLowerCase().includes(q);
        const matchesRef = item.referenceNumber?.toLowerCase().includes(q);
        const matchesType = item.paymentType?.toLowerCase().includes(q);
        if (!matchesCust && !matchesDealer && !matchesPhone && !matchesRef && !matchesType) return false;
      }

      // 2. Status Filter
      if (customerStatusFilter !== 'all') {
        if (item.status !== customerStatusFilter) return false;
      }

      // 3. Mode Filter
      if (customerModeFilter) {
        if (item.paymentMode !== customerModeFilter) return false;
      }

      // 4. Dealer Filter (Admin view)
      if (isAdmin && customerDealerFilter) {
        if (item.leadDealer !== customerDealerFilter) return false;
      }

      return true;
    });
  }, [allCustomerPayments, customerSearchQuery, customerStatusFilter, customerModeFilter, customerDealerFilter, isAdmin]);

  // Customer Payments Metrics
  const customerMetrics = useMemo(() => {
    let totalCollected = 0;
    let verifiedTotal = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let verifiedCount = 0;

    allCustomerPayments.forEach(p => {
      totalCollected += (p.amount || 0);
      if (p.status === 'Verified') {
        verifiedTotal += (p.amount || 0);
        verifiedCount++;
      } else if (p.status === 'Pending Verification') {
        pendingCount++;
        pendingAmount += (p.amount || 0);
      }
    });

    return {
      totalCollected,
      verifiedTotal,
      pendingCount,
      pendingAmount,
      verifiedCount,
      totalRecords: allCustomerPayments.length
    };
  }, [allCustomerPayments]);

  // ==========================================
  // ADMIN TO DEALER METRICS & FILTERING
  // ==========================================
  const dealerMetrics = useMemo(() => {
    let totalSettledOrReceivedAmount = 0;
    let pendingAdminCount = 0;
    let awaitingDealerCount = 0;
    let receivedCount = 0;

    eligibleDealerLeads.forEach(lead => {
      const pre = lead.payments?.preInstallation;
      const post = lead.payments?.postInstallation;

      // Milestone 1 (Pre)
      if (!pre || pre.status === 'Pending Settlement') {
        pendingAdminCount++;
      } else if (pre.status === 'Settled') {
        awaitingDealerCount++;
        totalSettledOrReceivedAmount += (pre.amount || 0);
      } else if (pre.status === 'Received') {
        receivedCount++;
        totalSettledOrReceivedAmount += (pre.amount || 0);
      }

      // Milestone 2 (Post)
      if (!post || post.status === 'Pending Settlement') {
        pendingAdminCount++;
      } else if (post.status === 'Settled') {
        awaitingDealerCount++;
        totalSettledOrReceivedAmount += (post.amount || 0);
      } else if (post.status === 'Received') {
        receivedCount++;
        totalSettledOrReceivedAmount += (post.amount || 0);
      }
    });

    return {
      totalAmount: totalSettledOrReceivedAmount,
      pendingAdminCount,
      awaitingDealerCount,
      receivedCount,
      totalEligibleLeads: eligibleDealerLeads.length
    };
  }, [eligibleDealerLeads]);

  const filteredDealerLeads = useMemo(() => {
    return eligibleDealerLeads.filter(lead => {
      if (dealerSearchQuery.trim()) {
        const q = dealerSearchQuery.toLowerCase();
        const matchesCust = lead.customer?.toLowerCase().includes(q);
        const matchesDlr = lead.dealer?.toLowerCase().includes(q);
        const matchesPhone = lead.phone?.toLowerCase().includes(q);
        const matchesUtr = (lead.payments?.preInstallation?.utrNumber?.toLowerCase().includes(q)) || 
                           (lead.payments?.postInstallation?.utrNumber?.toLowerCase().includes(q));
        if (!matchesCust && !matchesDlr && !matchesPhone && !matchesUtr) return false;
      }

      if (isAdmin && selectedDealerFilter) {
        if (lead.dealer !== selectedDealerFilter) return false;
      }

      if (dealerFilterStatus === 'pending_admin') {
        const prePending = !lead.payments?.preInstallation || lead.payments.preInstallation.status === 'Pending Settlement';
        const postPending = !lead.payments?.postInstallation || lead.payments.postInstallation.status === 'Pending Settlement';
        return prePending || postPending;
      } else if (dealerFilterStatus === 'awaiting_dealer') {
        const preAwaiting = lead.payments?.preInstallation?.status === 'Settled';
        const postAwaiting = lead.payments?.postInstallation?.status === 'Settled';
        return preAwaiting || postAwaiting;
      } else if (dealerFilterStatus === 'received') {
        const preReceived = lead.payments?.preInstallation?.status === 'Received';
        const postReceived = lead.payments?.postInstallation?.status === 'Received';
        return preReceived && postReceived;
      }

      return true;
    });
  }, [eligibleDealerLeads, dealerSearchQuery, selectedDealerFilter, dealerFilterStatus, isAdmin]);

  // Overall Financial Margin
  const netFinancials = useMemo(() => {
    const totalInflow = customerMetrics.verifiedTotal;
    const totalOutflow = dealerMetrics.totalAmount;
    const netRetained = totalInflow - totalOutflow;
    return {
      totalInflow,
      totalOutflow,
      netRetained
    };
  }, [customerMetrics, dealerMetrics]);

  // Firebase Upload Helper
  const uploadToFirebase = async (file: File, folder: string): Promise<string> => {
    try {
      const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      return downloadUrl;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload proof to Firebase Storage');
    }
  };

  // ==========================================
  // CUSTOMER TO ADMIN ACTIONS
  // ==========================================
  const handleOpenRecordCustomerModal = () => {
    setRecordForm({
      leadId: accessibleLeads.length > 0 ? accessibleLeads[0].id : '',
      amount: '',
      paymentType: 'Booking / Advance',
      paymentMode: 'UPI',
      referenceNumber: '',
      paidAt: new Date().toISOString().split('T')[0],
      notes: '',
      file: null
    });
    setShowRecordCustomerModal(true);
  };

  const handleSubmitCustomerPayment = async () => {
    if (!recordForm.leadId) {
      showToast("Please select a customer project lead.", "error");
      return;
    }
    const numAmount = parseFloat(recordForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Please enter a valid payment amount.", "error");
      return;
    }

    try {
      setIsRecordingPayment(true);
      let proofUrl = '';
      let proofFileName = '';
      let proofFileSize = 0;

      if (recordForm.file) {
        proofUrl = await uploadToFirebase(recordForm.file, 'payments/customer_receipts');
        proofFileName = recordForm.file.name;
        proofFileSize = recordForm.file.size;
      }

      await addCustomerPayment(recordForm.leadId, {
        amount: numAmount,
        paymentType: recordForm.paymentType,
        paymentMode: recordForm.paymentMode,
        paidAt: recordForm.paidAt ? new Date(recordForm.paidAt).toISOString() : new Date().toISOString(),
        referenceNumber: recordForm.referenceNumber.trim(),
        notes: recordForm.notes.trim(),
        proofUrl,
        proofFileName,
        proofFileSize
      });

      showToast(`Customer payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully!`, 'success');
      setShowRecordCustomerModal(false);
    } catch (err: any) {
      console.error("Error recording customer payment:", err);
      showToast(err.message || "Failed to record customer payment.", 'error');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleVerifyCustomerPayment = async (leadId: string, paymentId: string, customerName: string) => {
    try {
      await verifyCustomerPayment(leadId, paymentId, 'Verified');
      showToast(`Payment for ${customerName} marked as Verified!`, 'success');
    } catch (err: any) {
      showToast("Failed to verify payment.", 'error');
    }
  };

  const handleOpenRejectModal = (leadId: string, paymentId: string, customerName: string) => {
    setRejectTarget({ leadId, paymentId, customerName });
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleConfirmRejectCustomerPayment = async () => {
    if (!rejectTarget) return;
    try {
      await verifyCustomerPayment(rejectTarget.leadId, rejectTarget.paymentId, 'Rejected', rejectReason.trim());
      showToast(`Payment for ${rejectTarget.customerName} marked as Rejected.`, 'info');
      setShowRejectModal(false);
      setRejectTarget(null);
    } catch (err: any) {
      showToast("Failed to reject payment.", 'error');
    }
  };

  const handleDeleteCustomerPayment = (leadId: string, paymentId: string, customerName: string) => {
    showConfirmModal(
      "Delete Payment Record",
      `Are you sure you want to delete this payment record for ${customerName}? This action cannot be undone.`,
      async () => {
        try {
          await deleteCustomerPayment(leadId, paymentId);
          showToast("Payment record deleted.", 'info');
        } catch (err) {
          showToast("Failed to delete payment record.", 'error');
        }
      },
      { confirmText: "Delete Payment" }
    );
  };

  // ==========================================
  // ADMIN TO DEALER ACTIONS
  // ==========================================
  const handleOpenSettleModal = (lead: MockLead, milestoneType: PaymentMilestoneType) => {
    const existing = milestoneType === 'Pre-Installation' ? lead.payments?.preInstallation : lead.payments?.postInstallation;
    setSettleTarget({ lead, milestoneType });
    setSettleForm({
      amount: existing?.amount ? String(existing.amount) : '',
      utrNumber: existing?.utrNumber || '',
      adminNotes: existing?.adminNotes || '',
      file: null
    });
    setShowSettleModal(true);
  };

  const handleSubmitSettlement = async () => {
    if (!settleTarget) return;
    const numAmount = parseFloat(settleForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Please enter a valid payout amount.", 'error');
      return;
    }

    const existingMilestone = settleTarget.milestoneType === 'Pre-Installation' 
      ? settleTarget.lead.payments?.preInstallation 
      : settleTarget.lead.payments?.postInstallation;

    if (!settleForm.file && !existingMilestone?.proofUrl) {
      showToast("Please upload a payment proof screenshot.", 'error');
      return;
    }

    try {
      setIsUploadingProof(true);
      let proofUrl = existingMilestone?.proofUrl || '';
      let proofFileName = existingMilestone?.proofFileName || 'Payment_Proof.jpg';
      let proofFileSize = existingMilestone?.proofFileSize || 0;

      if (settleForm.file) {
        proofUrl = await uploadToFirebase(settleForm.file, 'payments/proofs');
        proofFileName = settleForm.file.name;
        proofFileSize = settleForm.file.size;
      }

      await settleLeadPayment(settleTarget.lead.id, settleTarget.milestoneType, {
        amount: numAmount,
        proofUrl,
        proofFileName,
        proofFileSize,
        utrNumber: settleForm.utrNumber.trim(),
        adminNotes: settleForm.adminNotes.trim()
      });

      showToast(`${settleTarget.milestoneType} payment settled & proof sent to Dealer!`, 'success');
      setShowSettleModal(false);
      setSettleTarget(null);
    } catch (err: any) {
      console.error("Error settling payment:", err);
      showToast(err.message || "Failed to settle payment.", 'error');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleOpenConfirmModal = (lead: MockLead, milestoneType: PaymentMilestoneType) => {
    setConfirmTarget({ lead, milestoneType });
    setDealerNotes('');
    setShowConfirmModalState(true);
  };

  const handleConfirmReceived = async () => {
    if (!confirmTarget) return;
    try {
      setIsConfirming(true);
      await acknowledgeLeadPayment(confirmTarget.lead.id, confirmTarget.milestoneType, {
        dealerNotes: dealerNotes.trim()
      });
      showToast(`Confirmed! ${confirmTarget.milestoneType} marked as Received.`, 'success');
      setShowConfirmModalState(false);
      setConfirmTarget(null);
    } catch (err: any) {
      console.error("Error confirming payment:", err);
      showToast("Failed to confirm receipt.", 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  // Download Proof Helper
  const handleDownloadProof = (proofUrl: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = proofUrl;
    a.download = fileName || 'payment-receipt.jpg';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="payments-page">
      {/* Modern Top Hero Header */}
      <div className="payments-hero-header">
        <div className="payments-hero-content">
          <div className="payments-title-row">
            <div className="title-icon-badge">
              <Wallet size={24} />
            </div>
            <div>
              <div className="payments-badge-pill">
                <Sparkles size={13} /> Solar Finance & Payouts Hub
              </div>
              <h1>Payments & Transactions Center</h1>
              <p>
                Manage incoming customer collections, milestone payouts to dealers, and complete company cashflow audit trails.
              </p>
            </div>
          </div>

          <div className="header-action-container">
            <button 
              className="btn-cool-primary"
              onClick={handleOpenRecordCustomerModal}
            >
              <Plus size={18} /> Record Customer Payment
            </button>
          </div>
        </div>

        {/* Segmented Primary Navigation Tabs */}
        <div className="payments-tab-nav">
          <button 
            className={`tab-nav-item ${activePaymentTab === 'customer_to_admin' ? 'active' : ''}`}
            onClick={() => setActivePaymentTab('customer_to_admin')}
          >
            <ArrowDownLeft size={18} />
            <span>Customer ➔ Admin</span>
            <span className="tab-pill-badge incoming">
              {allCustomerPayments.length}
            </span>
          </button>

          <button 
            className={`tab-nav-item ${activePaymentTab === 'admin_to_dealer' ? 'active' : ''}`}
            onClick={() => setActivePaymentTab('admin_to_dealer')}
          >
            <ArrowUpRight size={18} />
            <span>Admin ➔ Dealer Payouts</span>
            <span className="tab-pill-badge outgoing">
              {eligibleDealerLeads.length} Projects
            </span>
          </button>

          <button 
            className={`tab-nav-item ${activePaymentTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActivePaymentTab('overview')}
          >
            <TrendingUp size={18} />
            <span>Financial Analytics & Margin</span>
          </button>
        </div>
      </div>

      <div className="payments-main">

        {/* ========================================================= */}
        {/* TAB 1: CUSTOMER TO ADMIN (INCOMING COLLECTIONS)           */}
        {/* ========================================================= */}
        {activePaymentTab === 'customer_to_admin' && (
          <div className="tab-pane fade-in">
            {/* Customer Metrics Grid */}
            <div className="payments-metrics-grid">
              <div className="payments-metric-card emerald-glow">
                <div className="metric-header">
                  <span className="metric-label">Total Collections</span>
                  <div className="metric-icon-wrap emerald">
                    <IndianRupee size={20} />
                  </div>
                </div>
                <div className="metric-value">₹{customerMetrics.totalCollected.toLocaleString('en-IN')}</div>
                <div className="metric-subtitle">
                  Across {customerMetrics.totalRecords} logged customer receipts
                </div>
              </div>

              <div className="payments-metric-card blue-glow">
                <div className="metric-header">
                  <span className="metric-label">Verified Inflow</span>
                  <div className="metric-icon-wrap blue">
                    <CheckCircle2 size={20} />
                  </div>
                </div>
                <div className="metric-value">₹{customerMetrics.verifiedTotal.toLocaleString('en-IN')}</div>
                <div className="metric-subtitle">
                  {customerMetrics.verifiedCount} verified transactions in bank
                </div>
              </div>

              <div className="payments-metric-card amber-glow">
                <div className="metric-header">
                  <span className="metric-label">Pending Verification</span>
                  <div className="metric-icon-wrap amber">
                    <Clock size={20} />
                  </div>
                </div>
                <div className="metric-value">{customerMetrics.pendingCount}</div>
                <div className="metric-subtitle">
                  ₹{customerMetrics.pendingAmount.toLocaleString('en-IN')} awaiting Admin check
                </div>
              </div>

              <div className="payments-metric-card purple-glow">
                <div className="metric-header">
                  <span className="metric-label">Active Projects</span>
                  <div className="metric-icon-wrap purple">
                    <Building2 size={20} />
                  </div>
                </div>
                <div className="metric-value">{accessibleLeads.length}</div>
                <div className="metric-subtitle">
                  Customer pipeline accessible
                </div>
              </div>
            </div>

            {/* Customer Filter Panel */}
            <div className="payments-filter-panel">
              <div className="filter-pills-row">
                <button 
                  className={`filter-pill-btn ${customerStatusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setCustomerStatusFilter('all')}
                >
                  All Receipts <span className="pill-count">{allCustomerPayments.length}</span>
                </button>
                <button 
                  className={`filter-pill-btn ${customerStatusFilter === 'Verified' ? 'active' : ''}`}
                  onClick={() => setCustomerStatusFilter('Verified')}
                >
                  ✅ Verified <span className="pill-count">{customerMetrics.verifiedCount}</span>
                </button>
                <button 
                  className={`filter-pill-btn ${customerStatusFilter === 'Pending Verification' ? 'active' : ''}`}
                  onClick={() => setCustomerStatusFilter('Pending Verification')}
                >
                  ⏳ Pending Verification <span className="pill-count">{customerMetrics.pendingCount}</span>
                </button>
                <button 
                  className={`filter-pill-btn ${customerStatusFilter === 'Rejected' ? 'active' : ''}`}
                  onClick={() => setCustomerStatusFilter('Rejected')}
                >
                  ❌ Rejected
                </button>
              </div>

              <div className="filter-search-row">
                <div className="search-input-wrapper">
                  <Search size={18} className="search-icon-pos" />
                  <input 
                    type="text"
                    className="search-input-field"
                    placeholder="Search by customer, phone, dealer, UTR / ref, or payment type..."
                    value={customerSearchQuery}
                    onChange={e => setCustomerSearchQuery(e.target.value)}
                  />
                  {customerSearchQuery && (
                    <button 
                      onClick={() => setCustomerSearchQuery('')}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <select 
                  className="dealer-filter-dropdown"
                  value={customerModeFilter}
                  onChange={e => setCustomerModeFilter(e.target.value)}
                >
                  <option value="">All Payment Modes</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Loan">Bank Loan Disbursal</option>
                  <option value="Credit / Debit Card">Credit / Debit Card</option>
                  <option value="Other">Other</option>
                </select>

                {isAdmin && (
                  <select 
                    className="dealer-filter-dropdown"
                    value={customerDealerFilter}
                    onChange={e => setCustomerDealerFilter(e.target.value)}
                  >
                    <option value="">All Dealers</option>
                    {dealers.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Customer Payments List */}
            {filteredCustomerPayments.length === 0 ? (
              <div className="payments-empty-state">
                <Receipt size={52} color="#cbd5e1" />
                <h3>No Customer Payment Records Found</h3>
                <p>
                  Click the <strong>"Record Customer Payment"</strong> button above to record booking advances, loan disbursals, or project milestones from customers.
                </p>
                <button 
                  className="btn-cool-primary"
                  style={{ marginTop: '0.75rem' }}
                  onClick={handleOpenRecordCustomerModal}
                >
                  <Plus size={16} /> Record First Payment
                </button>
              </div>
            ) : (
              <div className="customer-transactions-grid">
                {filteredCustomerPayments.map(payment => (
                  <div key={payment.id} className="customer-payment-card">
                    <div className="payment-card-top">
                      <div className="customer-identity-group">
                        <div className="avatar-chip">
                          {payment.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="customer-card-name">{payment.customerName}</div>
                          <div className="customer-meta-sub">
                            <span><Phone size={13} /> {payment.leadPhone}</span>
                            <span><User size={13} /> Dealer: <strong>{payment.leadDealer}</strong></span>
                            {payment.leadLocation && <span><MapPin size={13} /> {payment.leadLocation}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="payment-amount-badge-group">
                        <div className="customer-payment-amount">
                          ₹{payment.amount.toLocaleString('en-IN')}
                        </div>
                        <span className={`customer-status-badge ${payment.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {payment.status === 'Verified' && <Check size={12} />}
                          {payment.status === 'Pending Verification' && <Clock size={12} />}
                          {payment.status === 'Rejected' && <X size={12} />}
                          {payment.status}
                        </span>
                      </div>
                    </div>

                    <div className="payment-details-bar">
                      <div className="detail-item">
                        <span className="detail-label">Type:</span>
                        <span className="detail-val-pill type">{payment.paymentType}</span>
                      </div>

                      <div className="detail-item">
                        <span className="detail-label">Mode:</span>
                        <span className="detail-val-pill mode">{payment.paymentMode}</span>
                      </div>

                      <div className="detail-item">
                        <span className="detail-label">Paid On:</span>
                        <span className="detail-val">
                          {new Date(payment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {payment.referenceNumber && (
                        <div className="detail-item">
                          <span className="detail-label">Ref / UTR:</span>
                          <span className="detail-val utr-badge">{payment.referenceNumber}</span>
                        </div>
                      )}
                    </div>

                    {payment.notes && (
                      <div className="payment-notes-box">
                        <strong>Remarks:</strong> {payment.notes}
                      </div>
                    )}

                    {payment.rejectionReason && (
                      <div className="payment-rejection-box">
                        <strong>Rejection Reason:</strong> {payment.rejectionReason}
                      </div>
                    )}

                    <div className="payment-card-footer">
                      <div className="recorded-by-tag">
                        Recorded by <strong>{payment.recordedBy}</strong> ({payment.recordedByRole})
                      </div>

                      <div className="card-actions-row">
                        {payment.proofUrl && (
                          <button 
                            className="btn-view-proof"
                            onClick={() => {
                              setActiveProof({
                                url: payment.proofUrl!,
                                fileName: payment.proofFileName || 'Receipt.jpg',
                                title: `Receipt: ${payment.customerName} (₹${payment.amount.toLocaleString('en-IN')})`
                              });
                              setShowProofLightbox(true);
                            }}
                          >
                            <Eye size={14} /> View Receipt
                          </button>
                        )}

                        {isAdmin && payment.status === 'Pending Verification' && (
                          <>
                            <button 
                              className="btn-verify-action"
                              onClick={() => handleVerifyCustomerPayment(payment.leadId, payment.id, payment.customerName)}
                            >
                              <Check size={14} /> Verify
                            </button>
                            <button 
                              className="btn-reject-action"
                              onClick={() => handleOpenRejectModal(payment.leadId, payment.id, payment.customerName)}
                            >
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}

                        {isAdmin && (
                          <button 
                            className="btn-delete-icon"
                            title="Delete Payment"
                            onClick={() => handleDeleteCustomerPayment(payment.leadId, payment.id, payment.customerName)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ADMIN TO DEALER (MILESTONE PAYOUTS)                */}
        {/* ========================================================= */}
        {activePaymentTab === 'admin_to_dealer' && (
          <div className="tab-pane fade-in">
            {/* Dealer Metrics Grid */}
            <div className="payments-metrics-grid">
              <div className="payments-metric-card navy-glow">
                <div className="metric-header">
                  <span className="metric-label">Total Dealer Payouts</span>
                  <div className="metric-icon-wrap navy">
                    <IndianRupee size={20} />
                  </div>
                </div>
                <div className="metric-value">₹{dealerMetrics.totalAmount.toLocaleString('en-IN')}</div>
                <div className="metric-subtitle">Across {dealerMetrics.totalEligibleLeads} Converted Projects</div>
              </div>

              <div className="payments-metric-card amber-glow">
                <div className="metric-header">
                  <span className="metric-label">Pending Admin Settle</span>
                  <div className="metric-icon-wrap amber">
                    <Clock size={20} />
                  </div>
                </div>
                <div className="metric-value">{dealerMetrics.pendingAdminCount}</div>
                <div className="metric-subtitle">Milestones awaiting Admin payout</div>
              </div>

              <div className="payments-metric-card blue-glow">
                <div className="metric-header">
                  <span className="metric-label">Awaiting Dealer Confirm</span>
                  <div className="metric-icon-wrap blue">
                    <AlertCircle size={20} />
                  </div>
                </div>
                <div className="metric-value">{dealerMetrics.awaitingDealerCount}</div>
                <div className="metric-subtitle">Proof sent, awaiting acknowledgment</div>
              </div>

              <div className="payments-metric-card emerald-glow">
                <div className="metric-header">
                  <span className="metric-label">Fully Confirmed</span>
                  <div className="metric-icon-wrap green">
                    <CheckCircle2 size={20} />
                  </div>
                </div>
                <div className="metric-value">{dealerMetrics.receivedCount}</div>
                <div className="metric-subtitle">Milestones verified by Dealer</div>
              </div>
            </div>

            {/* Dealer Filter Controls */}
            <div className="payments-filter-panel">
              <div className="filter-pills-row">
                <button 
                  className={`filter-pill-btn ${dealerFilterStatus === 'all' ? 'active' : ''}`}
                  onClick={() => setDealerFilterStatus('all')}
                >
                  All Projects <span className="pill-count">{eligibleDealerLeads.length}</span>
                </button>
                <button 
                  className={`filter-pill-btn ${dealerFilterStatus === 'pending_admin' ? 'active' : ''}`}
                  onClick={() => setDealerFilterStatus('pending_admin')}
                >
                  ⏳ Pending Settlement <span className="pill-count">{dealerMetrics.pendingAdminCount}</span>
                </button>
                <button 
                  className={`filter-pill-btn ${dealerFilterStatus === 'awaiting_dealer' ? 'active' : ''}`}
                  onClick={() => setDealerFilterStatus('awaiting_dealer')}
                >
                  📥 Awaiting Confirmation <span className="pill-count">{dealerMetrics.awaitingDealerCount}</span>
                </button>
                <button 
                  className={`filter-pill-btn ${dealerFilterStatus === 'received' ? 'active' : ''}`}
                  onClick={() => setDealerFilterStatus('received')}
                >
                  ✅ Fully Confirmed <span className="pill-count">{dealerMetrics.receivedCount}</span>
                </button>
              </div>

              <div className="filter-search-row">
                <div className="search-input-wrapper">
                  <Search size={18} className="search-icon-pos" />
                  <input 
                    type="text"
                    className="search-input-field"
                    placeholder="Search by customer, phone, dealer, or UTR number..."
                    value={dealerSearchQuery}
                    onChange={e => setDealerSearchQuery(e.target.value)}
                  />
                  {dealerSearchQuery && (
                    <button 
                      onClick={() => setDealerSearchQuery('')}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <select 
                    className="dealer-filter-dropdown"
                    value={selectedDealerFilter}
                    onChange={e => setSelectedDealerFilter(e.target.value)}
                  >
                    <option value="">All Dealers</option>
                    {dealers.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Leads Payment List */}
            {filteredDealerLeads.length === 0 ? (
              <div className="payments-empty-state">
                <CreditCard size={52} color="#cbd5e1" />
                <h3>No Converted Projects Found</h3>
                <p>
                  When a project lead is moved to <strong>Converted</strong> stage, it will automatically enter this Payments Dashboard for Pre & Post Installation settlements.
                </p>
              </div>
            ) : (
              <div className="payments-list">
                {filteredDealerLeads.map(lead => {
                  const pre = lead.payments?.preInstallation;
                  const post = lead.payments?.postInstallation;

                  const preStatus = pre?.status || 'Pending Settlement';
                  const postStatus = post?.status || 'Pending Settlement';

                  return (
                    <div key={lead.id} className="payment-lead-card">
                      {/* Lead Header */}
                      <div className="lead-card-header">
                        <div className="lead-meta-info">
                          <div className="lead-customer-name">{lead.customer}</div>
                          <div className="lead-meta-details">
                            <span><Phone size={14} /> {lead.phone}</span>
                            {lead.location && <span><MapPin size={14} /> {lead.location}</span>}
                            <span><User size={14} /> Dealer: <strong>{lead.dealer}</strong></span>
                            {lead.assignedEmployee && <span>Assignee: {lead.assignedEmployee}</span>}
                          </div>
                        </div>

                        <div className="lead-badges-row">
                          <span className={`stage-badge ${lead.stage.toLowerCase()}`}>
                            Stage: {lead.stage}
                          </span>
                        </div>
                      </div>

                      {/* Milestones Grid (2 Milestones) */}
                      <div className="milestones-grid">
                        {/* MILESTONE 1: Pre-Installation Payment */}
                        <div className={`milestone-box ${preStatus === 'Received' ? 'received' : preStatus === 'Settled' ? 'settled' : 'pending'}`}>
                          <div className="milestone-header">
                            <div className="milestone-title">
                              <CreditCard size={18} color="#3b82f6" /> 1. Pre-Installation Payout
                            </div>
                            <span className={`milestone-status-tag ${preStatus === 'Received' ? 'received' : preStatus === 'Settled' ? 'settled' : 'pending'}`}>
                              {preStatus === 'Received' ? '✓ Received' : preStatus === 'Settled' ? 'Settled (Awaiting Confirm)' : 'Pending Settlement'}
                            </span>
                          </div>

                          <div className="milestone-amount-row">
                            <span className="milestone-amount-label">Payout Amount:</span>
                            <span className="milestone-amount-val">
                              {pre?.amount ? `₹${pre.amount.toLocaleString('en-IN')}` : '₹ —'}
                            </span>
                          </div>

                          {pre?.utrNumber && (
                            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                              UTR / Ref: <strong>{pre.utrNumber}</strong>
                            </div>
                          )}

                          {pre?.settledAt && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Settled by {pre.settledBy || 'Admin'} on {new Date(pre.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}

                          {pre?.proofUrl && (
                            <div className="milestone-proof-area">
                              <CheckCircle size={16} color="#10b981" />
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pre.proofFileName || 'Payment Proof Screenshot'}
                              </span>
                              <button 
                                className="btn-view-proof"
                                onClick={() => {
                                  setActiveProof({
                                    url: pre.proofUrl!,
                                    fileName: pre.proofFileName || 'Proof.jpg',
                                    title: `Pre-Installation Proof: ${lead.customer}`
                                  });
                                  setShowProofLightbox(true);
                                }}
                              >
                                <Eye size={14} /> View
                              </button>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="milestone-actions-row">
                            {isAdmin && (
                              <button 
                                className="btn-settle"
                                onClick={() => handleOpenSettleModal(lead, 'Pre-Installation')}
                              >
                                {preStatus === 'Pending Settlement' ? (
                                  <><CreditCard size={15} /> Settle Pre-Payment</>
                                ) : (
                                  <><Upload size={14} /> Update Settlement</>
                                )}
                              </button>
                            )}

                            {isDealer && preStatus === 'Settled' && (
                              <button 
                                className="btn-receive"
                                onClick={() => handleOpenConfirmModal(lead, 'Pre-Installation')}
                              >
                                <CheckCircle2 size={16} /> Mark as Received
                              </button>
                            )}

                            {preStatus === 'Received' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#16a34a', fontWeight: 700, fontSize: '0.85rem' }}>
                                <CheckCircle2 size={18} /> Received by Dealer ({new Date(pre?.receivedAt || '').toLocaleDateString('en-IN')})
                              </div>
                            )}
                          </div>
                        </div>

                        {/* MILESTONE 2: Post-Installation Payment */}
                        <div className={`milestone-box ${postStatus === 'Received' ? 'received' : postStatus === 'Settled' ? 'settled' : 'pending'}`}>
                          <div className="milestone-header">
                            <div className="milestone-title">
                              <ArrowUpRight size={18} color="#f59e0b" /> 2. Post-Installation Payout
                            </div>
                            <span className={`milestone-status-tag ${postStatus === 'Received' ? 'received' : postStatus === 'Settled' ? 'settled' : 'pending'}`}>
                              {postStatus === 'Received' ? '✓ Received' : postStatus === 'Settled' ? 'Settled (Awaiting Confirm)' : 'Pending Settlement'}
                            </span>
                          </div>

                          <div className="milestone-amount-row">
                            <span className="milestone-amount-label">Payout Amount:</span>
                            <span className="milestone-amount-val">
                              {post?.amount ? `₹${post.amount.toLocaleString('en-IN')}` : '₹ —'}
                            </span>
                          </div>

                          {post?.utrNumber && (
                            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                              UTR / Ref: <strong>{post.utrNumber}</strong>
                            </div>
                          )}

                          {post?.settledAt && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Settled by {post.settledBy || 'Admin'} on {new Date(post.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}

                          {post?.proofUrl && (
                            <div className="milestone-proof-area">
                              <CheckCircle size={16} color="#10b981" />
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {post.proofFileName || 'Payment Proof Screenshot'}
                              </span>
                              <button 
                                className="btn-view-proof"
                                onClick={() => {
                                  setActiveProof({
                                    url: post.proofUrl!,
                                    fileName: post.proofFileName || 'Proof.jpg',
                                    title: `Post-Installation Proof: ${lead.customer}`
                                  });
                                  setShowProofLightbox(true);
                                }}
                              >
                                <Eye size={14} /> View
                              </button>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="milestone-actions-row">
                            {isAdmin && (
                              <button 
                                className="btn-settle"
                                onClick={() => handleOpenSettleModal(lead, 'Post-Installation')}
                              >
                                {postStatus === 'Pending Settlement' ? (
                                  <><CreditCard size={15} /> Settle Post-Payment</>
                                ) : (
                                  <><Upload size={14} /> Update Settlement</>
                                )}
                              </button>
                            )}

                            {isDealer && postStatus === 'Settled' && (
                              <button 
                                className="btn-receive"
                                onClick={() => handleOpenConfirmModal(lead, 'Post-Installation')}
                              >
                                <CheckCircle2 size={16} /> Mark as Received
                              </button>
                            )}

                            {postStatus === 'Received' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#16a34a', fontWeight: 700, fontSize: '0.85rem' }}>
                                <CheckCircle2 size={18} /> Received by Dealer ({new Date(post?.receivedAt || '').toLocaleDateString('en-IN')})
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: FINANCIAL ANALYTICS & MARGIN OVERVIEW             */}
        {/* ========================================================= */}
        {activePaymentTab === 'overview' && (
          <div className="tab-pane fade-in">
            {/* Big Comparative Cards */}
            <div className="analytics-summary-cards">
              <div className="analytics-card inflow">
                <div className="analytics-card-header">
                  <div className="analytics-badge-label">Total Customer Inflow (Verified)</div>
                  <ArrowDownLeft size={24} className="icon-inflow" />
                </div>
                <div className="analytics-huge-value">₹{netFinancials.totalInflow.toLocaleString('en-IN')}</div>
                <div className="analytics-footer-text">
                  Direct payments collected into Admin accounts
                </div>
              </div>

              <div className="analytics-card outflow">
                <div className="analytics-card-header">
                  <div className="analytics-badge-label">Total Dealer Outflow (Settled)</div>
                  <ArrowUpRight size={24} className="icon-outflow" />
                </div>
                <div className="analytics-huge-value">₹{netFinancials.totalOutflow.toLocaleString('en-IN')}</div>
                <div className="analytics-footer-text">
                  Commissions & milestone payouts disbursed to dealers
                </div>
              </div>

              <div className={`analytics-card margin ${netFinancials.netRetained >= 0 ? 'positive' : 'negative'}`}>
                <div className="analytics-card-header">
                  <div className="analytics-badge-label">Net Retained Revenue</div>
                  <DollarSign size={24} className="icon-margin" />
                </div>
                <div className="analytics-huge-value">₹{netFinancials.netRetained.toLocaleString('en-IN')}</div>
                <div className="analytics-footer-text">
                  Gross financial buffer retained across all projects
                </div>
              </div>
            </div>

            {/* Breakdown section */}
            <div className="analytics-sections-grid">
              <div className="analytics-sub-panel">
                <h3>📊 Customer Collections by Payment Mode</h3>
                <div className="mode-breakdown-list">
                  {['UPI', 'Bank Transfer / NEFT', 'Net Banking', 'Cheque', 'Cash', 'Bank Loan'].map(mode => {
                    const count = allCustomerPayments.filter(p => p.paymentMode === mode).length;
                    const sum = allCustomerPayments.filter(p => p.paymentMode === mode).reduce((acc, curr) => acc + (curr.amount || 0), 0);
                    const percentage = customerMetrics.totalCollected > 0 ? ((sum / customerMetrics.totalCollected) * 100).toFixed(1) : 0;
                    return (
                      <div key={mode} className="mode-bar-item">
                        <div className="mode-bar-header">
                          <span className="mode-name">{mode} ({count} txns)</span>
                          <span className="mode-sum">₹{sum.toLocaleString('en-IN')} ({percentage}%)</span>
                        </div>
                        <div className="mode-progress-track">
                          <div className="mode-progress-fill" style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="analytics-sub-panel">
                <h3>🏢 Quick Audit Trail & Actions</h3>
                <div className="audit-quick-items">
                  <div className="audit-item">
                    <div className="audit-icon-wrap emerald"><CheckCircle size={18} /></div>
                    <div>
                      <strong>{customerMetrics.verifiedCount} Customer Transactions Verified</strong>
                      <p>Funds acknowledged and marked clear in company accounts.</p>
                    </div>
                  </div>

                  <div className="audit-item">
                    <div className="audit-icon-wrap amber"><Clock size={18} /></div>
                    <div>
                      <strong>{customerMetrics.pendingCount} Customer Receipts Pending Review</strong>
                      <p>Requires Admin verification in the Customer ➔ Admin tab.</p>
                    </div>
                  </div>

                  <div className="audit-item">
                    <div className="audit-icon-wrap blue"><CreditCard size={18} /></div>
                    <div>
                      <strong>{dealerMetrics.awaitingDealerCount} Dealer Payouts Awaiting Confirmation</strong>
                      <p>Dealers need to verify proofs and click confirm in their dashboard.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* MODAL 1: RECORD CUSTOMER PAYMENT MODAL                    */}
      {/* ========================================================= */}
      {showRecordCustomerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ArrowDownLeft size={22} color="#10b981" /> Record Customer Payment
                </h2>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Log incoming payment collected from customer (Customer ➔ Admin).
                </span>
              </div>
              <button 
                onClick={() => setShowRecordCustomerModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Select Project / Customer Lead *</label>
              <select 
                value={recordForm.leadId}
                onChange={e => setRecordForm({ ...recordForm, leadId: e.target.value })}
                style={{ fontWeight: 600 }}
              >
                <option value="">-- Choose Customer / Lead --</option>
                {accessibleLeads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.customer} ({lead.phone}) — {lead.stage} [Dealer: {lead.dealer}]
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Amount Collected (₹) *</label>
                <input 
                  type="number"
                  placeholder="E.g. 50000"
                  value={recordForm.amount}
                  onChange={e => setRecordForm({ ...recordForm, amount: e.target.value })}
                  style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}
                />
              </div>

              <div className="form-group">
                <label>Payment Category *</label>
                <select 
                  value={recordForm.paymentType}
                  onChange={e => setRecordForm({ ...recordForm, paymentType: e.target.value as CustomerPaymentType })}
                >
                  <option value="Booking / Advance">Booking / Advance</option>
                  <option value="First Milestone">First Milestone</option>
                  <option value="Bank Loan Disbursal">Bank Loan Disbursal</option>
                  <option value="Final Payment">Final Payment</option>
                  <option value="Subsidy Received">Subsidy Received</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Payment Mode *</label>
                <select 
                  value={recordForm.paymentMode}
                  onChange={e => setRecordForm({ ...recordForm, paymentMode: e.target.value as CustomerPaymentMode })}
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer / NEFT">Bank Transfer / NEFT / IMPS</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Loan">Bank Loan</option>
                  <option value="Credit / Debit Card">Credit / Debit Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Date Paid</label>
                <input 
                  type="date"
                  value={recordForm.paidAt}
                  onChange={e => setRecordForm({ ...recordForm, paidAt: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>UTR / Transaction Ref / Cheque No.</label>
              <input 
                type="text"
                placeholder="E.g. UTR1829401824 or Cheque #102931"
                value={recordForm.referenceNumber}
                onChange={e => setRecordForm({ ...recordForm, referenceNumber: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Receipt Screenshot / Proof Upload (Firebase Storage)</label>
              <div 
                className="upload-dropzone"
                onClick={() => document.getElementById('customer-payment-file-input')?.click()}
              >
                <Upload size={32} color="#94a3b8" style={{ marginBottom: '0.4rem' }} />
                <input 
                  type="file"
                  id="customer-payment-file-input"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      setRecordForm({ ...recordForm, file: e.target.files[0] });
                    }
                  }}
                />
                <button type="button" className="btn-outline" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                  Browse Receipt File
                </button>
                {recordForm.file && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                    ✓ Selected: {recordForm.file.name} ({(recordForm.file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Notes / Comments</label>
              <textarea 
                placeholder="E.g. Received via GPay from customer's HDFC account..."
                value={recordForm.notes}
                onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
                style={{ minHeight: '60px' }}
              />
            </div>

            <div className="modal-actions">
              <button 
                className="btn-outline" 
                onClick={() => setShowRecordCustomerModal(false)}
                disabled={isRecordingPayment}
              >
                Cancel
              </button>
              <button 
                className="btn-cool-primary" 
                onClick={handleSubmitCustomerPayment}
                disabled={isRecordingPayment || !recordForm.amount || !recordForm.leadId}
              >
                {isRecordingPayment ? (
                  <><Loader2 size={16} className="spin-icon" /> Uploading & Saving...</>
                ) : (
                  <>Save Customer Payment</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: REJECT CUSTOMER PAYMENT MODAL                    */}
      {/* ========================================================= */}
      {showRejectModal && rejectTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h2 style={{ color: '#ef4444', marginTop: 0 }}>Reject Customer Payment</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Provide a reason for rejecting payment from <strong>{rejectTarget.customerName}</strong>:
            </p>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label>Rejection Reason</label>
              <input 
                type="text"
                placeholder="E.g. Amount not credited in bank, invalid UTR"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleConfirmRejectCustomerPayment}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADMIN SETTLE DEALER PAYOUT MODAL                 */}
      {/* ========================================================= */}
      {showSettleModal && settleTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Settle {settleTarget.milestoneType} Payout</h2>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Project: <strong>{settleTarget.lead.customer}</strong> • Dealer: <strong>{settleTarget.lead.dealer}</strong>
                </span>
              </div>
              <button 
                onClick={() => setShowSettleModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Payout Amount (₹) *</label>
              <input 
                type="number"
                placeholder="E.g. 25000"
                value={settleForm.amount}
                onChange={e => setSettleForm({ ...settleForm, amount: e.target.value })}
                style={{ fontSize: '1.1rem', fontWeight: 700 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>UTR / Transaction Reference (Optional)</label>
              <input 
                type="text"
                placeholder="E.g. UTR12849104810 or IMPS ref"
                value={settleForm.utrNumber}
                onChange={e => setSettleForm({ ...settleForm, utrNumber: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label>Payment Proof Screenshot / Receipt *</label>
              <div 
                className="upload-dropzone"
                onClick={() => document.getElementById('dealer-payout-proof-input')?.click()}
              >
                <Upload size={36} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
                <input 
                  type="file"
                  id="dealer-payout-proof-input"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSettleForm({ ...settleForm, file: e.target.files[0] });
                    }
                  }}
                />
                <button type="button" className="btn-outline" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                  Browse Screenshot File
                </button>
                {settleForm.file && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>
                    ✓ Selected: {settleForm.file.name} ({(settleForm.file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Admin Notes</label>
              <textarea 
                placeholder="Any special remarks or bank transfer notes..."
                value={settleForm.adminNotes}
                onChange={e => setSettleForm({ ...settleForm, adminNotes: e.target.value })}
                style={{ minHeight: '60px' }}
              />
            </div>

            <div className="modal-actions">
              <button 
                className="btn-outline" 
                onClick={() => setShowSettleModal(false)}
                disabled={isUploadingProof}
              >
                Cancel
              </button>
              <button 
                className="btn-cool-primary" 
                onClick={handleSubmitSettlement}
                disabled={isUploadingProof || !settleForm.amount}
              >
                {isUploadingProof ? (
                  <><Loader2 size={16} className="spin-icon" /> Uploading & Settling...</>
                ) : (
                  <>Confirm Settlement & Send Proof</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: DEALER CONFIRM RECEIPT MODAL                     */}
      {/* ========================================================= */}
      {showConfirmModalState && confirmTarget && (() => {
        const milestone = confirmTarget.milestoneType === 'Pre-Installation'
          ? confirmTarget.lead.payments?.preInstallation
          : confirmTarget.lead.payments?.postInstallation;

        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '480px' }}>
              <h2 style={{ color: '#166534', marginTop: 0 }}>Confirm Payment Receipt</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Please verify that you have received the <strong>{confirmTarget.milestoneType}</strong> payout for project <strong>{confirmTarget.lead.customer}</strong>:
              </p>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Amount Settled:</span>
                  <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>₹{milestone?.amount?.toLocaleString('en-IN')}</strong>
                </div>
                {milestone?.utrNumber && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>UTR / Reference:</span>
                    <strong style={{ color: '#0f172a' }}>{milestone.utrNumber}</strong>
                  </div>
                )}
                {milestone?.proofUrl && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>Payment Proof:</span>
                    <button 
                      className="btn-view-proof"
                      onClick={() => {
                        setActiveProof({
                          url: milestone.proofUrl!,
                          fileName: milestone.proofFileName || 'Proof.jpg',
                          title: `Payment Receipt: ${confirmTarget.lead.customer}`
                        });
                        setShowProofLightbox(true);
                      }}
                    >
                      <Eye size={14} /> View Proof Screenshot
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Acknowledgment Note (Optional)</label>
                <input 
                  type="text"
                  placeholder="E.g. Received in HDFC Bank account."
                  value={dealerNotes}
                  onChange={e => setDealerNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="btn-outline" 
                  onClick={() => setShowConfirmModalState(false)}
                  disabled={isConfirming}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                  onClick={handleConfirmReceived}
                  disabled={isConfirming}
                >
                  {isConfirming ? 'Confirming...' : '✓ Confirm Payment Received'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* UNIVERSAL PROOF LIGHTBOX MODAL                            */}
      {/* ========================================================= */}
      {showProofLightbox && activeProof && (
        <div className="modal-overlay" onClick={() => setShowProofLightbox(false)}>
          <div className="modal-content proof-lightbox-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b' }}>{activeProof.title}</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{activeProof.fileName}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  className="btn-outline" 
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => handleDownloadProof(activeProof.url, activeProof.fileName)}
                >
                  <Download size={14} /> Download
                </button>
                <a 
                  href={activeProof.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-outline" 
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', color: '#1e293b' }}
                >
                  <ExternalLink size={14} /> Fullscreen
                </a>
                <button 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  onClick={() => setShowProofLightbox(false)}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="proof-image-container">
              {activeProof.url.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={activeProof.url} 
                  title="PDF Preview" 
                  style={{ width: '100%', height: '55vh', border: 'none' }}
                />
              ) : (
                <img src={activeProof.url} alt="Payment Receipt Proof" />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
