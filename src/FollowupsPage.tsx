import { useState, useMemo } from 'react';
import { 
  Search, Calendar, List, Clock, X, Plus 
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import type { FollowUp } from './context/CRMContext';
import { useUI } from './context/UIContext';
import { canManageModule } from './utils/permissionCalculations';
import { isDateInPeriod } from './utils/analyticsCalculations';
import './FollowupsPage.css';

// Flat task interface
interface FollowUpTask extends FollowUp {
  leadId: string;
  customerName: string;
  leadStage: string;
  dealer: string;
  employee: string;
  priority: string;
  phone: string;
}

interface FollowupsPageProps {
  filter?: string; // e.g. "Today" from dashboard
  onNavigate?: (path: string, filters?: any) => void;
}

export default function FollowupsPage({ filter, onNavigate }: FollowupsPageProps) {
  const { leads, dealers, employees, currentUser, updateLead, addActivity } = useCRM();
  const { showToast } = useUI();

  // State
  const [view, setView] = useState<'List' | 'Calendar' | 'Timeline'>('List');
  const [searchQuery, setSearchQuery] = useState('');
  
  const isEmployee = currentUser?.role === 'Employee';
  const isDealer = currentUser?.role === 'Dealer';
  const isAdmin = currentUser?.role === 'Admin';

  // Filters
  const [statusFilter, setStatusFilter] = useState(filter || 'All');
  const [dateFilter, setDateFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [empFilter, setEmpFilter] = useState(isEmployee ? currentUser.name : 'All');
  const [dlrFilter, setDlrFilter] = useState(isDealer ? currentUser.name : 'All');

  // Drawer / Modals
  const [selectedTask, setSelectedTask] = useState<FollowUpTask | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeNote, setCompleteNote] = useState('');
  
  // Calendar specific state
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<number | null>(null);

  // 1. DATA PARSING & STRICT SCOPING
  const allTasks: FollowUpTask[] = useMemo(() => {
    const tasks: FollowUpTask[] = [];
    leads.forEach(l => {
      if (!l.archived && l.followUp) {
        // Scoping
        if (isEmployee && l.assignedEmployee !== currentUser.name) return;
        if (isDealer && l.dealer !== currentUser.name) return;

        tasks.push({
          ...l.followUp,
          leadId: l.id,
          customerName: l.customer,
          leadStage: l.stage,
          dealer: l.dealer,
          employee: l.assignedEmployee,
          priority: l.priority,
          phone: l.phone
        });
      }
    });
    return tasks;
  }, [leads, isEmployee, isDealer, currentUser]);

  // Derived Metrics
  const todayTasks = allTasks.filter(t => t.status === 'Due Today');
  const overdueTasks = allTasks.filter(t => t.status === 'Overdue');
  const upcomingTasks = allTasks.filter(t => t.status === 'Upcoming');
  const completedTasks = allTasks.filter(t => t.status === 'Completed');

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      if (empFilter !== 'All' && t.employee !== empFilter) return false;
      if (dlrFilter !== 'All' && t.dealer !== dlrFilter) return false;
      
      if (typeFilter !== 'All' && t.type !== typeFilter) return false;
      
      if (dateFilter !== 'All') {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          if (!isDateInPeriod(t.date, dateFilter as any)) return false;
        } else {
          // Fallback for mock literal strings
          if (dateFilter === 'Today' && t.date !== 'Today') return false;
          if (dateFilter === 'Tomorrow' && t.date !== 'Tomorrow') return false;
        }
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.customerName.toLowerCase().includes(q) &&
          !t.leadId.toLowerCase().includes(q) &&
          !t.employee.toLowerCase().includes(q) &&
          !t.dealer.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      // Sort priority / date pseudo-logic
      if (a.status === 'Overdue' && b.status !== 'Overdue') return -1;
      if (a.status !== 'Overdue' && b.status === 'Overdue') return 1;
      return 0;
    });
  }, [allTasks, statusFilter, priorityFilter, empFilter, dlrFilter, dateFilter, typeFilter, searchQuery]);

  // Handlers
  const handleClearFilters = () => {
    setStatusFilter('All');
    setPriorityFilter('All');
    setDateFilter('All');
    setTypeFilter('All');
    if (!isEmployee) setEmpFilter('All');
    if (!isDealer) setDlrFilter('All');
    setSearchQuery('');
  };

  const handleComplete = () => {
    if (!selectedTask) return;
    
    // Find lead in context
    const lead = leads.find(l => l.id === selectedTask.leadId);
    if (lead && lead.followUp) {
      updateLead(lead.id, { 
        followUp: { ...lead.followUp, status: 'Completed' } 
      });
      addActivity({
        type: 'Follow-up Completed',
        message: `Completed follow-up for ${lead.customer}`,
        user: currentUser?.name || 'System',
        dealer: lead.dealer
      });
      showToast('Follow-up completed successfully');
      setShowCompleteModal(false);
      setSelectedTask(null);
      setCompleteNote('');
    }
  };

  // UI Helpers
  const getBadgeClass = (s: string) => s.toLowerCase().replace(' ', '-');

  return (
    <div className="fu-page fade-in">
      <div className="fu-header">
        <div className="fu-title-area">
          <h1>Follow-ups</h1>
          <p>Stay on top of customer conversations and scheduled tasks.</p>
        </div>
        {canManageModule(currentUser, 'leads') && (
          <button className="btn-primary" onClick={() => onNavigate && onNavigate(isEmployee ? '/employee/leads' : isDealer ? '/dealer/leads' : '/leads')}>
            <Plus size={18} /> Add Follow-up
          </button>
        )}
      </div>

      <div className="fu-main">
        {/* SUMMARY CARDS */}
        <div className="fu-summary-grid">
          <div className="fu-summary-card" onClick={() => setStatusFilter('Due Today')}>
            <span className="fu-summary-title">Today</span>
            <span className="fu-summary-value" style={{color: '#ea580c'}}>{todayTasks.length}</span>
          </div>
          <div className="fu-summary-card" style={{borderColor: overdueTasks.length > 0 ? '#fed7aa' : undefined}} onClick={() => setStatusFilter('Overdue')}>
            <span className="fu-summary-title">Overdue</span>
            <span className="fu-summary-value" style={{color: '#9a3412'}}>{overdueTasks.length}</span>
          </div>
          <div className="fu-summary-card" onClick={() => setStatusFilter('Upcoming')}>
            <span className="fu-summary-title">Upcoming</span>
            <span className="fu-summary-value" style={{color: 'var(--color-navy)'}}>{upcomingTasks.length}</span>
          </div>
          <div className="fu-summary-card" onClick={() => setStatusFilter('Completed')}>
            <span className="fu-summary-title">Completed</span>
            <span className="fu-summary-value" style={{color: '#16a34a'}}>{completedTasks.length}</span>
          </div>
        </div>

        {/* VIEW SWITCHER & SEARCH/FILTERS */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'}}>
          <div className="fu-view-switcher">
            <button className={`fu-view-btn ${view === 'List' ? 'active' : ''}`} onClick={() => setView('List')}>
              <List size={16} style={{display:'inline', marginRight:'0.25rem', verticalAlign:'text-bottom'}}/> List
            </button>
            <button className={`fu-view-btn ${view === 'Calendar' ? 'active' : ''}`} onClick={() => setView('Calendar')}>
              <Calendar size={16} style={{display:'inline', marginRight:'0.25rem', verticalAlign:'text-bottom'}}/> Calendar
            </button>
            <button className={`fu-view-btn ${view === 'Timeline' ? 'active' : ''}`} onClick={() => setView('Timeline')}>
              <Clock size={16} style={{display:'inline', marginRight:'0.25rem', verticalAlign:'text-bottom'}}/> Timeline
            </button>
          </div>

          <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
            <div className="search-box" style={{background: 'white', maxWidth: '200px'}}>
              <Search size={16} color="#94a3b8" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            
            <select className="filter-select" style={{background: 'white'}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Due Today">Due Today</option>
              <option value="Overdue">Overdue</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Completed">Completed</option>
            </select>
            
            <select className="filter-select" style={{background: 'white'}} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="All">All Types</option>
              <option value="Call">Call</option>
              <option value="Visit">Visit</option>
              <option value="Document">Document</option>
              <option value="Payment">Payment</option>
            </select>
            
            <select className="filter-select" style={{background: 'white'}} value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
              <option value="All">All Dates</option>
              <option value="Today">Today</option>
              <option value="Tomorrow">Tomorrow</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="This Month">This Month</option>
            </select>
            {isAdmin && (
              <select className="filter-select" style={{background: 'white'}} value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
                <option value="All">All Employees</option>
                {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            )}

            {isAdmin && (
              <select className="filter-select" style={{background: 'white'}} value={dlrFilter} onChange={e => setDlrFilter(e.target.value)}>
                <option value="All">All Dealers</option>
                {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* CHIPS */}
        {(statusFilter !== 'All' || priorityFilter !== 'All' || typeFilter !== 'All' || dateFilter !== 'All' || (empFilter !== 'All' && isAdmin) || (dlrFilter !== 'All' && isAdmin) || searchQuery) && (
          <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap'}}>
            {statusFilter !== 'All' && <span className="fu-badge">Status: {statusFilter}</span>}
            {typeFilter !== 'All' && <span className="fu-badge">Type: {typeFilter}</span>}
            {dateFilter !== 'All' && <span className="fu-badge">Date: {dateFilter}</span>}
            {empFilter !== 'All' && isAdmin && <span className="fu-badge">Emp: {empFilter}</span>}
            {dlrFilter !== 'All' && isAdmin && <span className="fu-badge">Dlr: {dlrFilter}</span>}
            <button className="clear-filters" onClick={handleClearFilters}>Clear All</button>
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'List' && (
          <div className="fu-table-container">
            <table className="fu-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Lead</th>
                  {!isEmployee && <th>Employee</th>}
                  {!isDealer && <th>Dealer</th>}
                  <th>Date/Time</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length > 0 ? filteredTasks.map(t => (
                  <tr key={t.leadId} onClick={() => setSelectedTask(t)} style={{cursor: 'pointer'}}>
                    <td style={{fontWeight: 700, color: 'var(--color-navy)'}}>{t.customerName}</td>
                    <td style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{t.leadId}</td>
                    {!isEmployee && <td>{t.employee}</td>}
                    {!isDealer && <td>{t.dealer}</td>}
                    <td>{t.date} {t.time}</td>
                    <td className={`priority-${t.priority.toLowerCase()}`}>{t.priority}</td>
                    <td><span className={`fu-badge ${getBadgeClass(t.status)}`}>{t.status}</span></td>
                    <td>
                      <button className="btn-outline" style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem'}}>View →</button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} style={{textAlign: 'center', padding: '3rem', color: '#64748b'}}>No follow-ups found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TIMELINE VIEW */}
        {view === 'Timeline' && (
          <div className="fu-section">
            <h2 className="fu-section-title">Follow-up Timeline</h2>
            <div className="fu-timeline">
              <div className="timeline-group">
                <h3>Overdue & Today</h3>
                <div className="timeline-items">
                  {filteredTasks.filter(t => t.status === 'Overdue' || t.status === 'Due Today').map(t => (
                    <div key={t.leadId} className={`time-item ${t.status === 'Overdue' ? 'overdue' : 'due'}`}>
                      <div className="time-dot"></div>
                      <div className="time-content" onClick={() => setSelectedTask(t)} style={{cursor: 'pointer'}}>
                        <div>
                          <div style={{fontWeight: 800, color: 'var(--color-navy)'}}>{t.time} - {t.customerName}</div>
                          <div style={{fontSize: '0.85rem', color: '#64748b'}}>{t.type} • {t.employee}</div>
                        </div>
                        <span className={`fu-badge ${getBadgeClass(t.status)}`}>{t.status}</span>
                      </div>
                    </div>
                  ))}
                  {filteredTasks.filter(t => t.status === 'Overdue' || t.status === 'Due Today').length === 0 && (
                    <div style={{color: '#64748b', padding: '1rem'}}>No immediate tasks.</div>
                  )}
                </div>
              </div>
              <div className="timeline-group">
                <h3>Upcoming</h3>
                <div className="timeline-items">
                  {filteredTasks.filter(t => t.status === 'Upcoming').map(t => (
                    <div key={t.leadId} className="time-item">
                      <div className="time-dot"></div>
                      <div className="time-content" onClick={() => setSelectedTask(t)} style={{cursor: 'pointer'}}>
                        <div>
                          <div style={{fontWeight: 800, color: 'var(--color-navy)'}}>{t.date} {t.time} - {t.customerName}</div>
                          <div style={{fontSize: '0.85rem', color: '#64748b'}}>{t.type} • {t.employee}</div>
                        </div>
                        <span className="fu-badge upcoming">{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CALENDAR VIEW (Simplified) */}
        {view === 'Calendar' && (
          <div className="fu-calendar-wrapper">
            <div className="fu-calendar" style={{ marginBottom: '2rem' }}>
              <div className="cal-header">
                <button className="btn-outline" style={{padding: '0.2rem 0.5rem'}}>&lt;</button>
                <div>August 2026</div>
                <button className="btn-outline" style={{padding: '0.2rem 0.5rem'}}>&gt;</button>
              </div>
              <div className="cal-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="cal-day-header">{d}</div>
                ))}
                {Array.from({length: 31}).map((_, i) => {
                  const day = i + 1;
                  const isSelected = selectedCalendarDate === day;
                  const hasDue = day === 20;
                  const hasUpcoming = day === 22;
                  return (
                    <div 
                      key={i} 
                      className={`cal-cell ${day === 20 ? 'today' : ''}`} 
                      style={{ 
                        cursor: 'pointer', 
                        border: isSelected ? '2px solid var(--color-navy)' : undefined,
                        boxShadow: isSelected ? '0 0 0 2px rgba(11,31,58,0.1)' : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.2rem',
                        minHeight: '60px'
                      }}
                      onClick={() => setSelectedCalendarDate(day)}
                    >
                      <span className="cal-date-num" style={{
                        fontWeight: 700,
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: day === 20 ? '#0284c7' : 'transparent',
                        color: day === 20 ? '#fff' : 'inherit'
                      }}>{day}</span>
                      
                      {/* Dots indicators */}
                      <div style={{display: 'flex', gap: '3px', alignItems: 'center', justifyContent: 'center', minHeight: '8px'}}>
                        {hasDue && <span style={{width: '6px', height: '6px', borderRadius: '50%', background: '#ea580c', display: 'inline-block'}} title="Due Today" />}
                        {hasUpcoming && <span style={{width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block'}} title="Upcoming" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Tasks View */}
            {selectedCalendarDate && (
              <div className="fu-section" style={{ background: 'var(--color-white)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(11,31,58,0.05)', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                    Tasks for August {selectedCalendarDate}, 2026
                  </h3>
                  <button onClick={() => setSelectedCalendarDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                    <X size={18} />
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(() => {
                    let tasksToShow: FollowUpTask[] = [];
                    // Mock routing for tasks to specific dates
                    if (selectedCalendarDate === 20) {
                      tasksToShow = todayTasks;
                    } else if (selectedCalendarDate === 22) {
                      tasksToShow = upcomingTasks;
                    }

                    if (tasksToShow.length === 0) {
                      return <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No tasks scheduled for this date.</div>;
                    }

                    return tasksToShow.map(t => (
                      <div key={t.leadId} className="time-item" style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--color-navy)' }}>{t.time} - {t.customerName}</div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>{t.type} • {t.employee}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span className={`fu-badge ${getBadgeClass(t.status)}`}>{t.status}</span>
                          <button className="btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setSelectedTask(t)}>View Details</button>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      {selectedTask && (
        <>
          <div className="fu-drawer-overlay" onClick={() => setSelectedTask(null)}></div>
          <div className="fu-drawer">
            <div className="fu-drawer-header">
              <div>
                <h2 style={{fontSize: '1.2rem', fontWeight: 800}}>{selectedTask.type} with {selectedTask.customerName}</h2>
                <span className={`fu-badge ${getBadgeClass(selectedTask.status)}`} style={{marginTop: '0.5rem'}}>{selectedTask.status}</span>
              </div>
              <button onClick={() => setSelectedTask(null)} style={{background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b'}}>
                <X size={24} />
              </button>
            </div>
            
            <div className="fu-drawer-actions">
              {selectedTask.status !== 'Completed' && canManageModule(currentUser, 'leads') && (
                <button className="btn-primary" style={{padding: '0.5rem 1rem'}} onClick={() => setShowCompleteModal(true)}>
                  Complete
                </button>
              )}
              {canManageModule(currentUser, 'leads') && (
                <button className="btn-outline" style={{padding: '0.5rem 1rem'}}>
                  Reschedule
                </button>
              )}
            </div>

            <div className="fu-drawer-body">
              <div className="fu-section" style={{padding: '1.25rem'}}>
                <h3 style={{fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem'}}>Task Details</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div>
                    <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase'}}>Date & Time</div>
                    <div style={{fontWeight: 600}}>{selectedTask.date} at {selectedTask.time}</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase'}}>Priority</div>
                    <div className={`priority-${selectedTask.priority.toLowerCase()}`}>{selectedTask.priority}</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase'}}>Employee</div>
                    <div style={{fontWeight: 600}}>{selectedTask.employee}</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase'}}>Dealer</div>
                    <div style={{fontWeight: 600}}>{selectedTask.dealer}</div>
                  </div>
                </div>
              </div>

              <div className="fu-section" style={{padding: '1.25rem'}}>
                <h3 style={{fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem'}}>Related Lead</h3>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <div style={{fontWeight: 800, fontSize: '1.1rem'}}>{selectedTask.customerName}</div>
                    <div style={{fontSize: '0.85rem', color: '#64748b'}}>{selectedTask.leadId} • {selectedTask.leadStage}</div>
                  </div>
                  {onNavigate && (
                    <button className="btn-outline" style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem'}} onClick={() => {
                      if (isEmployee) onNavigate('/employee/leads', { search: selectedTask.leadId });
                      else if (isDealer) onNavigate('/dealer/leads', { search: selectedTask.leadId });
                      else onNavigate('/leads', { search: selectedTask.leadId });
                    }}>View Lead</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* COMPLETE MODAL */}
      {showCompleteModal && selectedTask && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{maxWidth: '400px'}}>
            <h2>Complete Follow-up</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Mark this task with <strong>{selectedTask.customerName}</strong> as completed.</p>
            <textarea 
              placeholder="Optional completion note..."
              style={{width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1.5rem', resize: 'vertical', minHeight: '80px'}}
              value={completeNote}
              onChange={e => setCompleteNote(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowCompleteModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleComplete}>Complete Task</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
