import { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, Search, CheckCircle2, Clock, 
  Upload, Eye, Download, ExternalLink, X, 
  CheckCircle, ArrowUpRight, ShieldCheck,
  AlertCircle, ChevronRight, User, Phone, MapPin, Loader2, IndianRupee
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import type { MockLead, PaymentMilestoneType } from './context/CRMContext';
import { useUI } from './context/UIContext';
import './PaymentsPage.css';

interface PaymentsPageProps {
  onNavigate?: (path: string) => void;
}

export default function PaymentsPage({ onNavigate: _onNavigate }: PaymentsPageProps) {
  const { leads, dealers, currentUser, settleLeadPayment, acknowledgeLeadPayment } = useCRM();
  const { showToast } = useUI();

  const isAdmin = currentUser?.role === 'Admin';
  const isDealer = currentUser?.role === 'Dealer';

  // Filters state
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending_admin' | 'awaiting_dealer' | 'received'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDealerFilter, setSelectedDealerFilter] = useState('');

  // Modals state
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{ lead: MockLead; milestoneType: PaymentMilestoneType } | null>(null);
  const [settleForm, setSettleForm] = useState({
    amount: '',
    utrNumber: '',
    adminNotes: '',
    file: null as File | null
  });
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ lead: MockLead; milestoneType: PaymentMilestoneType } | null>(null);
  const [dealerNotes, setDealerNotes] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const [showProofLightbox, setShowProofLightbox] = useState(false);
  const [activeProof, setActiveProof] = useState<{ url: string; fileName: string; title: string } | null>(null);

  // Filter converted project leads
  const eligibleLeads = useMemo(() => {
    return leads.filter(l => {
      // 1. Role scoping
      if (isDealer && l.dealer !== currentUser?.name) return false;
      
      // 2. Must not be archived
      if (l.archived) return false;

      // 3. Must be at Converted stage or later
      const isConvertedOrBeyond = l.stage === 'Converted' || l.stage === 'Loan' || l.stage === 'Material' || l.stage === 'Installation' || l.stage === 'Completed';
      
      return isConvertedOrBeyond;
    });
  }, [leads, isDealer, currentUser]);

  // Synchronize open modal targets if leads update in real-time
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

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    let totalSettledOrReceivedAmount = 0;
    let pendingAdminCount = 0;
    let awaitingDealerCount = 0;
    let receivedCount = 0;

    eligibleLeads.forEach(lead => {
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
      totalEligibleLeads: eligibleLeads.length
    };
  }, [eligibleLeads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return eligibleLeads.filter(lead => {
      // 1. Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCust = lead.customer?.toLowerCase().includes(q);
        const matchesDlr = lead.dealer?.toLowerCase().includes(q);
        const matchesPhone = lead.phone?.toLowerCase().includes(q);
        const matchesUtr = (lead.payments?.preInstallation?.utrNumber?.toLowerCase().includes(q)) || 
                           (lead.payments?.postInstallation?.utrNumber?.toLowerCase().includes(q));
        if (!matchesCust && !matchesDlr && !matchesPhone && !matchesUtr) return false;
      }

      // 2. Dealer Dropdown Filter (Admin view)
      if (isAdmin && selectedDealerFilter) {
        if (lead.dealer !== selectedDealerFilter) return false;
      }

      // 3. Status Tab filter
      if (filterStatus === 'pending_admin') {
        const prePending = !lead.payments?.preInstallation || lead.payments.preInstallation.status === 'Pending Settlement';
        const postPending = !lead.payments?.postInstallation || lead.payments.postInstallation.status === 'Pending Settlement';
        return prePending || postPending;
      } else if (filterStatus === 'awaiting_dealer') {
        const preAwaiting = lead.payments?.preInstallation?.status === 'Settled';
        const postAwaiting = lead.payments?.postInstallation?.status === 'Settled';
        return preAwaiting || postAwaiting;
      } else if (filterStatus === 'received') {
        const preReceived = lead.payments?.preInstallation?.status === 'Received';
        const postReceived = lead.payments?.postInstallation?.status === 'Received';
        return preReceived && postReceived;
      }

      return true;
    });
  }, [eligibleLeads, searchQuery, selectedDealerFilter, filterStatus, isAdmin]);

  // Cloudinary Proof Upload Handler
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const cloudName = 'pzfmhu4n';
    const uploadPreset = 'crm-mirrorsolar';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to upload screenshot to cloud storage');
    }

    const data = await response.json();
    return data.secure_url;
  };

  // Open Settle Modal
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

  // Submit Settlement
  const handleSubmitSettlement = async () => {
    if (!settleTarget) return;
    const numAmount = parseFloat(settleForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Please enter a valid payout amount.");
      return;
    }

    const existingMilestone = settleTarget.milestoneType === 'Pre-Installation' 
      ? settleTarget.lead.payments?.preInstallation 
      : settleTarget.lead.payments?.postInstallation;

    if (!settleForm.file && !existingMilestone?.proofUrl) {
      showToast("Please upload a payment proof screenshot.");
      return;
    }

    try {
      setIsUploadingProof(true);
      let proofUrl = existingMilestone?.proofUrl || '';
      let proofFileName = existingMilestone?.proofFileName || 'Payment_Proof.jpg';
      let proofFileSize = existingMilestone?.proofFileSize || 0;

      if (settleForm.file) {
        proofUrl = await uploadToCloudinary(settleForm.file);
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

  // Open Dealer Confirm Received Modal
  const handleOpenConfirmModal = (lead: MockLead, milestoneType: PaymentMilestoneType) => {
    setConfirmTarget({ lead, milestoneType });
    setDealerNotes('');
    setShowConfirmModal(true);
  };

  // Confirm Received
  const handleConfirmReceived = async () => {
    if (!confirmTarget) return;
    try {
      setIsConfirming(true);
      await acknowledgeLeadPayment(confirmTarget.lead.id, confirmTarget.milestoneType, {
        dealerNotes: dealerNotes.trim()
      });
      showToast(`Confirmed! ${confirmTarget.milestoneType} marked as Received.`, 'success');
      setShowConfirmModal(false);
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
    let downloadUrl = proofUrl;
    if (downloadUrl.includes('/image/upload/') && !downloadUrl.includes('/image/upload/fl_attachment/')) {
      downloadUrl = downloadUrl.replace('/image/upload/', '/image/upload/fl_attachment/');
    }
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName || 'payment-receipt.jpg';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="payments-page">
      {/* Header */}
      <div className="payments-header">
        <div className="payments-title-area">
          <h1>Payments & Payouts Dashboard</h1>
          <p>
            {isAdmin 
              ? "Settle and track milestone payouts (Pre & Post Installation) for dealer project leads." 
              : "View your settled milestone payouts and confirm receipt of payment proofs."}
          </p>
        </div>
        <div className="lead-badges-row">
          <span className="stage-badge converted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
            <ShieldCheck size={16} /> {isAdmin ? "Admin Finance Portal" : `Dealer: ${currentUser?.name}`}
          </span>
        </div>
      </div>

      <div className="payments-main">
        {/* Metric Cards */}
        <div className="payments-metrics-grid">
          <div className="payments-metric-card">
            <div className="metric-header">
              <span className="metric-label">Total Payouts Value</span>
              <div className="metric-icon-wrap navy">
                <IndianRupee size={20} />
              </div>
            </div>
            <div className="metric-value">₹{metrics.totalAmount.toLocaleString('en-IN')}</div>
            <div className="metric-subtitle">Across {metrics.totalEligibleLeads} Converted Projects</div>
          </div>

          <div className="payments-metric-card">
            <div className="metric-header">
              <span className="metric-label">Pending Settlement</span>
              <div className="metric-icon-wrap amber">
                <Clock size={20} />
              </div>
            </div>
            <div className="metric-value">{metrics.pendingAdminCount}</div>
            <div className="metric-subtitle">Milestones awaiting Admin settlement</div>
          </div>

          <div className="payments-metric-card">
            <div className="metric-header">
              <span className="metric-label">Awaiting Dealer Receipt</span>
              <div className="metric-icon-wrap blue">
                <AlertCircle size={20} />
              </div>
            </div>
            <div className="metric-value">{metrics.awaitingDealerCount}</div>
            <div className="metric-subtitle">Proof uploaded, awaiting confirmation</div>
          </div>

          <div className="payments-metric-card">
            <div className="metric-header">
              <span className="metric-label">Fully Confirmed</span>
              <div className="metric-icon-wrap green">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div className="metric-value">{metrics.receivedCount}</div>
            <div className="metric-subtitle">Milestones verified & received by Dealer</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="payments-filter-panel">
          <div className="filter-pills-row">
            <button 
              className={`filter-pill-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All Projects <span className="pill-count">{eligibleLeads.length}</span>
            </button>
            <button 
              className={`filter-pill-btn ${filterStatus === 'pending_admin' ? 'active' : ''}`}
              onClick={() => setFilterStatus('pending_admin')}
            >
              ⏳ Pending Settlement <span className="pill-count">{metrics.pendingAdminCount}</span>
            </button>
            <button 
              className={`filter-pill-btn ${filterStatus === 'awaiting_dealer' ? 'active' : ''}`}
              onClick={() => setFilterStatus('awaiting_dealer')}
            >
              📥 Awaiting Dealer Confirmation <span className="pill-count">{metrics.awaitingDealerCount}</span>
            </button>
            <button 
              className={`filter-pill-btn ${filterStatus === 'received' ? 'active' : ''}`}
              onClick={() => setFilterStatus('received')}
            >
              ✅ Fully Confirmed <span className="pill-count">{metrics.receivedCount}</span>
            </button>
          </div>

          <div className="filter-search-row">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon-pos" />
              <input 
                type="text"
                className="search-input-field"
                placeholder="Search by customer, phone, dealer, or UTR number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
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
        {filteredLeads.length === 0 ? (
          <div className="payments-empty-state">
            <CreditCard size={48} color="#cbd5e1" />
            <h3>No Converted Projects Found</h3>
            <p>
              When a project lead is moved to <strong>Converted</strong> stage, it will automatically enter this Payments Dashboard for Pre & Post Installation settlements.
            </p>
          </div>
        ) : (
          <div className="payments-list">
            {filteredLeads.map(lead => {
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
                          <CreditCard size={18} color="#3b82f6" /> 1. Pre-Installation Payment
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
                          <ArrowUpRight size={18} color="#f59e0b" /> 2. Post-Installation Payment
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

      {/* ADMIN SETTLE PAYMENT MODAL */}
      {showSettleModal && settleTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Settle {settleTarget.milestoneType} Payment</h2>
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
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer'
                }}
                onClick={() => document.getElementById('payment-proof-input')?.click()}
              >
                <Upload size={36} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
                <input 
                  type="file"
                  id="payment-proof-input"
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
                className="btn-primary" 
                onClick={handleSubmitSettlement}
                disabled={isUploadingProof || !settleForm.amount}
              >
                {isUploadingProof ? (
                  <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Uploading & Settling...</>
                ) : (
                  <>Confirm Settlement & Send Proof</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEALER CONFIRM RECEIPT MODAL */}
      {showConfirmModal && confirmTarget && (() => {
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
                  onClick={() => setShowConfirmModal(false)}
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

      {/* PROOF LIGHTBOX MODAL */}
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
              <img src={activeProof.url} alt="Payment Receipt Proof" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
