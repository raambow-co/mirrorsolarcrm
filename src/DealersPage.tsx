import React, { useState, useMemo } from 'react';
import { 
  Users, Activity, Target, Plus, Search, ChevronRight, X, 
  Briefcase
} from 'lucide-react';
import { useCRM, STAGES } from './context/CRMContext';
import type { Dealer } from './context/CRMContext';
import { useUI } from './context/UIContext';
import './DealersPage.css';

export default function DealersPage() {
  const { leads, dealers, addDealer, updateDealer, activities, currentUser, addActivity } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  // --- States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [perfFilter, setPerfFilter] = useState('All');
  
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDealerData, setEditDealerData] = useState<Partial<Dealer>>({});

  // --- Derived Data ---
  const activeDealersCount = dealers.filter(d => d.status === 'Active').length;
  // Note: Only counting leads that belong to actual dealers in the system
  const dealerLeads = leads.filter(l => dealers.some(d => d.name === l.dealer));
  const totalDealerLeads = dealerLeads.length;
  const totalConvertedLeads = dealerLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length;

  // Helper: compute stats per dealer
  const getDealerStats = (dealerName: string) => {
    const dlrLeads = leads.filter(l => l.dealer === dealerName);
    const assigned = dlrLeads.length;
    const active = dlrLeads.filter(l => l.stage !== 'Converted' && l.stage !== 'Completed' && !l.archived).length;
    const converted = dlrLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length;
    const conversionRate = assigned > 0 ? Math.round((converted / assigned) * 100) : 0;
    
    // Unique employees working on this dealer's leads
    const emps = Array.from(new Set(dlrLeads.map(l => l.assignedEmployee))).filter(Boolean);

    const stageCounts: Record<string, number> = {};
    STAGES.forEach(s => stageCounts[s] = 0);
    dlrLeads.forEach(l => { stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1; });

    let perfLabel = 'Low';
    if (conversionRate >= 50) perfLabel = 'High';
    else if (conversionRate >= 25) perfLabel = 'Medium';

    // Actual follow-ups calculation
    const followUps = dlrLeads.filter(l => l.followUp && (l.followUp.status === 'Due Today' || l.followUp.status === 'Overdue')).length;
    const avgFollowUp = followUps.toString(); // Repurposing the UI field to show actual pending followups instead of a fake average

    return { assigned, active, converted, conversionRate, emps, stageCounts, perfLabel, avgFollowUp, dlrLeads };
  };

  // --- Filtering ---
  const filteredDealers = useMemo(() => {
    return dealers.filter(dlr => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = dlr.name.toLowerCase().includes(q) || 
                            dlr.id.toLowerCase().includes(q) ||
                            dlr.phone.toLowerCase().includes(q) ||
                            dlr.email.toLowerCase().includes(q) ||
                            dlr.address.toLowerCase().includes(q);
      
      const matchesStatus = statusFilter === 'All' || dlr.status === statusFilter;
      
      const stats = getDealerStats(dlr.name);
      const matchesPerf = perfFilter === 'All' || stats.perfLabel === perfFilter;

      return matchesSearch && matchesStatus && matchesPerf;
    });
  }, [dealers, searchQuery, statusFilter, perfFilter, leads]);

  // --- Add/Edit Dealer Form ---
  const [newDlr, setNewDlr] = useState({ name: '', phone: '', email: '', address: '', status: 'Active' });

  const handleAddDealer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDlr.name.trim()) {
      addDealer({
        name: newDlr.name,
        initials: newDlr.name.substring(0, 2).toUpperCase(),
        phone: newDlr.phone || '-',
        email: newDlr.email || '-',
        address: newDlr.address || '-',
        status: newDlr.status as 'Active' | 'Inactive',
        lastActive: 'Just now'
      });
      addActivity({
        type: 'Dealer Added',
        message: `Added new dealer ${newDlr.name}`,
        user: currentUser?.name || 'Admin'
      });
      showToast('Dealer added successfully', 'success');
      setIsAddModalOpen(false);
      setNewDlr({ name: '', phone: '', email: '', address: '', status: 'Active' });
    }
  };

  const openEditModal = (dlr: Dealer) => {
    setEditDealerData({ ...dlr });
    setIsEditModalOpen(true);
    setSelectedDealer(null); // close detail panel if open
  };

  const handleEditDealer = (e: React.FormEvent) => {
    e.preventDefault();
    if (editDealerData.id) {
      updateDealer(editDealerData.id, editDealerData);
      addActivity({
        type: 'Dealer Updated',
        message: `Updated details for dealer ${editDealerData.name}`,
        user: currentUser?.name || 'Admin'
      });
      showToast('Dealer updated successfully', 'success');
      setIsEditModalOpen(false);
    }
  };

  const handleDeactivate = (dlr: Dealer) => {
    showConfirmModal(
      'Deactivate Dealer?',
      `Are you sure you want to deactivate ${dlr.name}?`,
      () => {
        updateDealer(dlr.id, { status: 'Inactive' });
        addActivity({
          type: 'Dealer Deactivated',
          message: `Deactivated dealer ${dlr.name}`,
          user: currentUser?.name || 'Admin'
        });
        showToast('Dealer deactivated', 'info');
        if (selectedDealer?.id === dlr.id) setSelectedDealer(null);
      },
      { confirmText: 'Deactivate', cancelText: 'Cancel' }
    );
  };

  return (
    <div className="dealers-page">
      {/* Header */}
      <div className="dp-header">
        <div className="dp-header-left">
          <p>Dashboard / Dealers</p>
          <h1>Dealers</h1>
          <p>Manage dealer performance, leads and business activity.</p>
        </div>
        <div className="dp-header-right" style={{ display: 'flex', gap: '12px' }}>
          <button className="dp-btn-secondary" style={{ padding: '0.75rem 1.5rem', background: 'var(--color-white)', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, color: 'var(--color-navy)', cursor: 'pointer' }}>
            Export
          </button>
          <button className="dp-btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Add Dealer
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dp-summary-grid">
        <div className="dp-summary-card">
          <div className="dp-card-header">
            <span className="dp-card-title">Total Dealers</span>
            <div className="dp-card-icon navy"><Briefcase size={20} /></div>
          </div>
          <div className="dp-card-value">{dealers.length}</div>
          <div className="dp-card-footer neutral">Partner network</div>
          <div className="dp-card-bottom-accent navy"></div>
        </div>

        <div className="dp-summary-card">
          <div className="dp-card-header">
            <span className="dp-card-title">Active Dealers</span>
            <div className="dp-card-icon green"><Activity size={20} /></div>
          </div>
          <div className="dp-card-value">{activeDealersCount}</div>
          <div className="dp-card-footer positive">Generating leads</div>
          <div className="dp-card-bottom-accent green"></div>
        </div>

        <div className="dp-summary-card">
          <div className="dp-card-header">
            <span className="dp-card-title">Dealer Leads</span>
            <div className="dp-card-icon yellow"><Users size={20} /></div>
          </div>
          <div className="dp-card-value">{totalDealerLeads}</div>
          <div className="dp-card-footer neutral">Sourced this month</div>
          <div className="dp-card-bottom-accent yellow"></div>
        </div>

        <div className="dp-summary-card">
          <div className="dp-card-header">
            <span className="dp-card-title">Converted Leads</span>
            <div className="dp-card-icon orange"><Target size={20} /></div>
          </div>
          <div className="dp-card-value">{totalConvertedLeads}</div>
          <div className="dp-card-footer positive">Closed deals</div>
          <div className="dp-card-bottom-accent orange"></div>
        </div>
      </div>

      {/* Performance Overview (Show top 3 or 4) */}
      <div>
        <h2 className="dp-section-title">Dealer Performance</h2>
        <div className="dp-perf-grid">
          {dealers.slice(0, 3).map(dlr => {
            const stats = getDealerStats(dlr.name);
            return (
              <div key={dlr.id} className="dp-perf-card">
                <div className="dp-perf-header">
                  <div className="dp-perf-dlr">
                    <div className="dp-avatar">{dlr.initials}</div>
                    <div>
                      <h3 className="dp-dlr-name">{dlr.name}</h3>
                      <p className="dp-dlr-id">{dlr.id}</p>
                    </div>
                  </div>
                </div>

                <div className="dp-perf-stats">
                  <div className="dp-stat-item">
                    <span className="dp-stat-val">{stats.assigned}</span>
                    <span className="dp-stat-lbl">Leads</span>
                  </div>
                  <div className="dp-stat-item">
                    <span className="dp-stat-val">{stats.converted}</span>
                    <span className="dp-stat-lbl">Converted</span>
                  </div>
                </div>

                <div className="dp-perf-rate">
                  <div className="dp-rate-lbl">
                    <span>Conversion Rate</span>
                    <span style={{ color: 'var(--color-navy)' }}>{stats.conversionRate}%</span>
                  </div>
                  <div className="dp-rate-bar-container">
                    <div className="dp-rate-bar" style={{ width: `${stats.conversionRate}%` }}></div>
                  </div>
                </div>

                <div className="dp-perf-emps">
                  <strong>Employees:</strong> {stats.emps.slice(0, 2).join(', ')}{stats.emps.length > 2 ? '...' : ''}
                </div>

                <div className="dp-perf-footer">
                  <span></span>
                  <span className="dp-view-link" onClick={() => setSelectedDealer(dlr)}>
                    View Details <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Directory Table */}
      <div className="dp-directory-panel">
        <div className="dp-dir-header">
          <h2 className="dp-section-title" style={{ margin: 0 }}>Dealer Directory</h2>
          <div className="dp-dir-filters">
            <div className="dp-search">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search dealers..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="dp-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select className="dp-select" value={perfFilter} onChange={e => setPerfFilter(e.target.value)}>
              <option value="All">All Performance</option>
              <option value="High">High (&gt;50%)</option>
              <option value="Medium">Medium (25-50%)</option>
              <option value="Low">Low (&lt;25%)</option>
            </select>
          </div>
        </div>

        <div className="dp-table-container">
          <table className="dp-table">
            <thead>
              <tr>
                <th>Dealer</th>
                <th>Status</th>
                <th>Total Leads</th>
                <th>Active</th>
                <th>Converted</th>
                <th>Conversion</th>
                <th>Employees</th>
                <th>Last Activity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDealers.map(dlr => {
                const stats = getDealerStats(dlr.name);
                return (
                  <tr key={dlr.id}>
                    <td data-label="Dealer">
                      <div className="dp-table-dlr">
                        <div className="dp-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
                          {dlr.initials}
                        </div>
                        <div className="dp-table-dlr-info">
                          <span className="dp-table-dlr-name">{dlr.name}</span>
                          <span className="dp-table-dlr-id">{dlr.id}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Status">
                      <div className={`dp-status-pill ${dlr.status.toLowerCase()}`}>
                        <div className="status-dot"></div>
                        {dlr.status}
                      </div>
                    </td>
                    <td data-label="Total Leads"><span className="dp-table-stat">{stats.assigned}</span></td>
                    <td data-label="Active"><span className="dp-table-stat">{stats.active}</span></td>
                    <td data-label="Converted"><span className="dp-table-stat">{stats.converted}</span></td>
                    <td data-label="Conversion">
                      <div style={{ color: stats.conversionRate >= 50 ? '#16a34a' : (stats.conversionRate >= 25 ? '#d97706' : '#dc2626'), fontWeight: 700 }}>
                        {stats.conversionRate}%
                      </div>
                    </td>
                    <td data-label="Employees">
                      <div className="dp-table-emps">
                        {stats.emps.slice(0, 2).map(e => <span key={e} className="dp-emp-chip">{e.substring(0, 2).toUpperCase()}</span>)}
                        {stats.emps.length > 2 && <span className="dp-emp-chip">+{stats.emps.length - 2}</span>}
                      </div>
                    </td>
                    <td data-label="Last Activity" style={{ color: '#64748b', fontSize: '0.85rem' }}>{dlr.lastActive}</td>
                    <td data-label="Action">
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="dp-action-btn" onClick={() => setSelectedDealer(dlr)}>
                          View <ChevronRight size={14} />
                        </button>
                        <div style={{ position: 'relative' }}>
                          {/* simple ellipsis menu mock for edit/deactivate, we can just use buttons for now for simplicity */}
                          <button className="dp-action-btn" style={{ padding: '6px' }} onClick={() => openEditModal(dlr)}>
                            Edit
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredDealers.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No dealers found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dealer Detail Slide Panel */}
      {selectedDealer && (
        <div className="dp-detail-overlay" onClick={() => setSelectedDealer(null)}>
          <div className="dp-detail-panel" onClick={e => e.stopPropagation()}>
            <div className="dp-detail-header">
              <h2>Dealer Details</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="dp-btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => openEditModal(selectedDealer)}>Edit</button>
                {selectedDealer.status === 'Active' && (
                  <button className="dp-btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeactivate(selectedDealer)}>Deactivate</button>
                )}
                <button className="dp-close-btn" onClick={() => setSelectedDealer(null)}><X size={20} /></button>
              </div>
            </div>
            
            <div className="dp-detail-content">
              {(() => {
                const stats = getDealerStats(selectedDealer.name);
                return (
                  <>
                    <div className="dp-detail-profile">
                      <div className="dp-avatar">{selectedDealer.initials}</div>
                      <div className="dp-detail-info">
                        <h3>{selectedDealer.name}</h3>
                        <p>{selectedDealer.id} • {selectedDealer.phone}</p>
                        <div className={`dp-status-pill ${selectedDealer.status.toLowerCase()}`}>
                          <div className="status-dot"></div>
                          {selectedDealer.status}
                        </div>
                      </div>
                    </div>

                    <div className="dp-detail-metrics">
                      <div className="dp-metric-box">
                        <span className="val">{stats.assigned}</span>
                        <span className="lbl">Total Leads</span>
                      </div>
                      <div className="dp-metric-box">
                        <span className="val">{stats.converted}</span>
                        <span className="lbl">Converted</span>
                      </div>
                      <div className="dp-metric-box">
                        <span className="val">{stats.conversionRate}%</span>
                        <span className="lbl">Conversion Rate</span>
                      </div>
                      <div className="dp-metric-box">
                        <span className="val">{stats.avgFollowUp}d</span>
                        <span className="lbl">Avg Follow-up</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="dp-section-subtitle">Current Pipeline</h4>
                      <div className="dp-pipeline">
                        {STAGES.map((stage, i) => {
                          const count = stats.stageCounts[stage];
                          const pct = stats.assigned > 0 ? (count / stats.assigned) * 100 : 0;
                          const colors = ['#0B1F3A', '#16a34a', '#d97706', '#f59e0b', '#3b82f6', '#8b5cf6'];
                          return (
                            <div key={stage} className="dp-pipe-row">
                              <span className="dp-pipe-lbl">{stage}</span>
                              <div className="dp-pipe-bar-container">
                                <div className="dp-pipe-bar" style={{ width: `${pct}%`, background: colors[i] }}></div>
                              </div>
                              <span className="dp-pipe-val">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="dp-section-subtitle">Assigned Employees</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.emps.length > 0 ? stats.emps.map(emp => {
                          const empLeads = stats.dlrLeads.filter(l => l.assignedEmployee === emp).length;
                          return (
                            <div key={emp} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="dp-avatar" style={{ width: '24px', height: '24px', fontSize: '0.6rem' }}>{emp.substring(0, 2).toUpperCase()}</div>
                                <span style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.9rem' }}>{emp}</span>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{empLeads} leads</span>
                            </div>
                          );
                        }) : <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No employees assigned yet.</span>}
                      </div>
                    </div>

                    <div>
                      <h4 className="dp-section-subtitle">Recent Dealer Leads</h4>
                      <div className="dp-work-list">
                        {stats.dlrLeads.slice(0, 3).map(lead => (
                          <div key={lead.id} className="dp-work-item">
                            <div className="dp-work-item-info">
                              <strong>{lead.customer}</strong>
                              <span>{lead.assignedEmployee} • {lead.updatedAt}</span>
                            </div>
                            <span className="dp-work-item-stage">{lead.stage}</span>
                          </div>
                        ))}
                        {stats.dlrLeads.length > 3 && (
                          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                            + {stats.dlrLeads.length - 3} more leads
                          </div>
                        )}
                        {stats.dlrLeads.length === 0 && (
                          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                            No leads found.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="dp-section-subtitle">Recent Activity</h4>
                      <div className="dp-activity-list">
                        {activities.filter(a => a.message.includes(selectedDealer.name)).slice(0, 3).map(act => (
                          <div className="dp-activity-item" key={act.id}>
                            <div className="dp-activity-dot"></div>
                            <div className="dp-activity-content">
                              <p>{act.message}</p>
                              <span>{act.createdAt}</span>
                            </div>
                          </div>
                        ))}
                        {activities.filter(a => a.message.includes(selectedDealer.name)).length === 0 && (
                          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No recent activity.</div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add Dealer Modal */}
      {isAddModalOpen && (
        <div className="dp-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="dp-modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: 0, color: 'var(--color-navy)', fontSize: '1.25rem', fontWeight: 800 }}>Add Dealer</h2>
            <form onSubmit={handleAddDealer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="dp-form-group">
                <label>Dealer Name</label>
                <input required type="text" placeholder="e.g. Sri Solar Dealers" value={newDlr.name} onChange={e => setNewDlr({...newDlr, name: e.target.value})} />
              </div>
              <div className="dp-form-group">
                <label>Phone Number</label>
                <input type="text" placeholder="+91" value={newDlr.phone} onChange={e => setNewDlr({...newDlr, phone: e.target.value})} />
              </div>
              <div className="dp-form-group">
                <label>Email</label>
                <input type="email" placeholder="contact@domain.com" value={newDlr.email} onChange={e => setNewDlr({...newDlr, email: e.target.value})} />
              </div>
              <div className="dp-form-group">
                <label>Location / Address</label>
                <input type="text" placeholder="e.g. Hyderabad, TS" value={newDlr.address} onChange={e => setNewDlr({...newDlr, address: e.target.value})} />
              </div>
              <div className="dp-form-group">
                <label>Status</label>
                <select value={newDlr.status} onChange={e => setNewDlr({...newDlr, status: e.target.value})}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="dp-modal-actions">
                <button type="button" className="dp-btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="dp-btn-primary">Add Dealer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dealer Modal */}
      {isEditModalOpen && (
        <div className="dp-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="dp-modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: 0, color: 'var(--color-navy)', fontSize: '1.25rem', fontWeight: 800 }}>Edit Dealer</h2>
            <form onSubmit={handleEditDealer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="dp-form-group">
                <label>Dealer Name</label>
                <input required type="text" value={editDealerData.name || ''} onChange={e => setEditDealerData({...editDealerData, name: e.target.value})} />
              </div>
              <div className="dp-form-group">
                <label>Phone Number</label>
                <input type="text" value={editDealerData.phone || ''} onChange={e => setEditDealerData({...editDealerData, phone: e.target.value})} />
              </div>
              <div className="dp-form-group">
                <label>Email</label>
                <input type="email" value={editDealerData.email || ''} onChange={e => setEditDealerData({...editDealerData, email: e.target.value})} />
              </div>
              <div className="dp-form-group">
                <label>Location / Address</label>
                <input type="text" value={editDealerData.address || ''} onChange={e => setEditDealerData({...editDealerData, address: e.target.value})} />
              </div>
              <div className="dp-form-group">
                <label>Status</label>
                <select value={editDealerData.status || 'Active'} onChange={e => setEditDealerData({...editDealerData, status: e.target.value as 'Active'|'Inactive'})}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="dp-modal-actions">
                <button type="button" className="dp-btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="dp-btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
