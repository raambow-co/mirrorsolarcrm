import { useMemo } from 'react';
import { 
  Users, Target, TrendingUp, AlertCircle, PhoneCall, 
  Plus, Box, Package, Activity as ActivityIcon, ShoppingCart, 
  UsersRound, Briefcase, CheckSquare, Calendar, CreditCard, Truck
} from 'lucide-react';
import { useCRM, STAGES } from '../context/CRMContext';
import { useStock } from '../context/StockContext';
import { canAccessRoute } from '../utils/permissionCalculations';
import { 
  getDealerPerformance, getDealerPipeline, getDealerFollowUpsRaw, 
  getDealerOverdueFollowUps, getDealerEmployees, getDealerActivity, 
  getDealerLeads, getDealerLeadOverview
} from '../utils/dealerCalculations';
import './DealerDashboard.css';

interface DealerDashboardProps {
  onNavigate: (path: string, filters?: any) => void;
}

export default function DealerDashboard({ onNavigate }: DealerDashboardProps) {
  const { currentUser, leads, employees, activities, tasks } = useCRM();
  const { stockItems, stockRequests, getDealerPendingDispatchesCount } = useStock();

  // Fallback to avoid crashes if somehow not logged in
  const dealerName = currentUser?.name || 'Dealer';
  const pendingDispatchesCount = getDealerPendingDispatchesCount(dealerName);

  // Derived Data
  const performance = useMemo(() => getDealerPerformance(dealerName, leads), [dealerName, leads]);
  const pipeline = useMemo(() => getDealerPipeline(dealerName, leads), [dealerName, leads]);
  const rawFollowUps = useMemo(() => getDealerFollowUpsRaw(dealerName, leads), [dealerName, leads]);
  const overdueFollowUps = useMemo(() => getDealerOverdueFollowUps(dealerName, leads), [dealerName, leads]);
  const todayFollowUps = useMemo(() => rawFollowUps.filter(f => f.status === 'Due Today'), [rawFollowUps]);
  const overview = useMemo(() => getDealerLeadOverview(dealerName, leads), [dealerName, leads]);
  
  const myEmployees = useMemo(() => getDealerEmployees(dealerName, leads, employees), [dealerName, leads, employees]);
  const myActivity = useMemo(() => getDealerActivity(dealerName, activities).slice(0, 5), [dealerName, activities]);
  const myLeads = useMemo(() => getDealerLeads(dealerName, leads), [dealerName, leads]);
  
  const recentlyAssigned = useMemo(() => {
    return [...myLeads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);
  }, [myLeads]);

  const myStockRequests = useMemo(() => {
    return stockRequests.filter(r => r.dealer === dealerName).sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime()).slice(0, 3);
  }, [dealerName, stockRequests]);

  // Read-only stock snapshot (fast movers)
  const stockSnapshot = useMemo(() => {
    return stockItems.slice(0, 3);
  }, [stockItems]);

  const getPriorityClass = (priority: string) => {
    switch(priority) {
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      case 'Low': return 'priority-low';
      default: return '';
    }
  };

  const getRequestStatusClass = (status: string) => {
    switch(status) {
      case 'Approved': return 'success';
      case 'Partially Approved': return 'success';
      case 'Completed': return 'success';
      case 'Pending': return 'pending';
      case 'Rejected': return 'danger';
      default: return 'warning';
    }
  };

  return (
    <div className="dealer-dashboard fade-in">
      {/* Header */}
      <div className="dlr-dash-header">
        <div className="dlr-welcome">
          <h1>Good Morning, {currentUser?.name || 'Dealer'}</h1>
          <p>Here's an overview of your business today.</p>
        </div>
      </div>

      {/* ⚠️ PENDING DISPATCH NOTIFICATION */}
      {pendingDispatchesCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1.5px solid #fde68a',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.08)'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <div style={{width: '44px', height: '44px', borderRadius: '10px', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff'}}>
              <Truck size={24} />
            </div>
            <div>
              <div style={{fontSize: '1rem', fontWeight: 800, color: '#92400e'}}>
                {pendingDispatchesCount} Incoming Stock Dispatch{pendingDispatchesCount > 1 ? 'es' : ''} from Admin
              </div>
              <div style={{fontSize: '0.85rem', color: '#b45309', marginTop: '2px'}}>
                Admin has dispatched solar materials. Please inspect and confirm receipt to add them to your active stock.
              </div>
            </div>
          </div>
          <button 
            className="lp-btn-primary" 
            onClick={() => onNavigate('/dealer/stock')}
            style={{background: '#d97706', borderColor: '#d97706', color: '#ffffff', fontWeight: 700, padding: '0.6rem 1.25rem', whiteSpace: 'nowrap'}}
          >
            Review & Accept Stock →
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="dlr-grid-4">
        <div className="dlr-summary-card" onClick={() => onNavigate('/dealer/leads')}>
          <div className="dlr-summary-title">Total Leads</div>
          <div className="dlr-summary-value">{performance.totalLeads}</div>
        </div>
        <div className="dlr-summary-card" onClick={() => onNavigate('/dealer/leads', { status: 'Active' })}>
          <div className="dlr-summary-title">Active Leads</div>
          <div className="dlr-summary-value" style={{color: '#d97706'}}>{performance.activeLeads}</div>
        </div>
        <div className="dlr-summary-card" onClick={() => onNavigate('/dealer/leads', { stage: 'Converted' })}>
          <div className="dlr-summary-title">Converted</div>
          <div className="dlr-summary-value" style={{color: '#16a34a'}}>{performance.convertedLeads}</div>
        </div>
        <div className="dlr-summary-card" onClick={() => onNavigate('/dealer/followups', { filter: 'Today' })}>
          <div className="dlr-summary-title">Follow-ups Today</div>
          <div className="dlr-summary-value" style={{color: '#ea580c'}}>{todayFollowUps.length}</div>
        </div>
      </div>

      {/* Pipeline & Follow-ups */}
      <div className="dlr-grid-2">
        <div className="dlr-panel">
          <h2><Target size={18} /> My Lead Pipeline</h2>
          <div className="dlr-pipeline-container">
            {STAGES.map(stage => (
              <div 
                key={stage} 
                className="dlr-pipeline-stage"
                onClick={() => onNavigate('/dealer/leads', { stage })}
              >
                <div className="dlr-stage-count">{pipeline[stage]}</div>
                <div className="dlr-stage-name">{stage}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="dlr-panel">
          <h2><PhoneCall size={18} /> Today's Follow-ups</h2>
          <div className="dlr-list">
            {todayFollowUps.length > 0 ? todayFollowUps.slice(0, 3).map(f => (
              <div key={f.lead.id} className="dlr-list-item">
                <div className="dlr-list-info">
                  <span className="dlr-list-name">{f.lead.customer}</span>
                  <span className="dlr-list-meta">
                    <span className={getPriorityClass(f.lead.priority)}>{f.lead.priority} Priority</span>
                    • {f.lead.assignedEmployee} • {f.time}
                  </span>
                </div>
                <button className="btn-outline" onClick={() => onNavigate('/dealer/followups')} style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem'}}>View</button>
              </div>
            )) : (
              <div className="dlr-empty-state" style={{padding: '1.5rem'}}>
                <PhoneCall size={32} />
                <h3>You're all caught up.</h3>
              </div>
            )}
            {todayFollowUps.length > 3 && (
              <button className="btn-outline" onClick={() => onNavigate('/dealer/followups')}>View all {todayFollowUps.length}</button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div style={{marginBottom: '1.5rem'}}>
        <div className="dlr-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h2 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><CheckSquare size={18} color="#0284c7" /> Today's Tasks</h2>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button className="btn-outline" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => onNavigate('/dealer/calendar')}>
                <Calendar size={14} style={{marginRight: '0.25rem'}} /> Calendar
              </button>
              <button className="btn-primary" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => onNavigate('/dealer/tasks')}>
                View All
              </button>
            </div>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const activeTasks = tasks.filter(t => 
                (t.assignedToUserId === currentUser?.id || t.createdByUserId === currentUser?.id) && 
                t.dueDate <= today && 
                t.status !== 'Completed'
              );
              
              const activeFollowups = leads
                .filter(l => l.dealer === currentUser?.name && l.followUp && !l.archived && (l.followUp.status === 'Due Today' || l.followUp.status === 'Overdue'))
                .map(l => ({
                  id: `FU-${l.id}`,
                  title: `Follow-up: ${l.customer}`,
                  priority: l.priority,
                  leadId: l.id,
                  status: l.followUp.status,
                  dueTime: l.followUp.time,
                  type: 'Followups'
                }));

              const documentRequests = leads
                .filter(l => l.dealer === currentUser?.name && !l.archived)
                .flatMap(l => (l.documents || []).filter(d => d.status === 'Additional Document Required').map(d => ({
                  id: `DOC-${d.id}`,
                  title: `Required: ${d.documentType}`,
                  priority: 'High' as const,
                  leadId: l.id,
                  status: 'Pending',
                  dueTime: 'ASAP',
                  type: 'Leads'
                })));

              const mappedTasks = activeTasks.map(t => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
                leadId: t.leadId,
                status: t.status,
                dueTime: t.dueTime,
                type: 'Tasks'
              }));

              const combined = [...documentRequests, ...mappedTasks, ...activeFollowups].slice(0, 5);

              if (combined.length === 0) {
                return (
                  <div style={{padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1'}}>
                    No pending tasks or follow-ups for today.
                  </div>
                );
              }

              return combined.map(item => (
                <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer'}} onClick={() => onNavigate(`/dealer/${item.type.toLowerCase()}`)}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                    <div style={{width: '8px', height: '8px', borderRadius: '50%', background: item.priority === 'High' ? '#ef4444' : item.priority === 'Medium' ? '#f59e0b' : '#3b82f6'}}></div>
                    <div>
                      <div style={{fontWeight: 600, color: '#1e293b', fontSize: '0.9rem'}}>{item.title}</div>
                      {item.leadId && <div style={{fontSize: '0.75rem', color: '#64748b'}}>Related: {leads.find(l => l.id === item.leadId)?.customer || 'Unknown'}</div>}
                    </div>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                    <span className={`stage-badge ${(item.status === 'Overdue' || item.id.startsWith('DOC-')) ? 'rejected' : 'lead'}`} style={(item.status === 'Overdue' || item.id.startsWith('DOC-')) ? {background: '#fee2e2', color: '#dc2626'} : {}}>{item.id.startsWith('DOC-') ? 'Upload' : item.status}</span>
                    <span style={{fontSize: '0.8rem', color: '#64748b'}}>{item.dueTime || 'Any time'}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Recent Leads & Needs Attention */}
      <div className="dlr-grid-2">
        <div className="dlr-panel">
          <h2><Users size={18} /> Recent Leads</h2>
          <div className="dlr-list">
            {recentlyAssigned.length > 0 ? recentlyAssigned.map(l => (
              <div key={l.id} className="dlr-list-item">
                <div className="dlr-list-info">
                  <span className="dlr-list-name">{l.customer}</span>
                  <span className="dlr-list-meta">
                    {l.stage} • {l.assignedEmployee} • {l.updatedAt}
                  </span>
                </div>
                <button className="btn-outline" onClick={() => onNavigate('/dealer/leads')} style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem'}}>View</button>
              </div>
            )) : (
              <div className="dlr-empty-state" style={{padding: '1.5rem'}}>
                <Users size={32} />
                <h3>No leads yet.</h3>
              </div>
            )}
          </div>
        </div>

        <div className="dlr-panel" style={{borderColor: overdueFollowUps.length > 0 ? '#fed7aa' : undefined}}>
          <h2><AlertCircle size={18} /> Needs Attention</h2>
          <div className="dlr-list">
            {overdueFollowUps.length > 0 ? overdueFollowUps.map(f => (
              <div key={f.lead.id} className="dlr-list-item warning">
                <div className="dlr-list-info">
                  <span className="dlr-list-name">{f.lead.customer}</span>
                  <span className="dlr-list-meta" style={{color: '#9a3412', fontWeight: 600}}>
                    Overdue • {f.lead.assignedEmployee}
                  </span>
                </div>
                <button className="btn-action" onClick={() => onNavigate('/dealer/followups')}>View →</button>
              </div>
            )) : (
              <div className="dlr-empty-state" style={{padding: '1.5rem'}}>
                <AlertCircle size={32} />
                <h3>No overdue follow-ups.</h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Business Performance & Lead Overview */}
      <div className="dlr-grid-2">
        <div className="dlr-panel">
          <h2><TrendingUp size={18} /> Business Performance</h2>
          <div style={{display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap'}}>
            <div style={{flex: 1, minWidth: '150px', padding: '2rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center'}}>
              <div style={{fontSize: '3rem', fontWeight: 800, color: 'var(--color-navy)'}}>{performance.conversionRate}%</div>
              <div style={{fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>Conversion Rate</div>
            </div>
            <div style={{flex: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', minWidth: '250px'}}>
              <div style={{padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '8px'}}>
                <div style={{color: '#64748b', fontWeight: 600, fontSize: '0.85rem'}}>Total Leads</div>
                <div style={{fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-navy)'}}>{performance.totalLeads}</div>
              </div>
              <div style={{padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '8px'}}>
                <div style={{color: '#64748b', fontWeight: 600, fontSize: '0.85rem'}}>Converted</div>
                <div style={{fontWeight: 800, fontSize: '1.5rem', color: '#16a34a'}}>{performance.convertedLeads}</div>
              </div>
              <div style={{padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '8px'}}>
                <div style={{color: '#64748b', fontWeight: 600, fontSize: '0.85rem'}}>Active Leads</div>
                <div style={{fontWeight: 800, fontSize: '1.5rem', color: '#ea580c'}}>{performance.activeLeads}</div>
              </div>
              <div style={{padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '8px'}}>
                <div style={{color: '#64748b', fontWeight: 600, fontSize: '0.85rem'}}>Stock Requests</div>
                <div style={{fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-navy)'}}>{stockRequests.filter(r => r.dealer === dealerName).length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="dlr-panel">
          <h2><Briefcase size={18} /> Lead Overview</h2>
          <div className="dlr-list">
            <div className="dlr-list-item">
              <span className="dlr-list-name" style={{fontSize: '0.9rem'}}>New</span>
              <span style={{fontWeight: 800}}>{overview['New']}</span>
            </div>
            <div className="dlr-list-item">
              <span className="dlr-list-name" style={{fontSize: '0.9rem'}}>In Progress</span>
              <span style={{fontWeight: 800}}>{overview['In Progress']}</span>
            </div>
            <div className="dlr-list-item">
              <span className="dlr-list-name" style={{fontSize: '0.9rem'}}>Converted</span>
              <span style={{fontWeight: 800}}>{overview['Converted']}</span>
            </div>
            <div className="dlr-list-item">
              <span className="dlr-list-name" style={{fontSize: '0.9rem'}}>Lost</span>
              <span style={{fontWeight: 800}}>{overview['Lost']}</span>
            </div>
          </div>
        </div>
      </div>

      {/* My Team & Stock */}
      <div className="dlr-grid-half">
        <div className="dlr-panel">
          <h2><UsersRound size={18} /> My Team</h2>
          <div className="dlr-list">
            {myEmployees.length > 0 ? myEmployees.slice(0, 3).map(e => (
              <div key={e.name} className="dlr-list-item">
                <div className="dlr-list-info">
                  <span className="dlr-list-name">{e.name}</span>
                  <span className="dlr-list-meta">{e.totalLeads} Leads • {e.convertedLeads} Converted</span>
                </div>
                <span className="dlr-badge success">{e.totalLeads > 0 ? Math.round((e.convertedLeads / e.totalLeads) * 100) : 0}% Conv</span>
              </div>
            )) : (
              <div className="dlr-empty-state" style={{padding: '1.5rem'}}>
                <UsersRound size={32} />
                <h3>No employees assigned.</h3>
              </div>
            )}
          </div>
        </div>

        {canAccessRoute(currentUser, 'Stock') && (
          <div className="dlr-panel">
            <h2><Package size={18} /> Stock Availability</h2>
            <div className="dlr-list">
              {stockSnapshot.map((item: any) => (
                <div key={item.id} className="dlr-list-item">
                  <div className="dlr-list-info">
                    <span className="dlr-list-name">{item.name}</span>
                    <span className="dlr-list-meta">Available: {item.totalQuantity - item.reservedQuantity}</span>
                  </div>
                  <span className={`dlr-badge ${item.status === 'Healthy' || item.status === 'Moderate' ? 'success' : 'warning'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stock Requests, Activity & Quick Actions */}
      <div className="dlr-grid-4" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'}}>
        {canAccessRoute(currentUser, 'Stock') && (
          <div className="dlr-panel">
            <h2><ShoppingCart size={18} /> My Stock Requests</h2>
            <div className="dlr-list">
              {myStockRequests.length > 0 ? myStockRequests.map(r => (
                <div key={r.id} className="dlr-list-item">
                  <div className="dlr-list-info">
                    <span className="dlr-list-name" style={{fontSize: '0.9rem'}}>{r.id} • {r.itemSku}</span>
                    <span className="dlr-list-meta">Qty: {r.requestedQty} • {r.requestedDate}</span>
                  </div>
                  <span className={`dlr-badge ${getRequestStatusClass(r.status)}`}>{r.status}</span>
                </div>
              )) : (
                <div className="dlr-empty-state" style={{padding: '1.5rem'}}>
                  <ShoppingCart size={32} />
                  <h3>No stock requests yet.</h3>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="dlr-panel" style={!canAccessRoute(currentUser, 'Stock') ? {gridColumn: '1 / -1'} : {}}>
          <h2><ActivityIcon size={18} /> Recent Activity</h2>
          <div className="dlr-timeline">
            {myActivity.length > 0 ? myActivity.map(a => (
              <div key={a.id} className="dlr-timeline-item">
                <div className="dlr-timeline-dot"></div>
                <div className="dlr-timeline-content">
                  <span className="dlr-timeline-title">{a.message}</span>
                  <span className="dlr-timeline-time">{new Date(a.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            )) : (
              <div className="dlr-empty-state" style={{padding: '1.5rem'}}>
                <ActivityIcon size={32} />
                <h3>No recent activity.</h3>
              </div>
            )}
          </div>
        </div>

        <div className="dlr-panel" style={{gridColumn: '1 / -1'}}>
          <h2><Box size={18} /> Quick Actions</h2>
          <div className="dlr-quick-actions" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
            <button className="dlr-action-btn primary" onClick={() => onNavigate('/dealer/leads', { action: 'add' })}>
              <Plus size={24} />
              Add Lead
            </button>
            {canAccessRoute(currentUser, 'Stock') && (
              <button className="dlr-action-btn" onClick={() => onNavigate('/dealer/stock', { action: 'request' })}>
                <Package size={24} />
                Request Stock
              </button>
            )}
            <button className="dlr-action-btn" onClick={() => onNavigate('/dealer/leads')}>
              <Users size={24} />
              View Leads
            </button>
            <button className="dlr-action-btn" onClick={() => onNavigate('/dealer/payments')}>
              <CreditCard size={24} />
              View Payments
            </button>
            <button className="dlr-action-btn" onClick={() => onNavigate('/dealer/followups')}>
              <PhoneCall size={24} />
              View Follow-ups
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
