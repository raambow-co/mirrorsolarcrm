import { useMemo, useState } from 'react';
import { 
  Users, Target, TrendingUp, AlertCircle, PhoneCall, 
  CheckCircle2, Plus, Box, Package, Activity as ActivityIcon,
  CheckSquare, Calendar
} from 'lucide-react';
import { useCRM, STAGES } from '../context/CRMContext';
import { useStock } from '../context/StockContext';
import { useUI } from '../context/UIContext';
import { canAccessRoute } from '../utils/permissionCalculations';
import { 
  getMyPerformance, getMyPipeline, getMyFollowUpsRaw, 
  getMyOverdueFollowUps, getMyDealers, getMyActivity, getMyLeads
} from '../utils/employeeCalculations';
import './EmployeeDashboard.css';

interface EmployeeDashboardProps {
  onNavigate: (path: string, filters?: any) => void;
}

export default function EmployeeDashboard({ onNavigate }: EmployeeDashboardProps) {
  const { currentUser, leads, dealers, activities, tasks, addActivity, updateLead } = useCRM();
  const { stockItems } = useStock();
  const { showToast, showConfirmModal } = useUI();

  const [isUpdatingFollowUp, setIsUpdatingFollowUp] = useState(false);

  // Fallback to avoid crashes if somehow not logged in
  const userName = currentUser?.name || 'Employee';

  // Derived Data
  const performance = useMemo(() => getMyPerformance(userName, leads), [userName, leads]);
  const pipeline = useMemo(() => getMyPipeline(userName, leads), [userName, leads]);
  const rawFollowUps = useMemo(() => getMyFollowUpsRaw(userName, leads), [userName, leads]);
  const overdueFollowUps = useMemo(() => getMyOverdueFollowUps(userName, leads), [userName, leads]);
  const todayFollowUps = useMemo(() => rawFollowUps.filter(f => f.status === 'Due Today'), [rawFollowUps]);
  
  const myDealers = useMemo(() => getMyDealers(userName, leads, dealers), [userName, leads, dealers]);
  const myActivity = useMemo(() => getMyActivity(userName, activities).slice(0, 5), [userName, activities]);
  const myLeads = useMemo(() => getMyLeads(userName, leads), [userName, leads]);
  const assignedProjects = useMemo(() => myLeads.filter(l => l.leadType === 'project').length, [myLeads]);
  
  // Read-only stock snapshot (fast movers)
  const stockSnapshot = useMemo(() => {
    return stockItems.slice(0, 3);
  }, [stockItems]);

  // Handlers
  const handleCompleteFollowUp = (leadId: string, customer: string) => {
    showConfirmModal(
      'Complete Follow-up?',
      `Mark follow-up complete for ${customer}?`,
      () => {
        setIsUpdatingFollowUp(true);
        // Add artificial delay to feel real
        setTimeout(() => {
          const currentLead = leads.find(l => l.id === leadId);
          if (currentLead && currentLead.followUp) {
            updateLead(leadId, { followUp: { ...currentLead.followUp, status: 'Completed' } });
          }
          addActivity({
            type: 'Follow-up Completed',
            message: `Completed follow-up for ${customer}`,
            user: userName,
            employee: userName,
            leadId
          });
          showToast('Follow-up completed successfully', 'success');
          setIsUpdatingFollowUp(false);
        }, 300);
      }
    );
  };

  const getPriorityClass = (priority: string) => {
    switch(priority) {
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      case 'Low': return 'priority-low';
      default: return '';
    }
  };

  return (
    <div className="employee-dashboard fade-in">
      {/* Header */}
      <div className="emp-dash-header">
        <div className="emp-welcome">
          <h1>Good Morning, {currentUser?.name?.split(' ')[0] || 'Employee'}</h1>
          <p>Here's what needs your attention today.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="emp-grid-4">
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads')}>
          <div className="emp-summary-title">My Leads</div>
          <div className="emp-summary-value">{performance.totalLeads}</div>
        </div>
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { status: 'Active' })}>
          <div className="emp-summary-title">Active</div>
          <div className="emp-summary-value" style={{color: '#d97706'}}>{performance.activeLeads}</div>
        </div>
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/followups', { filter: 'Today' })}>
          <div className="emp-summary-title">Follow-ups Today</div>
          <div className="emp-summary-value" style={{color: '#ea580c'}}>{todayFollowUps.length}</div>
        </div>
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { stage: 'Converted' })}>
          <div className="emp-summary-title">Converted</div>
          <div className="emp-summary-value" style={{color: '#16a34a'}}>{performance.convertedLeads}</div>
        </div>
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { filter: 'Project' })}>
          <div className="emp-summary-title">Assigned Projects</div>
          <div className="emp-summary-value" style={{color: '#4f46e5'}}>{assignedProjects}</div>
        </div>
      </div>

      {/* Pipeline & Follow-ups */}
      <div className="emp-grid-2">
        <div className="emp-panel">
          <h2><Target size={18} /> My Lead Pipeline</h2>
          <div className="emp-pipeline-container">
            {STAGES.map(stage => (
              <div 
                key={stage} 
                className="emp-pipeline-stage"
                onClick={() => onNavigate('/employee/leads', { stage })}
              >
                <div className="emp-stage-count">{pipeline[stage]}</div>
                <div className="emp-stage-name">{stage}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="emp-panel">
          <h2><PhoneCall size={18} /> Today's Follow-ups</h2>
          <div className="emp-list">
            {todayFollowUps.length > 0 ? todayFollowUps.slice(0, 3).map(f => (
              <div key={f.lead.id} className="emp-list-item">
                <div className="emp-list-info">
                  <span className="emp-list-name">{f.lead.customer}</span>
                  <span className="emp-list-meta">
                    <span className={getPriorityClass(f.lead.priority)}>{f.lead.priority} Priority</span>
                    • {f.time} • {f.type}
                  </span>
                </div>
                <button 
                  className="btn-outline" 
                  style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem'}}
                  onClick={() => handleCompleteFollowUp(f.lead.id, f.lead.customer)}
                  disabled={isUpdatingFollowUp}
                >
                  <CheckCircle2 size={14} style={{marginRight: '0.25rem'}} /> Complete
                </button>
              </div>
            )) : (
              <div className="emp-empty-state" style={{padding: '1.5rem'}}>
                <CheckCircle2 size={32} />
                <h3>You're all caught up.</h3>
              </div>
            )}
            {todayFollowUps.length > 3 && (
              <button className="btn-outline" onClick={() => onNavigate('/employee/followups')}>View all {todayFollowUps.length}</button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div style={{marginBottom: '1.5rem'}}>
        <div className="emp-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h2 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><CheckSquare size={18} color="#0284c7" /> Today's Tasks</h2>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button className="btn-outline" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => onNavigate('/employee/calendar')}>
                <Calendar size={14} style={{marginRight: '0.25rem'}} /> Calendar
              </button>
              <button className="btn-primary" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => onNavigate('/employee/tasks')}>
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
                .filter(l => l.assignedEmployee === currentUser?.name && l.followUp && !l.archived && (l.followUp.status === 'Due Today' || l.followUp.status === 'Overdue'))
                .map(l => ({
                  id: `FU-${l.id}`,
                  title: `Follow-up: ${l.customer}`,
                  priority: l.priority,
                  leadId: l.id,
                  status: l.followUp.status,
                  dueTime: l.followUp.time,
                  type: 'Followups'
                }));

              const mappedTasks = activeTasks.map(t => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
                leadId: t.leadId,
                status: t.status,
                dueTime: t.dueTime,
                type: 'Tasks'
              }));

              const combined = [...mappedTasks, ...activeFollowups].slice(0, 5);

              if (combined.length === 0) {
                return (
                  <div style={{padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1'}}>
                    No pending tasks or follow-ups for today.
                  </div>
                );
              }

              return combined.map(item => (
                <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer'}} onClick={() => onNavigate(`/employee/${item.type.toLowerCase()}`)}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                    <div style={{width: '8px', height: '8px', borderRadius: '50%', background: item.priority === 'High' ? '#ef4444' : item.priority === 'Medium' ? '#f59e0b' : '#3b82f6'}}></div>
                    <div>
                      <div style={{fontWeight: 600, color: '#1e293b', fontSize: '0.9rem'}}>{item.title}</div>
                      {item.leadId && <div style={{fontSize: '0.75rem', color: '#64748b'}}>Related: {leads.find(l => l.id === item.leadId)?.customer || 'Unknown'}</div>}
                    </div>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                    <span className={`stage-badge ${item.status === 'Overdue' ? 'rejected' : 'lead'}`} style={item.status === 'Overdue' ? {background: '#fee2e2', color: '#dc2626'} : {}}>{item.status}</span>
                    <span style={{fontSize: '0.8rem', color: '#64748b'}}>{item.dueTime || 'Any time'}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Needs Attention & Quick Actions */}
      <div className="emp-grid-2">
        <div className="emp-panel" style={{borderColor: overdueFollowUps.length > 0 ? '#fed7aa' : undefined}}>
          <h2><AlertCircle size={18} /> Needs Attention</h2>
          <div className="emp-list">
            {overdueFollowUps.length > 0 ? overdueFollowUps.map(f => (
              <div key={f.lead.id} className="emp-list-item warning">
                <div className="emp-list-info">
                  <span className="emp-list-name">{f.lead.customer}</span>
                  <span className="emp-list-meta" style={{color: '#9a3412', fontWeight: 600}}>
                    Overdue • {f.date} {f.time}
                  </span>
                </div>
                <button className="btn-action" onClick={() => onNavigate('/employee/followups')}>View →</button>
              </div>
            )) : (
              <div className="emp-empty-state" style={{padding: '1.5rem'}}>
                <CheckCircle2 size={32} />
                <h3>No overdue follow-ups.</h3>
              </div>
            )}
          </div>
        </div>

        <div className="emp-panel">
          <h2><ActivityIcon size={18} /> Quick Actions</h2>
          <div className="emp-quick-actions">
            <button className="emp-action-btn primary" onClick={() => onNavigate('/employee/leads', { action: 'add' })}>
              <Plus size={24} />
              Add Lead
            </button>
            <button className="emp-action-btn" onClick={() => onNavigate('/employee/followups')}>
              <PhoneCall size={24} />
              Today's Calls
            </button>
            <button className="emp-action-btn" onClick={() => onNavigate('/employee/leads')}>
              <Users size={24} />
              View Leads
            </button>
            {canAccessRoute(currentUser, 'Stock') && (
              <button className="emp-action-btn" onClick={() => onNavigate('/employee/stock', { action: 'request' })}>
                <Package size={24} />
                Request Stock
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Performance & Dealers */}
      <div className="emp-grid-half">
        <div className="emp-panel">
          <h2><TrendingUp size={18} /> My Performance</h2>
          <div style={{display: 'flex', gap: '2rem', alignItems: 'center'}}>
            <div style={{flex: 1, padding: '2rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center'}}>
              <div style={{fontSize: '3rem', fontWeight: 800, color: 'var(--color-navy)'}}>{performance.conversionRate}%</div>
              <div style={{fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>Conversion Rate</div>
            </div>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9'}}>
                <span style={{color: '#64748b', fontWeight: 600}}>Converted</span>
                <span style={{fontWeight: 800}}>{performance.convertedLeads}</span>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9'}}>
                <span style={{color: '#64748b', fontWeight: 600}}>Follow-ups Completed</span>
                <span style={{fontWeight: 800}}>{performance.completedFollowUps}</span>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9'}}>
                <span style={{color: '#64748b', fontWeight: 600}}>Total Leads</span>
                <span style={{fontWeight: 800}}>{performance.totalLeads}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="emp-panel">
          <h2><Box size={18} /> My Dealers</h2>
          <div className="emp-list">
            {myDealers.length > 0 ? myDealers.slice(0, 3).map(d => {
              const dLeads = myLeads.filter(l => l.dealer === d.name);
              const dConv = dLeads.filter(l => l.stage === 'Converted').length;
              return (
                <div key={d.id} className="emp-list-item">
                  <div className="emp-list-info">
                    <span className="emp-list-name">{d.name}</span>
                    <span className="emp-list-meta">{dLeads.length} Leads • {dConv} Converted</span>
                  </div>
                </div>
              )
            }) : (
              <div className="emp-empty-state" style={{padding: '1.5rem'}}>
                <Box size={32} />
                <h3>No assigned dealers.</h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock & Activity */}
      <div className="emp-grid-half">
        {canAccessRoute(currentUser, 'Stock') && (
          <div className="emp-panel">
            <h2><Package size={18} /> Stock Availability</h2>
            <div className="emp-list">
              {stockSnapshot.map((item: any) => (
                <div key={item.id} className="emp-list-item">
                  <div className="emp-list-info">
                    <span className="emp-list-name">{item.name}</span>
                    <span className="emp-list-meta">Available: {item.totalQuantity - item.reservedQuantity}</span>
                  </div>
                  <span className={`emp-badge ${item.status === 'Healthy' || item.status === 'Moderate' ? 'success' : 'warning'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="emp-panel" style={!canAccessRoute(currentUser, 'Stock') ? {gridColumn: '1 / -1'} : {}}>
          <h2><ActivityIcon size={18} /> Recent Activity</h2>
          <div className="emp-timeline">
            {myActivity.length > 0 ? myActivity.map(a => (
              <div key={a.id} className="emp-timeline-item">
                <div className="emp-timeline-dot"></div>
                <div className="emp-timeline-content">
                  <span className="emp-timeline-title">{a.message}</span>
                  <span className="emp-timeline-time">{new Date(a.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            )) : (
              <div className="emp-empty-state" style={{padding: '1.5rem'}}>
                <ActivityIcon size={32} />
                <h3>No recent activity.</h3>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
