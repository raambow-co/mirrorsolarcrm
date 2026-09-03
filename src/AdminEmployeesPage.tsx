import { useState, useMemo } from 'react';
import { 
  Users, Search, Plus, X, Activity, UserPlus, 
  Phone, Mail, FileText, CheckCircle2, TrendingUp, AlertTriangle, List, ArrowRight
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import { useUI } from './context/UIContext';
import type { Employee } from './context/CRMContext';
import { 
  getEmployeePerformance, 
  getEmployeeActivity, 
  getEmployeeDealers,
  getEmployeePipeline,
  getEmployeeFollowUps
} from './utils/employeeCalculations';
import './AdminEmployeesPage.css';

interface AdminEmployeesPageProps {
  onNavigateToLeads?: (employeeName: string, stage?: string) => void;
  onNavigateToAccess?: (employeeId: string) => void;
}

export default function AdminEmployeesPage({ onNavigateToLeads, onNavigateToAccess }: AdminEmployeesPageProps) {
  const { leads, employees, dealers, activities, addEmployee, updateEmployee, updateLead, addActivity, currentUser } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [workloadFilter, setWorkloadFilter] = useState('All');
  const [performanceFilter, setPerformanceFilter] = useState('All');
  const [dealerFilter, setDealerFilter] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Modals & Panels
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  // Note state
  const [newNote, setNewNote] = useState('');

  const [formData, setFormData] = useState({
    name: '', id: '', email: '', phone: '', status: 'Active'
  });

  const [assignForm, setAssignForm] = useState({
    leadId: '', newEmployee: ''
  });

  const processedEmployees = useMemo(() => {
    return employees.map(emp => {
      const perf = getEmployeePerformance(emp.name, leads);
      return { ...emp, ...perf };
    });
  }, [employees, leads]);

  const topEmployees = useMemo(() => {
    return [...processedEmployees]
      .filter(e => e.status === 'Active')
      .sort((a, b) => {
        if (b.convertedLeads !== a.convertedLeads) return b.convertedLeads - a.convertedLeads;
        if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
        return b.totalLeads - a.totalLeads;
      })
      .slice(0, 3);
  }, [processedEmployees]);

  const workloadCounts = useMemo(() => {
    let light = 0, normal = 0, heavy = 0;
    processedEmployees.forEach(e => {
      if (e.status !== 'Active') return;
      if (e.workload === 'Heavy') heavy++;
      else if (e.workload === 'Normal') normal++;
      else light++;
    });
    return { light, normal, heavy, total: light + normal + heavy };
  }, [processedEmployees]);

  const leadDistribution = useMemo(() => {
    return [...processedEmployees]
      .filter(e => e.status === 'Active')
      .sort((a, b) => b.totalLeads - a.totalLeads)
      .slice(0, 5); // Top 5 by volume
  }, [processedEmployees]);

  const maxLeadCount = Math.max(...leadDistribution.map(e => e.totalLeads), 1);

  const filteredEmployees = useMemo(() => {
    let result = processedEmployees.filter(emp => {
      const q = searchQuery.toLowerCase();
      if (q && !(
        emp.name.toLowerCase().includes(q) || 
        emp.id.toLowerCase().includes(q) || 
        emp.email.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q)
      )) return false;

      if (statusFilter !== 'All' && emp.status !== statusFilter) return false;
      if (workloadFilter !== 'All' && emp.workload !== workloadFilter) return false;
      if (performanceFilter !== 'All' && emp.performanceLevel !== performanceFilter) return false;
      
      if (dealerFilter !== 'All') {
        const dDealers = getEmployeeDealers(emp.name, leads);
        if (!dDealers.some(d => d.name === dealerFilter)) return false;
      }
      
      return true;
    });
    
    // Sort logic (Active first, then by name)
    result.sort((a, b) => {
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (b.status === 'Active' && a.status !== 'Active') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return result;
  }, [processedEmployees, searchQuery, statusFilter, workloadFilter, performanceFilter, dealerFilter, leads]);

  const hasActiveFilters = searchQuery || statusFilter !== 'All' || workloadFilter !== 'All' || performanceFilter !== 'All' || dealerFilter !== 'All';
  const clearFilters = () => {
    setSearchQuery(''); setStatusFilter('All'); setWorkloadFilter('All'); setPerformanceFilter('All'); setDealerFilter('All');
  };

  const totalPages = Math.ceil(filteredEmployees.length / PAGE_SIZE) || 1;
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);

  const totals = useMemo(() => {
    return {
      total: employees.length,
      active: employees.filter(e => e.status === 'Active').length,
      assignedLeads: leads.filter(l => !l.archived && l.assignedEmployee).length,
      followupsDue: leads.filter(l => !l.archived && (l.followUp?.status === 'Due Today' || l.followUp?.status === 'Overdue')).length
    };
  }, [employees, leads]);

  const handleOpenAddModal = () => {
    setFormData({ name: '', id: '', email: '', phone: '', status: 'Active' });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setFormData({ 
      name: emp.name, id: emp.id, email: emp.email, phone: emp.phone, status: emp.status
    });
    setIsEditModalOpen(true);
  };

  const handleAddSubmit = () => {
    if (employees.some(e => e.id === formData.id)) {
      showToast('Employee ID already exists.', 'error');
      return;
    }
    const initials = formData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    addEmployee({
      name: formData.name, email: formData.email, phone: formData.phone, 
      status: formData.status as any,
      initials, lastActive: 'Just now'
    });
    showToast('Employee added successfully.', 'success');
    addActivity({ type: 'Employee Added', message: `New employee added: ${formData.name}`, user: currentUser?.name || 'Admin' });
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = () => {
    if (!selectedEmployee) return;
    updateEmployee(selectedEmployee.id, {
      name: formData.name, email: formData.email, phone: formData.phone, status: formData.status as any
    });
    showToast('Employee details updated.', 'success');
    setIsEditModalOpen(false);
    setSelectedEmployee(employees.find(e => e.id === selectedEmployee.id) || null);
  };

  const toggleEmployeeStatus = (emp: Employee) => {
    const isDeactivating = emp.status === 'Active';
    showConfirmModal(
      isDeactivating ? `Deactivate ${emp.name}?` : `Reactivate ${emp.name}?`, 
      isDeactivating ? 'This employee will no longer be able to access the application or receive new lead assignments. Historical leads and activities remain.' : 'The employee will become available for new assignments and login.',
      () => {
        const newStatus = isDeactivating ? 'Inactive' : 'Active';
        updateEmployee(emp.id, { status: newStatus });
        showToast(`Employee ${newStatus.toLowerCase()} successfully.`, 'success');
        addActivity({ type: 'Employee Status Updated', message: `${emp.name} marked as ${newStatus}`, user: currentUser?.name || 'Admin' });
        setSelectedEmployee(null);
      }
    );
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedEmployee) return;
    addActivity({ type: 'Internal Note', message: newNote, user: currentUser?.name || 'Admin', employee: selectedEmployee.name });
    setNewNote('');
    showToast('Note added', 'success');
  };

  const handleReassignLead = () => {
    if (!selectedEmployee || !assignForm.leadId || !assignForm.newEmployee) return;
    
    const lead = leads.find(l => l.id === assignForm.leadId);
    if (!lead) return;

    showConfirmModal(
      'Reassign Lead?',
      `Reassign ${lead.customer} from ${selectedEmployee.name} to ${assignForm.newEmployee}?`,
      () => {
        updateLead(lead.id, { assignedEmployee: assignForm.newEmployee });
        addActivity({ type: 'Lead Reassigned', message: `Reassigned ${lead.customer} from ${selectedEmployee.name} to ${assignForm.newEmployee}`, user: currentUser?.name || 'Admin', leadId: lead.id });
        showToast('Lead reassigned successfully.', 'success');
        setIsAssignModalOpen(false);
        setAssignForm({ leadId: '', newEmployee: '' });
      }
    );
  };

  return (
    <div className="employees-page fade-in">
      {/* Header */}
      <div className="employees-header">
        <div>
          <div className="employees-breadcrumb">Dashboard / Employees</div>
          <div className="employees-title">
            <h1>Employee Management</h1>
            <p>Monitor employee workload, customer activity and sales performance.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleOpenAddModal}>
          <Plus size={18} /> Add Employee
        </button>
      </div>

      {/* Summary Cards */}
      <div className="employees-summary-grid">
        <div className="employees-summary-card">
          <div className="card-header-row">
            <div className="card-icon navy"><Users size={20} /></div>
            <span className="card-label">Total Employees</span>
          </div>
          <span className="card-value">{totals.total}</span>
        </div>
        <div className="employees-summary-card">
          <div className="card-header-row">
            <div className="card-icon success"><CheckCircle2 size={20} /></div>
            <span className="card-label">Active</span>
          </div>
          <span className="card-value">{totals.active}</span>
        </div>
        <div className="employees-summary-card">
          <div className="card-header-row">
            <div className="card-icon yellow"><List size={20} /></div>
            <span className="card-label">Leads Assigned</span>
          </div>
          <span className="card-value">{totals.assignedLeads}</span>
        </div>
        <div className="employees-summary-card">
          <div className="card-header-row">
            <div className="card-icon orange"><AlertTriangle size={20} /></div>
            <span className="card-label">Follow-ups Due</span>
          </div>
          <span className="card-value">{totals.followupsDue}</span>
        </div>
      </div>


      {/* Lead Distribution */}
      <div className="employees-panel">
        <h2><Users size={20} className="icon" /> Lead Distribution by Employee</h2>
        <div className="lead-dist-wrapper">
          {leadDistribution.map(e => (
            <div key={e.id} className="lead-dist-row">
              <div className="dist-emp-name" title={e.name}>{e.name}</div>
              <div className="dist-bar-container">
                <div 
                  className={`dist-bar-fill ${e.workload === 'Heavy' ? 'heavy' : ''}`} 
                  style={{ width: `${(e.totalLeads / maxLeadCount) * 100}%` }}
                ></div>
              </div>
              <div className="dist-count">{e.totalLeads}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="employees-panel">
        <h2><Users size={20} className="icon" /> All Employees</h2>
        
        <div className="employees-filters-bar">
          <div className="employees-search">
            <Search size={16} color="#64748b" />
            <input type="text" placeholder="Search employees..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <select className="employees-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Away">Away</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select className="employees-filter-select" value={workloadFilter} onChange={e => setWorkloadFilter(e.target.value)}>
            <option value="All">All Workload</option>
            <option value="Heavy">Heavy</option>
            <option value="Normal">Normal</option>
            <option value="Light">Light</option>
          </select>
          <select className="employees-filter-select" value={performanceFilter} onChange={e => setPerformanceFilter(e.target.value)}>
            <option value="All">All Performance</option>
            <option value="High">High (&ge;50%)</option>
            <option value="Medium">Medium (30-49%)</option>
            <option value="Low">Low (&lt;30%)</option>
          </select>
          <select className="employees-filter-select" value={dealerFilter} onChange={e => setDealerFilter(e.target.value)}>
            <option value="All">All Dealers</option>
            {dealers.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="active-filters">
            {searchQuery && <div className="filter-chip">"{searchQuery}" <button onClick={() => setSearchQuery('')}><X size={12}/></button></div>}
            {statusFilter !== 'All' && <div className="filter-chip">{statusFilter} <button onClick={() => setStatusFilter('All')}><X size={12}/></button></div>}
            {workloadFilter !== 'All' && <div className="filter-chip">{workloadFilter} Workload <button onClick={() => setWorkloadFilter('All')}><X size={12}/></button></div>}
            {performanceFilter !== 'All' && <div className="filter-chip">{performanceFilter} Performance <button onClick={() => setPerformanceFilter('All')}><X size={12}/></button></div>}
            {dealerFilter !== 'All' && <div className="filter-chip">{dealerFilter} <button onClick={() => setDealerFilter('All')}><X size={12}/></button></div>}
            <button className="clear-filters-btn" onClick={clearFilters}>Clear All</button>
          </div>
        )}

        <div className="employees-table-wrapper">
          <table className="employees-table">
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>STATUS</th>
                <th>ROLE</th>
                <th>LEADS</th>
                <th>ACTIVE</th>
                <th>CONVERTED</th>
                <th>CONVERSION</th>
                <th>FOLLOW-UPS</th>
                <th>LAST ACTIVITY</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map(emp => (
                <tr key={emp.id} className={emp.status === 'Inactive' ? 'inactive' : ''}>
                  <td>
                    <div className="emp-name-col">
                      <div className="emp-avatar">{emp.initials}</div>
                      <div className="emp-info-text">
                        <span>{emp.name}</span>
                        <span className="emp-id">{emp.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${emp.status.toLowerCase()}`}>{emp.status}</span>
                  </td>
                  <td>{emp.role}</td>
                  <td>{emp.totalLeads}</td>
                  <td>
                    <span className={`workload-badge ${emp.workload.toLowerCase()}`}>
                      {emp.activeLeads} ({emp.workload})
                    </span>
                  </td>
                  <td style={{color: 'var(--color-orange)'}}>{emp.convertedLeads}</td>
                  <td>
                    {emp.totalLeads > 0 ? (
                      <span className={`workload-badge ${emp.performanceLevel.toLowerCase() === 'high' ? 'normal' : emp.performanceLevel.toLowerCase() === 'low' ? 'heavy' : 'light'}`}>
                        {emp.conversionRate}%
                      </span>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td>{getEmployeeFollowUps(emp.name, leads).total}</td>
                  <td className="text-muted text-sm">{emp.lastActive}</td>
                  <td>
                    <button className="btn-action" onClick={() => setSelectedEmployee(emp)}>View →</button>
                  </td>
                </tr>
              ))}
              {paginatedEmployees.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <Users size={48} />
                      <h3>No employees found.</h3>
                      <p>Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          {totalPages > 1 && (
            <div style={{display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem'}}>
              <button className="btn-outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</button>
              <span style={{display: 'flex', alignItems: 'center', fontSize: '0.9rem', fontWeight: 600}}>Page {currentPage} of {totalPages}</span>
              <button className="btn-outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedEmployee && (
        <div className="detail-panel-overlay" onClick={() => setSelectedEmployee(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            
            <div className="detail-header">
              <div className="detail-title-area">
                <div className="emp-avatar">{selectedEmployee.initials}</div>
                <div>
                  <div className="detail-title"><h3>{selectedEmployee.name}</h3></div>
                  <div className="detail-id">{selectedEmployee.id} | <span className={`status-badge ${selectedEmployee.status.toLowerCase()}`}>{selectedEmployee.status}</span></div>
                </div>
              </div>
              <button className="detail-close" onClick={() => setSelectedEmployee(null)}><X size={24}/></button>
            </div>
            
            <div className="detail-body">
              {/* Contact Info */}
              <div className="detail-contact-info">
                <div className="contact-row"><Phone size={16}/> {selectedEmployee.phone}</div>
                <div className="contact-row"><Mail size={16}/> {selectedEmployee.email}</div>
                <div className="contact-row"><Activity size={16}/> Role: {selectedEmployee.role}</div>
              </div>

              {/* Workload & Performance */}
              <div className="detail-section">
                <h4>Workload & Performance</h4>
                <div className="detail-grid">
                  <div className="detail-stat">
                    <label>Total Leads</label>
                    <span>{getEmployeePerformance(selectedEmployee.name, leads).totalLeads}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Active Workload</label>
                    <span className={getEmployeePerformance(selectedEmployee.name, leads).workload === 'Heavy' ? 'text-red' : ''}>
                      {getEmployeePerformance(selectedEmployee.name, leads).activeLeads} ({getEmployeePerformance(selectedEmployee.name, leads).workload})
                    </span>
                  </div>
                  <div className="detail-stat">
                    <label>Converted</label>
                    <span style={{color: 'var(--color-orange)'}}>{getEmployeePerformance(selectedEmployee.name, leads).convertedLeads}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Conversion Rate</label>
                    <span>{getEmployeePerformance(selectedEmployee.name, leads).conversionRate}%</span>
                  </div>
                </div>
                
                <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem'}}>
                  <button className="btn-primary" style={{flex: 1, justifyContent: 'center'}} onClick={() => {
                    if (onNavigateToLeads) onNavigateToLeads(selectedEmployee.name);
                  }}>
                    <List size={16} /> View Leads
                  </button>
                  <button className="btn-action" style={{flex: 1, justifyContent: 'center'}} onClick={() => setIsAssignModalOpen(true)}>
                    <UserPlus size={16} /> Assign Leads
                  </button>
                </div>
              </div>

              {/* Lead Pipeline */}
              <div className="detail-section">
                <h4>My Lead Pipeline</h4>
                <div className="pipeline-grid">
                  {Object.entries(getEmployeePipeline(selectedEmployee.name, leads)).map(([stage, count]) => (
                    <div key={stage} className="pipeline-stage-box" onClick={() => {
                      if (onNavigateToLeads) onNavigateToLeads(selectedEmployee.name, stage);
                    }}>
                      <span className="stage-count">{count}</span>
                      <span className="stage-name">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assigned Dealers */}
              <div className="detail-section">
                <h4>Dealer Relationships</h4>
                {getEmployeeDealers(selectedEmployee.name, leads).length > 0 ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                    {getEmployeeDealers(selectedEmployee.name, leads).map(d => (
                      <div key={d.name} style={{display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px'}}>
                        <div style={{fontWeight: 700}}>{d.name}</div>
                        <div style={{color: '#64748b', fontSize: '0.85rem', fontWeight: 600}}>{d.count} Leads</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted text-sm">No dealer relationships currently active.</div>
                )}
              </div>

              {/* Follow Ups */}
              <div className="detail-section">
                <h4>Follow-ups Overview</h4>
                <div className="detail-grid">
                  <div className="detail-stat">
                    <label>Due Today</label>
                    <span style={{color: 'var(--color-orange)'}}>{getEmployeeFollowUps(selectedEmployee.name, leads).dueToday}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Overdue</label>
                    <span style={{color: '#ef4444'}}>{getEmployeeFollowUps(selectedEmployee.name, leads).overdue}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Upcoming</label>
                    <span>{getEmployeeFollowUps(selectedEmployee.name, leads).upcoming}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Completed</label>
                    <span style={{color: '#16a34a'}}>{getEmployeeFollowUps(selectedEmployee.name, leads).completed}</span>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="detail-section">
                <h4>Access Permissions</h4>
                <div className="perm-list">
                  {Object.entries(selectedEmployee.permissions).map(([mod, level]) => (
                    <div key={mod} className={`perm-badge ${level === 'none' ? 'denied' : 'granted'}`}>
                      {mod}: {level}
                    </div>
                  ))}
                </div>
                {onNavigateToAccess && (
                  <button className="btn-outline" style={{marginTop: '1rem'}} onClick={() => onNavigateToAccess(selectedEmployee.id)}>
                    Manage Access <ArrowRight size={14} />
                  </button>
                )}
              </div>

              {/* Recent Activity */}
              <div className="detail-section">
                <h4>Recent Activity</h4>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {getEmployeeActivity(selectedEmployee.name, activities).slice(0, 5).map(act => (
                    <div key={act.id} style={{display: 'flex', gap: '1rem'}}>
                      <div style={{width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b'}}>
                        {act.type.includes('Note') ? <FileText size={16}/> : <Activity size={16}/>}
                      </div>
                      <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                        <span style={{fontWeight: 700, color: 'var(--color-navy)'}}>{act.message}</span>
                        <div style={{fontSize: '0.85rem', color: '#64748b'}}>
                          {act.createdAt} • {act.user}
                        </div>
                      </div>
                    </div>
                  ))}
                  {getEmployeeActivity(selectedEmployee.name, activities).length === 0 && (
                    <div className="text-muted text-sm">No recent activity.</div>
                  )}
                </div>
                
                <div style={{marginTop: '1.5rem', display: 'flex', gap: '0.5rem'}}>
                  <input type="text" placeholder="Add an internal note..." value={newNote} onChange={e => setNewNote(e.target.value)} style={{flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', outline: 'none'}} />
                  <button className="btn-primary" style={{padding: '0.5rem 1rem'}} onClick={handleAddNote}>Save</button>
                </div>
              </div>

              {/* Actions */}
              <div className="detail-section">
                <h4>Manage Profile</h4>
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                  <button className="btn-action" style={{flex: 1}} onClick={() => handleOpenEditModal(selectedEmployee)}>Edit Profile</button>
                  <button className="btn-danger" style={{flex: 1}} onClick={() => toggleEmployeeStatus(selectedEmployee)}>
                    {selectedEmployee.status === 'Active' ? 'Deactivate Employee' : 'Reactivate Employee'}
                  </button>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="modal-overlay" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>
          <div className="employee-modal" onClick={e => e.stopPropagation()}>
            <h2>{isAddModalOpen ? 'Add Employee' : 'Edit Employee'}</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Employee Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Aditya Kumar" />
              </div>
              <div className="form-group">
                <label>Employee ID</label>
                <input type="text" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditModalOpen} placeholder="e.g. EMP01" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
            </div>
            {isEditModalOpen && (
              <div className="form-group">
                <label>Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="Active">Active</option>
                  <option value="Away">Away</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            )}
            
            <div className="modal-actions">
              <button className="btn-action" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>Cancel</button>
              <button className="btn-primary" onClick={isAddModalOpen ? handleAddSubmit : handleEditSubmit}>
                {isAddModalOpen ? 'Add Employee' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign/Reassign Lead Modal */}
      {isAssignModalOpen && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setIsAssignModalOpen(false)}>
          <div className="employee-modal" onClick={e => e.stopPropagation()}>
            <h2>Reassign Lead</h2>
            <p style={{marginBottom: '1.5rem', color: '#64748b', fontSize: '0.9rem'}}>Select a lead currently assigned to {selectedEmployee.name} to reassign it.</p>
            
            <div className="form-group">
              <label>Select Lead</label>
              <select value={assignForm.leadId} onChange={e => setAssignForm({...assignForm, leadId: e.target.value})}>
                <option value="">-- Choose a lead --</option>
                {leads.filter(l => l.assignedEmployee === selectedEmployee.name && !l.archived && l.stage !== 'Completed').map(l => (
                  <option key={l.id} value={l.id}>{l.customer} ({l.stage}) - {l.dealer}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Assign To (New Employee)</label>
              <select value={assignForm.newEmployee} onChange={e => setAssignForm({...assignForm, newEmployee: e.target.value})}>
                <option value="">-- Choose employee --</option>
                {employees.filter(e => e.status === 'Active' && e.id !== selectedEmployee.id).map(e => (
                  <option key={e.id} value={e.name}>{e.name}</option>
                ))}
              </select>
            </div>
            
            <div className="modal-actions">
              <button className="btn-action" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleReassignLead} disabled={!assignForm.leadId || !assignForm.newEmployee}>
                Reassign Lead
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
