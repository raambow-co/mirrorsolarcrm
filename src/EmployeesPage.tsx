import React, { useState, useMemo } from 'react';
import { 
  Users, Activity, Target, Bell, Plus, Search, ChevronRight, X
} from 'lucide-react';
import { useCRM, STAGES } from './context/CRMContext';
import type { Employee, EmployeeStatus } from './context/CRMContext';
import { useUI } from './context/UIContext';
import './EmployeesPage.css';

export default function EmployeesPage() {
  const { leads, employees, addEmployee, activities, currentUser, addActivity } = useCRM();
  const { showToast } = useUI();

  // --- States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [workloadFilter, setWorkloadFilter] = useState('All');
  
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // --- Derived Data ---
  const activeEmployeesCount = employees.filter(e => e.status === 'Active').length;
  const totalAssignedLeads = leads.length; // Actually total leads in system
  
  // Follow-ups due correctly calculated from leads
  const followUpsDue = leads.filter(l => l.followUp && (l.followUp.status === 'Due Today' || l.followUp.status === 'Overdue')).length; 

  // Helper: compute stats per employee
  const getEmployeeStats = (empName: string) => {
    const empLeads = leads.filter(l => l.assignedEmployee === empName);
    const assigned = empLeads.length;
    const active = empLeads.filter(l => l.stage !== 'Converted' && l.stage !== 'Completed' && !l.archived).length;
    const converted = empLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length;
    
    const stageCounts: Record<string, number> = {};
    STAGES.forEach(s => stageCounts[s] = 0);
    empLeads.forEach(l => { stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1; });

    // Mock workload percentage (e.g., 30 assigned = 100%)
    let workloadPct = Math.floor((assigned / 30) * 100);
    if (workloadPct > 100) workloadPct = 100;
    
    let wlStatus = 'healthy';
    if (workloadPct >= 60) wlStatus = 'moderate';
    if (workloadPct >= 80) wlStatus = 'high';

    let wlLabel = 'Light';
    if (wlStatus === 'moderate') wlLabel = 'Moderate';
    if (wlStatus === 'high') wlLabel = 'High';

    return { assigned, active, converted, stageCounts, workloadPct, wlStatus, wlLabel, empLeads };
  };

  // --- Filtering ---
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = emp.name.toLowerCase().includes(q) || 
                            emp.id.toLowerCase().includes(q) ||
                            emp.phone.toLowerCase().includes(q) ||
                            emp.email.toLowerCase().includes(q);
      
      const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;
      
      const stats = getEmployeeStats(emp.name);
      const matchesWorkload = workloadFilter === 'All' || stats.wlLabel === workloadFilter;

      return matchesSearch && matchesStatus && matchesWorkload;
    });
  }, [employees, searchQuery, statusFilter, workloadFilter, leads]);

  // --- Add Employee Form ---
  const [newEmp, setNewEmp] = useState({ name: '', phone: '', email: '', status: 'Active' });

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmp.name.trim()) {
      addEmployee({
        name: newEmp.name,
        initials: newEmp.name.substring(0, 2).toUpperCase(),
        phone: newEmp.phone || '+91 00000 00000',
        email: newEmp.email || '-',
        status: newEmp.status as EmployeeStatus,
        lastActive: 'Just now'
      });
      addActivity({
        type: 'Employee Updated',
        message: `Added new employee ${newEmp.name}`,
        user: currentUser?.name || 'Admin',
        employee: newEmp.name
      });
      showToast('Employee added successfully', 'success');
      setIsAddModalOpen(false);
      setNewEmp({ name: '', phone: '', email: '', status: 'Active' });
    }
  };


  return (
    <div className="employees-page">
      {/* Header */}
      <div className="ep-header">
        <div className="ep-header-left">
          <p>Dashboard / Employees</p>
          <h1>Employees</h1>
          <p>Monitor employee workload, assigned leads and daily activity.</p>
        </div>
        <div className="ep-header-right">
          <button className="ep-btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Add Employee
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="ep-summary-grid">
        <div className="ep-summary-card">
          <div className="ep-card-header">
            <span className="ep-card-title">Total Employees</span>
            <div className="ep-card-icon navy"><Users size={20} /></div>
          </div>
          <div className="ep-card-value">{employees.length}</div>
          <div className="ep-card-footer neutral">+1 this month</div>
          <div className="ep-card-bottom-accent navy"></div>
        </div>

        <div className="ep-summary-card">
          <div className="ep-card-header">
            <span className="ep-card-title">Active Today</span>
            <div className="ep-card-icon green"><Activity size={20} /></div>
          </div>
          <div className="ep-card-value">{activeEmployeesCount}</div>
          <div className="ep-card-footer positive">Looking good</div>
          <div className="ep-card-bottom-accent green"></div>
        </div>

        <div className="ep-summary-card">
          <div className="ep-card-header">
            <span className="ep-card-title">Leads Assigned</span>
            <div className="ep-card-icon yellow"><Target size={20} /></div>
          </div>
          <div className="ep-card-value">{totalAssignedLeads}</div>
          <div className="ep-card-footer neutral">Across all stages</div>
          <div className="ep-card-bottom-accent yellow"></div>
        </div>

        <div className="ep-summary-card">
          <div className="ep-card-header">
            <span className="ep-card-title">Follow-Ups Due</span>
            <div className="ep-card-icon orange"><Bell size={20} /></div>
          </div>
          <div className="ep-card-value">{followUpsDue}</div>
          <div className="ep-card-footer neutral">Needs attention</div>
          <div className="ep-card-bottom-accent orange"></div>
        </div>
      </div>

      {/* Workload Overview (Show first 3 for visual variety) */}
      <div>
        <h2 className="ep-section-title">Employee Workload</h2>
        <div className="ep-workload-grid">
          {employees.slice(0, 3).map(emp => {
            const stats = getEmployeeStats(emp.name);
            return (
              <div key={emp.id} className="ep-workload-card">
                <div className="ep-wl-header">
                  <div className="ep-wl-emp">
                    <div className="ep-avatar">{emp.initials}</div>
                    <div>
                      <h3 className="ep-emp-name">{emp.name}</h3>
                      <p className="ep-emp-id">{emp.id}</p>
                    </div>
                  </div>
                  <div className={`ep-status-pill ${emp.status.toLowerCase()}`}>
                    <div className="status-dot"></div>
                    {emp.status}
                  </div>
                </div>

                <div className="ep-wl-stats">
                  <div className="ep-stat-item">
                    <span className="ep-stat-val">{stats.assigned}</span>
                    <span className="ep-stat-lbl">Assigned</span>
                  </div>
                  <div className="ep-stat-item">
                    <span className="ep-stat-val">{stats.active}</span>
                    <span className="ep-stat-lbl">Active</span>
                  </div>
                  <div className="ep-stat-item">
                    <span className="ep-stat-val">{stats.converted}</span>
                    <span className="ep-stat-lbl">Converted</span>
                  </div>
                </div>

                <div className="ep-wl-pipeline">
                  {STAGES.map(stage => {
                    if (stats.stageCounts[stage] === 0) return null;
                    const pct = (stats.stageCounts[stage] / stats.assigned) * 100;
                    return (
                      <div key={stage} className="ep-pipe-row">
                        <span className="ep-pipe-lbl">{stage.substring(0, 8)}</span>
                        <div className="ep-pipe-bar-container">
                          <div className="ep-pipe-bar" style={{ width: `${pct}%`, background: 'var(--color-navy)' }}></div>
                        </div>
                        <span className="ep-pipe-val">{stats.stageCounts[stage]}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="ep-wl-footer">
                  <span className="ep-last-active">Last activity: {emp.lastActive}</span>
                  <span className="ep-view-link" onClick={() => setSelectedEmployee(emp)}>
                    View Details <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Directory Table */}
      <div className="ep-directory-panel">
        <div className="ep-dir-header">
          <h2 className="ep-section-title" style={{ margin: 0 }}>Employee Directory</h2>
          <div className="ep-dir-filters">
            <div className="ep-search">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search employees..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="ep-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Away">Away</option>
              <option value="Offline">Offline</option>
            </select>
            <select className="ep-select" value={workloadFilter} onChange={e => setWorkloadFilter(e.target.value)}>
              <option value="All">All Workload</option>
              <option value="Light">Light</option>
              <option value="Moderate">Moderate</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div className="ep-table-container">
          <table className="ep-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Active</th>
                <th>Converted</th>
                <th>Workload</th>
                <th>Last Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => {
                const stats = getEmployeeStats(emp.name);
                return (
                  <tr key={emp.id}>
                    <td data-label="Employee">
                      <div className="ep-table-emp">
                        <div className="ep-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
                          {emp.initials}
                        </div>
                        <div className="ep-table-emp-info">
                          <span className="ep-table-emp-name">{emp.name}</span>
                          <span className="ep-table-emp-id">{emp.id}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Status">
                      <div className={`ep-status-pill ${emp.status.toLowerCase()}`}>
                        <div className="status-dot"></div>
                        {emp.status}
                      </div>
                    </td>
                    <td data-label="Assigned"><span className="ep-table-stat">{stats.assigned}</span></td>
                    <td data-label="Active"><span className="ep-table-stat">{stats.active}</span></td>
                    <td data-label="Converted"><span className="ep-table-stat">{stats.converted}</span></td>
                    <td data-label="Workload">
                      <div className="ep-wl-progress-container">
                        <div className="ep-wl-progress-bar">
                          <div className={`ep-wl-fill ${stats.wlStatus}`} style={{ width: `${stats.workloadPct}%` }}></div>
                        </div>
                        <span className={`ep-wl-text ${stats.wlStatus}`}>{stats.workloadPct}%</span>
                      </div>
                    </td>
                    <td data-label="Last Active" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{emp.lastActive}</td>
                    <td data-label="Action">
                      <button className="ep-action-btn" onClick={() => setSelectedEmployee(emp)}>
                        View <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No employees found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Detail Slide Panel */}
      {selectedEmployee && (
        <div className="ep-detail-overlay" onClick={() => setSelectedEmployee(null)}>
          <div className="ep-detail-panel" onClick={e => e.stopPropagation()}>
            <div className="ep-detail-header">
              <h2>Employee Details</h2>
              <button className="ep-close-btn" onClick={() => setSelectedEmployee(null)}><X size={20} /></button>
            </div>
            
            <div className="ep-detail-content">
              {(() => {
                const stats = getEmployeeStats(selectedEmployee.name);
                return (
                  <>
                    <div className="ep-detail-profile">
                      <div className="ep-avatar">{selectedEmployee.initials}</div>
                      <div className="ep-detail-info">
                        <h3>{selectedEmployee.name}</h3>
                        <p>{selectedEmployee.id} • {selectedEmployee.phone}</p>
                        <div className={`ep-status-pill ${selectedEmployee.status.toLowerCase()}`}>
                          <div className="status-dot"></div>
                          {selectedEmployee.status}
                        </div>
                      </div>
                    </div>

                    <div className="ep-detail-metrics">
                      <div className="ep-metric-box">
                        <span className="val">{stats.assigned}</span>
                        <span className="lbl">Leads Handled</span>
                      </div>
                      <div className="ep-metric-box">
                        <span className="val">{stats.converted}</span>
                        <span className="lbl">Conversions</span>
                      </div>
                      <div className="ep-metric-box">
                        <span className="val">{stats.assigned > 0 ? Math.round((stats.converted / stats.assigned) * 100) : 0}%</span>
                        <span className="lbl">Conversion Rate</span>
                      </div>
                      <div className="ep-metric-box">
                        <span className="val">{Math.floor(stats.active * 0.4)}</span>
                        <span className="lbl">Follow-ups</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="ep-section-subtitle">Pipeline Distribution</h4>
                      <div className="ep-wl-pipeline">
                        {STAGES.map((stage, i) => {
                          const count = stats.stageCounts[stage];
                          const pct = stats.assigned > 0 ? (count / stats.assigned) * 100 : 0;
                          const colors = ['#0B1F3A', '#16a34a', '#d97706', '#f59e0b', '#3b82f6', '#8b5cf6'];
                          return (
                            <div key={stage} className="ep-pipe-row" style={{ marginBottom: '8px' }}>
                              <span className="ep-pipe-lbl" style={{ width: '90px' }}>{stage}</span>
                              <div className="ep-pipe-bar-container">
                                <div className="ep-pipe-bar" style={{ width: `${pct}%`, background: colors[i] }}></div>
                              </div>
                              <span className="ep-pipe-val">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="ep-section-subtitle">Current Work</h4>
                      <div className="ep-work-list">
                        {stats.empLeads.slice(0, 3).map(lead => (
                          <div key={lead.id} className="ep-work-item">
                            <div className="ep-work-item-info">
                              <strong>{lead.customer}</strong>
                              <span>{lead.dealer} • {lead.updatedAt}</span>
                            </div>
                            <span className="ep-work-item-stage">{lead.stage}</span>
                          </div>
                        ))}
                        {stats.empLeads.length > 3 && (
                          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                            + {stats.empLeads.length - 3} more leads
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="ep-section-subtitle">Recent Activity</h4>
                      <div className="ep-activity-list">
                        {activities.filter(a => a.employee === selectedEmployee.name || a.user === selectedEmployee.name).slice(0, 3).map(act => (
                          <div className="ep-activity-item" key={act.id}>
                            <div className="ep-activity-dot"></div>
                            <div className="ep-activity-content">
                              <p>{act.message}</p>
                              <span>{act.createdAt}</span>
                            </div>
                          </div>
                        ))}
                        {activities.filter(a => a.employee === selectedEmployee.name || a.user === selectedEmployee.name).length === 0 && (
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

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="ep-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="ep-modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: 0, color: 'var(--color-navy)', fontSize: '1.25rem', fontWeight: 800 }}>Add Employee</h2>
            <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="ep-form-group">
                <label>Full Name</label>
                <input required type="text" placeholder="e.g. Rahul Sharma" value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} />
              </div>
              <div className="ep-form-group">
                <label>Phone Number (Optional)</label>
                <input type="text" placeholder="+91" value={newEmp.phone} onChange={e => setNewEmp({...newEmp, phone: e.target.value})} />
              </div>
              <div className="ep-form-group">
                <label>Email (Optional)</label>
                <input type="email" placeholder="rahul@mirrorsolar.in" value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} />
              </div>
              <div className="ep-form-group">
                <label>Status</label>
                <select value={newEmp.status} onChange={e => setNewEmp({...newEmp, status: e.target.value})}>
                  <option value="Active">Active</option>
                  <option value="Away">Away</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>
              <div className="ep-modal-actions">
                <button type="button" className="ep-btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="ep-btn-primary">Add Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
