import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, Calendar, Clock, Search, Filter, Plus, 
  ChevronRight, MoreVertical, AlertCircle, CheckCircle2, User as UserIcon
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import type { Task, TaskType, TaskStatus, TaskPriority } from './context/CRMContext';
import { useUI } from './context/UIContext';
import './LeadsPage.css'; // Reusing styles

interface TasksPageProps {
  onNavigate?: (path: string, filters?: any) => void;
  filter?: string;
}

export default function TasksPage({ onNavigate, filter }: TasksPageProps) {
  const { tasks, currentUser, users, leads, addTask, updateTask, addActivity } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'All'>('All');
  const [timeFilter, setTimeFilter] = useState<string>(filter || 'All');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // New Task Form
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    taskType: 'General Task' as TaskType,
    priority: 'Medium' as TaskPriority,
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '',
    assignedToUserId: currentUser?.id || '',
    leadId: ''
  });

  // Role-based visibility
  const visibleTasks = useMemo(() => {
    if (!currentUser) return [];
    
    return tasks.filter(t => {
      if (currentUser.role === 'Admin') return true;
      if (currentUser.role === 'Employee' || currentUser.role === 'Dealer') {
        return t.assignedToUserId === currentUser.id || t.createdByUserId === currentUser.id;
      }
      return false;
    });
  }, [tasks, currentUser]);

  const filteredTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    return visibleTasks.filter(t => {
      // Time filter
      if (timeFilter === 'Today') {
        if (t.dueDate !== today) return false;
      } else if (timeFilter === 'Upcoming') {
        if (t.dueDate <= today || t.status === 'Completed') return false;
      } else if (timeFilter === 'Overdue') {
        if (t.dueDate >= today || t.status === 'Completed') return false;
      } else if (timeFilter === 'Completed') {
        if (t.status !== 'Completed') return false;
      }

      // Status & Priority
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;

      // Search
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(lower);
        const matchesDesc = t.description?.toLowerCase().includes(lower);
        
        let matchesLead = false;
        if (t.leadId) {
          const l = leads.find(lead => lead.id === t.leadId);
          if (l && l.customer.toLowerCase().includes(lower)) matchesLead = true;
        }

        if (!matchesTitle && !matchesDesc && !matchesLead) return false;
      }

      return true;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [visibleTasks, timeFilter, statusFilter, priorityFilter, searchTerm, leads]);

  const isOverdue = (task: Task) => {
    const today = new Date().toISOString().split('T')[0];
    return task.dueDate < today && task.status !== 'Completed';
  };

  const handleCreateTask = () => {
    if (!newTaskForm.title || !newTaskForm.dueDate || !newTaskForm.assignedToUserId) {
      showToast('Please fill required fields', 'error');
      return;
    }

    addTask({
      title: newTaskForm.title,
      description: newTaskForm.description,
      taskType: newTaskForm.taskType,
      status: 'Pending',
      priority: newTaskForm.priority,
      dueDate: newTaskForm.dueDate,
      dueTime: newTaskForm.dueTime,
      assignedToUserId: newTaskForm.assignedToUserId,
      assignedByUserId: currentUser?.id || '',
      leadId: newTaskForm.leadId || undefined,
      createdByUserId: currentUser?.id || ''
    });

    showToast('Task created successfully', 'success');
    setShowCreateModal(false);
    setNewTaskForm({
      title: '', description: '', taskType: 'General Task', priority: 'Medium',
      dueDate: new Date().toISOString().split('T')[0], dueTime: '',
      assignedToUserId: currentUser?.id || '', leadId: ''
    });
  };

  const handleMarkComplete = (task: Task) => {
    updateTask(task.id, { 
      status: 'Completed', 
      completedAt: new Date().toISOString() 
    });
    
    if (task.leadId) {
      const l = leads.find(lead => lead.id === task.leadId);
      addActivity({
        type: 'Task Completed',
        message: `${currentUser?.role || 'User'} completed task: ${task.title}`,
        user: currentUser?.name || 'System',
        leadId: task.leadId,
        dealer: l?.dealer
      });
    }
    
    showToast('Task marked as completed', 'success');
    if (selectedTask?.id === task.id) {
      setSelectedTask(null);
      setShowDetailModal(false);
    }
  };

  const openDetail = (t: Task) => {
    setSelectedTask(t);
    setShowDetailModal(true);
  };

  return (
    <div className="leads-page fade-in" style={{padding: '1rem', width: '100%', boxSizing: 'border-box', overflowY: 'auto'}}>
      <div className="page-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem'}}>
        <div>
          <h1 style={{fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem 0'}}>Tasks</h1>
          <p style={{color: '#64748b', margin: 0, fontSize: '0.9rem'}}>Manage and track your work</p>
        </div>
        <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
          {onNavigate && (
            <button 
              className="btn-outline" 
              onClick={() => onNavigate(currentUser?.role === 'Admin' ? 'Calendar' : `/${currentUser?.role.toLowerCase()}/calendar`)} 
              style={{minHeight: '40px'}}
            >
              <Calendar size={18} style={{marginRight: '0.5rem'}} /> Calendar
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowCreateModal(true)} style={{minHeight: '40px'}}>
            <Plus size={18} style={{marginRight: '0.5rem'}} /> Create Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-container" style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', background: '#fff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
        <div className="search-box" style={{flex: '1 1 100%', minWidth: '0'}}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            className="search-input"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select className="filter-select" style={{flex: '1 1 120px'}} value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
          <option value="All">All Time</option>
          <option value="Today">Today</option>
          <option value="Upcoming">Upcoming</option>
          <option value="Overdue">Overdue</option>
          <option value="Completed">Completed</option>
        </select>
        
        <select className="filter-select" style={{flex: '1 1 120px'}} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>

        <select className="filter-select" style={{flex: '1 1 120px'}} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)}>
          <option value="All">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Tasks List */}
      <div className="table-responsive" style={{borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white'}}>
        <table className="leads-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Due Date</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Related To</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length > 0 ? filteredTasks.map(t => {
              const overdue = isOverdue(t);
              const assignedUser = users.find(u => u.id === t.assignedToUserId);
              const lead = t.leadId ? leads.find(l => l.id === t.leadId) : null;
              
              return (
                <tr key={t.id} onClick={() => openDetail(t)} style={{cursor: 'pointer'}}>
                  <td>
                    <div style={{fontWeight: 600, color: '#1e293b'}}>{t.title}</div>
                    <div style={{fontSize: '0.8rem', color: '#64748b'}}>{t.taskType}</div>
                  </td>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.25rem', color: overdue ? '#ef4444' : '#475569', fontWeight: overdue ? 600 : 400, whiteSpace: 'nowrap'}}>
                      <Clock size={14} /> 
                      {t.dueDate} {t.dueTime && t.dueTime}
                      {overdue && <span style={{fontSize: '0.7rem', background: '#fee2e2', color: '#dc2626', padding: '0.1rem 0.3rem', borderRadius: '4px', marginLeft: '0.25rem'}}>Overdue</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`priority-badge ${t.priority.toLowerCase()}`}>{t.priority}</span>
                  </td>
                  <td>
                    <span className={`stage-badge ${t.status === 'Completed' ? 'completed' : 'lead'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap'}}>
                      <UserIcon size={14} color="#64748b"/>
                      {assignedUser?.name || 'Unknown'}
                    </div>
                  </td>
                  <td>
                    {lead ? (
                      <span style={{color: '#3b82f6', fontSize: '0.85rem', whiteSpace: 'nowrap'}}>{lead.customer}</span>
                    ) : (
                      <span style={{color: '#94a3b8', fontSize: '0.85rem'}}>-</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {t.status !== 'Completed' && (
                      <button className="btn-outline" style={{padding: '0.35rem 0.6rem', fontSize: '0.75rem', minHeight: '34px'}} onClick={() => handleMarkComplete(t)}>
                        <CheckSquare size={14} style={{marginRight: '0.25rem'}}/> Complete
                      </button>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7} style={{textAlign: 'center', padding: '3rem', color: '#64748b'}}>
                  <CheckSquare size={32} color="#cbd5e1" style={{margin: '0 auto 1rem auto', display: 'block'}} />
                  <p>No tasks found.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTask && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" style={{maxWidth: '500px', width: '95vw', padding: '1.25rem 1rem'}} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem'}}>
              <h2 style={{fontSize: '1.25rem', margin: 0}}>{selectedTask.title}</h2>
              <span className={`stage-badge ${selectedTask.status === 'Completed' ? 'completed' : 'lead'}`}>
                {selectedTask.status}
              </span>
            </div>
            
            <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem'}}>
              <div>
                <div style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase'}}>Due Date</div>
                <div style={{color: isOverdue(selectedTask) ? '#ef4444' : '#1e293b', fontWeight: 600, fontSize: '0.9rem'}}>
                  {selectedTask.dueDate} {selectedTask.dueTime}
                </div>
              </div>
              <div>
                <div style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase'}}>Priority</div>
                <div><span className={`priority-badge ${selectedTask.priority.toLowerCase()}`}>{selectedTask.priority}</span></div>
              </div>
              <div>
                <div style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase'}}>Type</div>
                <div style={{color: '#1e293b', fontSize: '0.9rem'}}>{selectedTask.taskType}</div>
              </div>
              <div>
                <div style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase'}}>Assigned To</div>
                <div style={{color: '#1e293b', fontSize: '0.9rem'}}>{users.find(u => u.id === selectedTask.assignedToUserId)?.name || 'Unknown'}</div>
              </div>
              {selectedTask.leadId && (
                <div style={{gridColumn: '1 / -1'}}>
                  <div style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase'}}>Related Project/Lead</div>
                  <div style={{color: '#3b82f6', fontWeight: 600, fontSize: '0.9rem'}}>{leads.find(l => l.id === selectedTask.leadId)?.customer || 'Unknown'}</div>
                </div>
              )}
            </div>

            {selectedTask.description && (
              <div style={{marginBottom: '1.5rem'}}>
                <div style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem'}}>Description</div>
                <p style={{whiteSpace: 'pre-wrap', color: '#334155', margin: 0, fontSize: '0.95rem'}}>{selectedTask.description}</p>
              </div>
            )}

            <div className="modal-actions" style={{flexDirection: 'column-reverse', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem'}}>
              <button className="btn-outline" style={{width: '100%', justifyContent: 'center', minHeight: '44px'}} onClick={() => setShowDetailModal(false)}>Close</button>
              {selectedTask.status !== 'Completed' && (
                <button className="btn-primary" style={{width: '100%', justifyContent: 'center', minHeight: '44px'}} onClick={() => handleMarkComplete(selectedTask)}>Mark as Complete</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px', width: '95vw', padding: '1.25rem 1rem'}}>
            <h2 style={{fontSize: '1.3rem', margin: '0 0 0.5rem 0'}}>Create Task</h2>
            <p style={{marginBottom: '1.25rem', color: '#64748b', fontSize: '0.9rem'}}>Schedule a new task for yourself or a team member.</p>
            
            <div className="form-group">
              <label>Task Title *</label>
              <input type="text" value={newTaskForm.title} onChange={e => setNewTaskForm({...newTaskForm, title: e.target.value})} placeholder="e.g. Review Feasibility Report" />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Task Type *</label>
                <select value={newTaskForm.taskType} onChange={e => setNewTaskForm({...newTaskForm, taskType: e.target.value as any})}>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Project Work">Project Work</option>
                  <option value="Document Required">Document Required</option>
                  <option value="Document Review">Document Review</option>
                  <option value="Customer Visit">Customer Visit</option>
                  <option value="Installation">Installation</option>
                  <option value="Payment">Payment</option>
                  <option value="General Task">General Task</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={newTaskForm.priority} onChange={e => setNewTaskForm({...newTaskForm, priority: e.target.value as any})}>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Due Date *</label>
                <input type="date" value={newTaskForm.dueDate} onChange={e => setNewTaskForm({...newTaskForm, dueDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Time (Optional)</label>
                <input type="time" value={newTaskForm.dueTime} onChange={e => setNewTaskForm({...newTaskForm, dueTime: e.target.value})} />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Assign To *</label>
                <select 
                  value={newTaskForm.assignedToUserId} 
                  onChange={e => setNewTaskForm({...newTaskForm, assignedToUserId: e.target.value})}
                  disabled={currentUser?.role !== 'Admin'} // Only Admin can assign to others
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Related Project/Lead</label>
                <select value={newTaskForm.leadId} onChange={e => setNewTaskForm({...newTaskForm, leadId: e.target.value})}>
                  <option value="">None</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.customer} ({l.leadType === 'project' ? 'Project' : 'Tracking'})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea 
                value={newTaskForm.description} 
                onChange={e => setNewTaskForm({...newTaskForm, description: e.target.value})} 
                placeholder="Additional details..."
                style={{minHeight: '80px', padding: '0.5rem', width: '100%', border: '1px solid #e2e8f0', borderRadius: '4px'}}
              />
            </div>

            <div className="modal-actions" style={{marginTop: '1.5rem', flexDirection: 'column-reverse', gap: '0.5rem'}}>
              <button className="btn-outline" style={{width: '100%', justifyContent: 'center', minHeight: '44px'}} onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn-primary" style={{width: '100%', justifyContent: 'center', minHeight: '44px'}} onClick={handleCreateTask} disabled={!newTaskForm.title || !newTaskForm.dueDate}>Create Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
