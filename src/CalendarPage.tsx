import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, X, Plus, Search, Trash2, Edit2, ExternalLink, Calendar } from 'lucide-react';
import { useCRM } from './context/CRMContext';
import type { FollowUpType, FollowUpStatus, TaskStatus } from './context/CRMContext';
import { useUI } from './context/UIContext';

interface CalendarPageProps {
  onNavigate?: (path: string, filters?: any) => void;
}

export default function CalendarPage({ onNavigate }: CalendarPageProps) {
  const { tasks, leads, currentUser, updateTask, updateLead, addActivity, dealers, employees, users } = useCRM();
  const { showToast } = useUI();
  
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const isAdmin = currentUser?.role === 'Admin';
  const isEmployee = currentUser?.role === 'Employee';
  const isDealer = currentUser?.role === 'Dealer';

  // Filter State
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [empFilter, setEmpFilter] = useState(isEmployee ? currentUser?.name : 'All');
  const [dlrFilter, setDlrFilter] = useState(isDealer ? currentUser?.name : 'All');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Day Modal State (when clicking on a calendar cell)
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'Add' | 'Edit'>('Add');
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    leadId: '',
    type: 'Call' as FollowUpType | 'Task',
    date: '',
    time: '',
    notes: '',
    status: 'Upcoming' as FollowUpStatus | TaskStatus
  });

  // Prepare events
  const allEvents = useMemo(() => {
    const arr: any[] = [];

    // Add visible tasks
    tasks.forEach(t => {
      if (!isAdmin) {
        if (t.assignedToUserId !== currentUser?.id && t.createdByUserId !== currentUser?.id) return;
      }
      
      arr.push({
        id: t.id,
        date: t.dueDate,
        time: t.dueTime,
        title: t.title,
        type: 'Task',
        status: t.status,
        priority: t.priority,
        original: t
      });
    });

    // Add follow-ups (if Employee/Dealer, only if assigned to them or if it's their lead)
    leads.forEach(l => {
      if (l.followUp && l.followUp.date && l.followUp.status !== 'No Follow-up') {
        if (!isAdmin) {
          if (isEmployee && l.assignedEmployee !== currentUser?.name) return;
          if (isDealer && l.dealer !== currentUser?.name) return;
        }

        arr.push({
          id: `FU-${l.id}`,
          date: l.followUp.date,
          time: l.followUp.time,
          title: `Follow-up: ${l.customer}`,
          type: 'FollowUp',
          status: l.followUp.status,
          priority: l.priority,
          original: l
        });
      }
    });

    return arr;
  }, [tasks, leads, currentUser, isAdmin, isEmployee, isDealer]);

  // Apply Filters
  const events = useMemo(() => {
    return allEvents.filter(e => {
      if (statusFilter !== 'All' && e.status !== statusFilter) return false;
      if (typeFilter !== 'All') {
        if (e.type === 'FollowUp' && e.original.followUp.type !== typeFilter) return false;
        if (e.type === 'Task' && !e.title.toLowerCase().includes(typeFilter.toLowerCase())) return false; // Rough fallback for tasks
      }
      if (empFilter !== 'All') {
        if (e.type === 'FollowUp' && e.original.assignedEmployee !== empFilter) return false;
        if (e.type === 'Task' && e.original.assignedToUserId !== users.find(u=>u.name===empFilter)?.id) return false;
      }
      if (dlrFilter !== 'All') {
        if (e.type === 'FollowUp' && e.original.dealer !== dlrFilter) return false;
        if (e.type === 'Task') return false; 
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !e.title.toLowerCase().includes(q) &&
          !(e.original.customer && e.original.customer.toLowerCase().includes(q)) &&
          !(e.original.assignedEmployee && e.original.assignedEmployee.toLowerCase().includes(q)) &&
          !(e.original.dealer && e.original.dealer.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allEvents, statusFilter, typeFilter, empFilter, dlrFilter, searchQuery, users]);

  // Authorized leads for Add form
  const allowedLeads = useMemo(() => {
    return leads.filter(l => {
      if (l.archived) return false;
      if (isAdmin) return true;
      if (isEmployee && l.assignedEmployee === currentUser?.name) return true;
      if (isDealer && l.dealer === currentUser?.name) return true;
      return false;
    });
  }, [leads, isAdmin, isEmployee, isDealer, currentUser]);

  const handleClearFilters = () => {
    setStatusFilter('All');
    setTypeFilter('All');
    if (isAdmin) {
      setEmpFilter('All');
      setDlrFilter('All');
    }
    setSearchQuery('');
  };

  const openAddModal = (dateStr?: string) => {
    setModalMode('Add');
    setFormData({
      leadId: '',
      type: 'Call',
      date: dateStr || new Date().toISOString().split('T')[0],
      time: '10:00',
      notes: '',
      status: 'Upcoming'
    });
    setShowModal(true);
  };

  const openEditModal = (ev: any) => {
    setModalMode('Edit');
    setEditEventId(ev.id);
    if (ev.type === 'FollowUp') {
      setFormData({
        leadId: ev.original.id,
        type: ev.original.followUp.type,
        date: ev.original.followUp.date,
        time: ev.original.followUp.time || '',
        notes: ev.original.followUp.notes || '',
        status: ev.original.followUp.status
      });
    } else {
      setFormData({
        leadId: ev.original.leadId || '',
        type: 'Task',
        date: ev.original.dueDate,
        time: ev.original.dueTime || '',
        notes: ev.original.description || '',
        status: ev.original.status
      });
    }
    setShowModal(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.leadId) {
      showToast('Please select a lead for this follow-up', 'error');
      return;
    }

    const lead = leads.find(l => l.id === formData.leadId);
    if (!lead) return;

    if (modalMode === 'Add') {
      updateLead(formData.leadId, { 
        followUp: { 
          date: formData.date, 
          time: formData.time, 
          type: formData.type as FollowUpType, 
          status: formData.status as FollowUpStatus
        } 
      });
      addActivity({ type: 'Follow-up Created', message: `Created ${formData.type} follow-up for ${lead.customer}`, user: currentUser?.name || 'System', dealer: lead.dealer });
      showToast('Follow-up added successfully');
    } else {
      // Edit mode
      const ev = allEvents.find(event => event.id === editEventId);
      if (ev?.type === 'FollowUp') {
        updateLead(formData.leadId, { 
          followUp: { 
            date: formData.date, 
            time: formData.time, 
            type: formData.type as FollowUpType, 
            status: formData.status as FollowUpStatus
          } 
        });
        addActivity({ type: 'Follow-up Updated', message: `Updated follow-up for ${lead.customer}`, user: currentUser?.name || 'System', dealer: lead.dealer });
        showToast('Follow-up updated successfully');
      } else if (ev?.type === 'Task') {
        updateTask(ev.id, { 
          dueDate: formData.date, 
          dueTime: formData.time, 
          description: formData.notes, 
          status: formData.status as TaskStatus, 
          leadId: formData.leadId 
        });
        showToast('Task updated successfully');
      }
    }
    
    setShowModal(false);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = (ev: any) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      if (ev.type === 'FollowUp') {
        updateLead(ev.original.id, { followUp: { status: 'No Follow-up', type: 'Other', date: '', time: '' } });
      } else {
        // Assume context has deleteTask, otherwise this handles UI gracefully
        try {
          updateTask(ev.id, { status: 'Cancelled' });
        } catch (err) {
          console.error(err);
        }
      }
      showToast('Task removed', 'success');
      setSelectedEvent(null);
    }
  };

  const getDotColor = (ev: any) => {
    if (ev.status === 'Completed') return '#10b981'; // Green
    if (ev.priority === 'High' || ev.status === 'Overdue') return '#ef4444'; // Red
    if (ev.priority === 'Medium' || ev.type === 'FollowUp') return '#f59e0b'; // Amber / Yellow
    return '#3b82f6'; // Blue / Task
  };

  const renderCells = () => {
    const cells = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Blank cells for previous month
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<div key={`blank-${i}`} className="calendar-cell blank" style={{background: '#f8fafc', border: '1px solid #e2e8f0', minHeight: '80px'}}></div>);
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isToday = dateStr === todayStr;
      const isSelected = selectedDayDate === dateStr;

      cells.push(
        <div 
          key={d} 
          className={`calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`} 
          style={{
            minHeight: '85px', 
            border: '1px solid #e2e8f0', 
            padding: '0.5rem 0.35rem', 
            background: isSelected ? '#eff6ff' : isToday ? '#f0f9ff' : '#fff', 
            cursor: 'pointer', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            transition: 'all 0.15s ease',
            outline: isSelected ? '2px solid #3b82f6' : 'none',
            zIndex: isSelected ? 2 : 1
          }}
          onClick={() => setSelectedDayDate(dateStr)}
          title={`Click to view tasks for ${dateStr}`}
        >
          {/* Day number header */}
          <div style={{
            fontWeight: 700, 
            color: isToday ? '#fff' : isSelected ? '#1d4ed8' : '#334155', 
            background: isToday ? '#0284c7' : isSelected ? '#dbeafe' : 'transparent',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem'
          }}>
            {d}
          </div>
          
          {/* Dots container */}
          <div style={{
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '4px', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '100%',
            padding: '0.25rem 0',
            minHeight: '20px'
          }}>
            {dayEvents.slice(0, 5).map((ev, idx) => (
              <span 
                key={ev.id || idx} 
                style={{
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: getDotColor(ev),
                  display: 'inline-block',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.12)'
                }}
                title={`${ev.title} (${ev.priority || 'Normal'})`}
              />
            ))}
            {dayEvents.length > 5 && (
              <span style={{
                fontSize: '0.65rem', 
                fontWeight: 800, 
                color: '#475569', 
                background: '#e2e8f0', 
                padding: '1px 4px', 
                borderRadius: '8px',
                lineHeight: 1
              }}>
                +{dayEvents.length - 5}
              </span>
            )}
          </div>

          {/* Bottom indicator if events exist */}
          <div style={{minHeight: '14px', display: 'flex', alignItems: 'center'}}>
            {dayEvents.length > 0 && (
              <span style={{
                fontSize: '0.65rem', 
                color: '#64748b', 
                fontWeight: 600
              }}>
                {dayEvents.length} {dayEvents.length === 1 ? 'task' : 'tasks'}
              </span>
            )}
          </div>
        </div>
      );
    }

    return cells;
  };

  const [viewMode, setViewMode] = useState<'Month' | 'Agenda'>('Month');

  const renderAgendaView = () => {
    // Group events by date
    const grouped = events.reduce((acc: Record<string, any[]>, ev) => {
      const d = ev.date || 'Undated';
      if (!acc[d]) acc[d] = [];
      acc[d].push(ev);
      return acc;
    }, {});

    const sortedDates = Object.keys(grouped).sort();

    if (sortedDates.length === 0) {
      return (
        <div style={{padding: '3rem 1rem', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b'}}>
          <Calendar size={36} color="#94a3b8" style={{margin: '0 auto 1rem auto', display: 'block'}} />
          <h3 style={{margin: '0 0 0.5rem 0', color: '#1e293b'}}>No Events Scheduled</h3>
          <p style={{margin: 0, fontSize: '0.9rem'}}>No follow-ups or tasks match the selected filters.</p>
        </div>
      );
    }

    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
        {sortedDates.map(dateStr => (
          <div key={dateStr} style={{background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'}}>
            <div style={{fontWeight: 700, color: 'var(--color-navy)', fontSize: '0.95rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span>{dateStr === new Date().toISOString().split('T')[0] ? 'Today - ' : ''}{dateStr}</span>
              <span style={{fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '0.15rem 0.5rem', borderRadius: '10px'}}>{grouped[dateStr].length} items</span>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              {grouped[dateStr].map(ev => (
                <div 
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${ev.priority === 'High' ? '#ef4444' : ev.priority === 'Medium' ? '#f59e0b' : '#3b82f6'}`,
                    cursor: 'pointer',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: ev.status === 'Completed' ? 'line-through' : 'none'}}>
                      {ev.title}
                    </div>
                    <div style={{fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '0.2rem'}}>
                      <span>{ev.time || 'Any time'}</span>
                      <span>•</span>
                      <span>{ev.type}</span>
                      {ev.original.customer && <span>• {ev.original.customer}</span>}
                    </div>
                  </div>
                  <span className={`stage-badge ${ev.status === 'Completed' ? 'converted' : ev.status === 'Overdue' ? 'rejected' : 'lead'}`} style={{fontSize: '0.72rem'}}>
                    {ev.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="calendar-page fade-in" style={{padding: '1rem', width: '100%', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column', height: '100%'}}>
      
      {/* Header */}
      <div className="page-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem'}}>
        <div>
          <h1 style={{fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem 0'}}>Calendar</h1>
          <p style={{color: '#64748b', margin: 0, fontSize: '0.9rem'}}>Schedule and upcoming events</p>
        </div>
        
        <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between'}}>
          <div style={{display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px'}}>
            <button 
              type="button" 
              onClick={() => setViewMode('Month')}
              style={{
                border: 'none', 
                background: viewMode === 'Month' ? 'white' : 'transparent', 
                color: viewMode === 'Month' ? 'var(--color-navy)' : '#64748b',
                padding: '5px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Month
            </button>
            <button 
              type="button" 
              onClick={() => setViewMode('Agenda')}
              style={{
                border: 'none', 
                background: viewMode === 'Agenda' ? 'white' : 'transparent', 
                color: viewMode === 'Agenda' ? 'var(--color-navy)' : '#64748b',
                padding: '5px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Agenda
            </button>
          </div>

          <div style={{display: 'flex', gap: '0.4rem', alignItems: 'center'}}>
            <button className="btn-outline" style={{padding: '0.4rem 0.6rem'}} onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <span style={{fontWeight: 700, fontSize: '1rem', minWidth: '120px', textAlign: 'center'}}>
              {monthNames[month].slice(0, 3)} {year}
            </span>
            <button className="btn-outline" style={{padding: '0.4rem 0.6rem'}} onClick={nextMonth} aria-label="Next month"><ChevronRight size={18} /></button>
            <button className="btn-outline" style={{padding: '0.4rem 0.75rem', fontSize: '0.85rem'}} onClick={goToday}>Today</button>
          </div>

          <button className="btn-primary" onClick={() => openAddModal()} style={{display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center', marginTop: '0.25rem'}}>
            <Plus size={16} /> Add Follow-up
          </button>
        </div>
      </div>

      {/* Filters (Mimicking FollowupsPage style) */}
      <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center'}}>
        <div className="search-box" style={{background: 'white', flex: '1 1 180px', minWidth: '0'}}>
          <Search size={16} color="#94a3b8" />
          <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        
        <select className="filter-select" style={{background: 'white', flex: '1 1 120px'}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="Due Today">Due Today</option>
          <option value="Overdue">Overdue</option>
          <option value="Upcoming">Upcoming</option>
          <option value="Completed">Completed</option>
        </select>
        
        <select className="filter-select" style={{background: 'white', flex: '1 1 120px'}} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="All">All Types</option>
          <option value="Call">Call</option>
          <option value="Visit">Visit</option>
          <option value="Document">Document</option>
          <option value="Payment">Payment</option>
        </select>
        
        {isAdmin && (
          <>
            <select className="filter-select" style={{background: 'white', flex: '1 1 120px'}} value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
              <option value="All">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <select className="filter-select" style={{background: 'white', flex: '1 1 120px'}} value={dlrFilter} onChange={e => setDlrFilter(e.target.value)}>
              <option value="All">All Dealers</option>
              {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </>
        )}

        {(statusFilter !== 'All' || typeFilter !== 'All' || (empFilter !== 'All' && isAdmin) || (dlrFilter !== 'All' && isAdmin) || searchQuery) && (
          <button className="clear-filters" onClick={handleClearFilters} style={{background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline'}}>Clear All</button>
        )}
      </div>

      {/* Main Calendar View Mode */}
      {viewMode === 'Agenda' ? (
        renderAgendaView()
      ) : (
        <div className="table-responsive" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
          <div style={{minWidth: '600px', display: 'flex', flexDirection: 'column', flex: 1}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', background: '#f1f5f9', borderRadius: '8px 8px 0 0', overflow: 'hidden', border: '1px solid #e2e8f0', borderBottom: 'none'}}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{padding: '0.6rem 0.25rem', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '0.8rem'}}>
                  {day}
                </div>
              ))}
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', borderLeft: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0'}}>
              {renderCells()}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{marginTop: '1.25rem', display: 'flex', gap: '1.25rem', fontSize: '0.75rem', color: '#64748b', flexWrap: 'wrap', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444'}}></div> High Priority / Overdue
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b'}}></div> Follow-ups / Medium
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6'}}></div> Tasks / General
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', background: '#10b981'}}></div> Completed
        </div>
        <div style={{marginLeft: 'auto', fontStyle: 'italic', color: '#94a3b8'}}>
          💡 Tip: Click any date to view all tasks scheduled for that day
        </div>
      </div>

      {/* DAY TASKS POPUP MODAL */}
      {selectedDayDate && (
        <div className="modal-overlay" onClick={() => setSelectedDayDate(null)} style={{zIndex: 1200}}>
          <div 
            className="modal-content fade-in" 
            onClick={e => e.stopPropagation()} 
            style={{maxWidth: '540px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '1.5rem'}}
          >
            {/* Header */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem'}}>
              <div>
                <div style={{fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                  Date Schedule
                </div>
                <h2 style={{margin: '0.2rem 0 0', fontSize: '1.25rem', color: 'var(--color-navy)', fontWeight: 800}}>
                  {(() => {
                    try {
                      const [y, m, d] = selectedDayDate.split('-').map(Number);
                      const dt = new Date(y, m - 1, d);
                      return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                    } catch {
                      return selectedDayDate;
                    }
                  })()}
                </h2>
                <div style={{fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem'}}>
                  {events.filter(e => e.date === selectedDayDate).length} {events.filter(e => e.date === selectedDayDate).length === 1 ? 'task scheduled' : 'tasks scheduled'}
                </div>
              </div>
              <button 
                onClick={() => setSelectedDayDate(null)} 
                style={{background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tasks list */}
            <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '4px', marginBottom: '1rem'}}>
              {(() => {
                const dayEvs = events.filter(e => e.date === selectedDayDate);
                if (dayEvs.length === 0) {
                  return (
                    <div style={{padding: '2.5rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1'}}>
                      <Calendar size={32} color="#94a3b8" style={{margin: '0 auto 0.75rem', display: 'block'}} />
                      <div style={{fontWeight: 700, color: '#334155', fontSize: '1rem'}}>No tasks on this date</div>
                      <p style={{margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem'}}>You don't have any follow-ups or tasks scheduled for this day.</p>
                    </div>
                  );
                }

                return dayEvs.map(ev => {
                  const isDone = ev.status === 'Completed';
                  return (
                    <div 
                      key={ev.id} 
                      style={{
                        padding: '0.85rem 1rem',
                        background: isDone ? '#f8fafc' : '#fff',
                        border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${getDotColor(ev)}`,
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem'}}>
                        <div style={{flex: 1}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem'}}>
                            <span style={{
                              fontSize: '0.7rem', 
                              fontWeight: 700, 
                              padding: '0.15rem 0.45rem', 
                              borderRadius: '4px', 
                              background: ev.type === 'Task' ? '#e0e7ff' : '#fef3c7', 
                              color: ev.type === 'Task' ? '#3730a3' : '#92400e'
                            }}>
                              {ev.type === 'FollowUp' ? `Follow-up: ${ev.original?.followUp?.type || 'Call'}` : 'Task'}
                            </span>
                            {ev.time && (
                              <span style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600}}>
                                🕒 {ev.time}
                              </span>
                            )}
                            <span style={{
                              fontSize: '0.7rem', 
                              fontWeight: 700, 
                              color: ev.priority === 'High' ? '#dc2626' : ev.priority === 'Medium' ? '#d97706' : '#2563eb'
                            }}>
                              • {ev.priority || 'Normal'} Priority
                            </span>
                          </div>

                          <div style={{
                            fontWeight: 700, 
                            fontSize: '0.95rem', 
                            color: isDone ? '#64748b' : 'var(--color-navy)',
                            textDecoration: isDone ? 'line-through' : 'none'
                          }}>
                            {ev.title}
                          </div>

                          {ev.original?.customer && (
                            <div style={{fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem'}}>
                              Customer: <strong>{ev.original.customer}</strong> {ev.original.phone && `(${ev.original.phone})`}
                            </div>
                          )}

                          {ev.original?.description && (
                            <div style={{fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem', background: '#f8fafc', padding: '0.35rem 0.5rem', borderRadius: '4px'}}>
                              {ev.original.description}
                            </div>
                          )}
                          {ev.original?.followUp?.notes && (
                            <div style={{fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem', background: '#f8fafc', padding: '0.35rem 0.5rem', borderRadius: '4px'}}>
                              {ev.original.followUp.notes}
                            </div>
                          )}
                        </div>

                        <span className={`stage-badge ${isDone ? 'converted' : ev.status === 'Overdue' ? 'rejected' : 'lead'}`} style={{fontSize: '0.7rem'}}>
                          {ev.status}
                        </span>
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', marginTop: '0.25rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                        <button 
                          className="btn-outline" 
                          style={{
                            padding: '0.3rem 0.6rem', 
                            fontSize: '0.8rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.35rem',
                            color: isDone ? '#64748b' : '#16a34a',
                            borderColor: isDone ? '#cbd5e1' : '#bbf7d0'
                          }}
                          onClick={() => {
                            if (ev.type === 'Task') {
                              const nextStatus: TaskStatus = isDone ? 'Pending' : 'Completed';
                              updateTask(ev.id, { status: nextStatus, completedAt: nextStatus === 'Completed' ? new Date().toISOString() : undefined });
                              if (ev.original?.leadId && nextStatus === 'Completed') {
                                const l = leads.find(lead => lead.id === ev.original.leadId);
                                if (l) addActivity({ type: 'Task Completed', message: `Completed task: ${ev.title}`, user: currentUser?.name || 'System', leadId: ev.original.leadId, dealer: l.dealer });
                              }
                            } else {
                              const nextStatus: FollowUpStatus = isDone ? 'Upcoming' : 'Completed';
                              const l = leads.find(lead => `FU-${lead.id}` === ev.id);
                              if (l && l.followUp) {
                                updateLead(l.id, { followUp: { ...l.followUp, status: nextStatus } });
                                if (nextStatus === 'Completed') {
                                  addActivity({ type: 'Follow-up Completed', message: `Completed follow-up for ${l.customer}`, user: currentUser?.name || 'System', dealer: l.dealer });
                                }
                              }
                            }
                            showToast(isDone ? 'Marked as incomplete' : 'Marked as completed', 'success');
                          }}
                        >
                          <CheckCircle2 size={14} /> {isDone ? 'Undo Complete' : 'Mark Done'}
                        </button>

                        <div style={{display: 'flex', gap: '0.4rem'}}>
                          <button 
                            className="btn-outline" 
                            style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem'}}
                            onClick={() => {
                              setSelectedEvent(ev);
                            }}
                          >
                            Full Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Bottom Actions */}
            <div style={{display: 'flex', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', flexWrap: 'wrap'}}>
              <button 
                className="btn-primary" 
                style={{flex: '1 1 180px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', minHeight: '42px'}}
                onClick={() => {
                  openAddModal(selectedDayDate);
                }}
              >
                <Plus size={16} /> Add Task for this Date
              </button>
              <button 
                className="btn-outline" 
                style={{minHeight: '42px', padding: '0 1rem', flex: '0 0 auto'}}
                onClick={() => setSelectedDayDate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selectedEvent && (
        <>
          <div className="fu-drawer-overlay" onClick={() => setSelectedEvent(null)} style={{position: 'fixed', inset: 0, background: 'rgba(11,31,58,0.5)', zIndex: 1200, backdropFilter: 'blur(2px)'}}></div>
          <div className="fu-drawer" style={{position: 'fixed', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: '440px', background: '#fff', zIndex: 1250, padding: '1.25rem', display: 'flex', flexDirection: 'column', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', boxSizing: 'border-box', overflowY: 'auto'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem'}}>
              <div>
                <div style={{fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem'}}>{selectedEvent.type}</div>
                <h2 style={{fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', margin: 0}}>{selectedEvent.title}</h2>
              </div>
              <button onClick={() => setSelectedEvent(null)} style={{background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><X size={20} /></button>
            </div>
            
            <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap'}}>
              {selectedEvent.status !== 'Completed' && (
                <button className="btn-outline" style={{padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem'}} onClick={() => openEditModal(selectedEvent)}>
                  <Edit2 size={14} /> Edit
                </button>
              )}
              {selectedEvent.type === 'FollowUp' && onNavigate && (
                <button className="btn-outline" style={{padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem'}} onClick={() => {
                   if (isEmployee) onNavigate('/employee/leads', { search: selectedEvent.original.id });
                   else if (isDealer) onNavigate('/dealer/leads', { search: selectedEvent.original.id });
                   else onNavigate('/leads', { search: selectedEvent.original.id });
                }}>
                  <ExternalLink size={14} /> View Lead
                </button>
              )}
              <button className="btn-outline" style={{padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', borderColor: '#fee2e2', marginLeft: 'auto', fontSize: '0.85rem'}} onClick={() => handleDeleteEvent(selectedEvent)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1}}>
              <div style={{display: 'flex', gap: '2rem'}}>
                <div>
                  <div style={{fontSize: '0.75rem', color: '#64748b'}}>Date</div>
                  <div style={{fontWeight: 600}}>{selectedEvent.date}</div>
                </div>
                <div>
                  <div style={{fontSize: '0.75rem', color: '#64748b'}}>Time</div>
                  <div style={{fontWeight: 600}}>{selectedEvent.time || 'Any time'}</div>
                </div>
              </div>
              
              <div>
                <div style={{fontSize: '0.75rem', color: '#64748b'}}>Status</div>
                <div style={{marginTop: '0.25rem'}}><span className={`stage-badge ${selectedEvent.status === 'Completed' ? 'converted' : selectedEvent.status === 'Overdue' ? 'rejected' : 'lead'}`}>{selectedEvent.status}</span></div>
              </div>

              {selectedEvent.original.customer && (
                <div>
                  <div style={{fontSize: '0.75rem', color: '#64748b'}}>Customer / Lead</div>
                  <div style={{fontWeight: 600}}>{selectedEvent.original.customer} <span style={{color: '#94a3b8', fontSize: '0.85rem'}}>({selectedEvent.original.id})</span></div>
                </div>
              )}

              {selectedEvent.type === 'Task' && selectedEvent.original.description && (
                <div>
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem'}}>Description</div>
                  <div style={{background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem'}}>{selectedEvent.original.description}</div>
                </div>
              )}
              {selectedEvent.type === 'FollowUp' && selectedEvent.original.followUp.notes && (
                <div>
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem'}}>Notes</div>
                  <div style={{background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem'}}>{selectedEvent.original.followUp.notes}</div>
                </div>
              )}
            </div>

            {selectedEvent.status !== 'Completed' && (
              <div style={{marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0', position: 'sticky', bottom: 0, background: 'white'}}>
                <button 
                  className="btn-primary" 
                  style={{width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', minHeight: '44px'}}
                  onClick={() => {
                    if (selectedEvent.type === 'Task') {
                      updateTask(selectedEvent.id, { status: 'Completed', completedAt: new Date().toISOString() });
                      if (selectedEvent.original.leadId) {
                        const l = leads.find(lead => lead.id === selectedEvent.original.leadId);
                        if (l) addActivity({ type: 'Task Completed', message: `Completed task: ${selectedEvent.title}`, user: currentUser?.name || 'System', leadId: selectedEvent.original.leadId, dealer: l.dealer });
                      }
                    } else {
                      const l = leads.find(lead => `FU-${lead.id}` === selectedEvent.id);
                      if (l && l.followUp) {
                        updateLead(l.id, { followUp: { ...l.followUp, status: 'Completed' } });
                        addActivity({ type: 'Follow-up Completed', message: `Completed follow-up for ${l.customer}`, user: currentUser?.name || 'System', dealer: l.dealer });
                      }
                    }
                    showToast('Marked as completed', 'success');
                    setSelectedEvent(null);
                  }}
                >
                  <CheckCircle2 size={18} /> Mark as Completed
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{maxWidth: '500px'}}>
            <h2>{modalMode === 'Add' ? 'Add Follow-up' : 'Edit Follow-up'}</h2>
            <p style={{color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem'}}>
              {modalMode === 'Add' ? 'Schedule a new task or interaction.' : 'Update the details for this scheduled task.'}
            </p>
            
            <form onSubmit={handleSaveEvent}>
              <div className="form-grid">
                
                <div className="form-group" style={{gridColumn: '1 / -1'}}>
                  <label>Associated Lead *</label>
                  <select 
                    required 
                    value={formData.leadId} 
                    onChange={e => setFormData({...formData, leadId: e.target.value})}
                    disabled={modalMode === 'Edit'}
                  >
                    <option value="">Select a Lead...</option>
                    {allowedLeads.map(l => (
                      <option key={l.id} value={l.id}>{l.customer} ({l.id})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Task Type *</label>
                  <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                    <option value="Call">Call</option>
                    <option value="Visit">Visit</option>
                    <option value="Document">Document</option>
                    <option value="Payment">Payment</option>
                    <option value="Task">Task (Generic)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status *</label>
                  <select required value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Due Today">Due Today</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Time</label>
                  <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                </div>

                <div className="form-group" style={{gridColumn: '1 / -1'}}>
                  <label>Notes</label>
                  <textarea 
                    placeholder="Additional details..."
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                  ></textarea>
                </div>

              </div>

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{modalMode === 'Add' ? 'Add Follow-up' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
