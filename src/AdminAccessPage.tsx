import { useState, useMemo } from 'react';
import { 
  Users, Search, X, Shield, CheckCircle2, ArrowRight, Key, ShieldAlert
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import type { User as CRMUser, UserPermissions, PermissionLevel } from './context/CRMContext';
import { useUI } from './context/UIContext';
import './AdminAccessPage.css';

interface AdminAccessPageProps {
  onNavigateToEmployee?: (employeeName: string) => void;
  onNavigateToDealer?: (dealerName: string) => void;
}

// Module keys array for iterating
const MODULES: Array<keyof UserPermissions> = [
  'dashboard', 'leads', 'employees', 'dealers', 'stock', 'reports', 'access', 'profile'
];

export default function AdminAccessPage({ onNavigateToEmployee, onNavigateToDealer }: AdminAccessPageProps) {
  const { users, updateUserPermissions, updateUserStatus, addActivity, currentUser } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [accessFilter, setAccessFilter] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Selected state
  const [selectedUser, setSelectedUser] = useState<CRMUser | null>(null);
  const [isEditPermsOpen, setIsEditPermsOpen] = useState(false);
  const [editPerms, setEditPerms] = useState<UserPermissions | null>(null);

  // Bulk Selection
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Summary Data
  const summary = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.status === 'Active').length,
      employees: users.filter(u => u.role === 'Employee').length,
      dealers: users.filter(u => u.role === 'Dealer').length,
      admins: users.filter(u => u.role === 'Admin').length,
      inactive: users.filter(u => u.status === 'Inactive').length,
    };
  }, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    let result = users.filter(u => {
      const q = searchQuery.toLowerCase();
      if (q && !(
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q) || 
        u.id.toLowerCase().includes(q)
      )) return false;

      if (typeFilter !== 'All') {
        const type = u.role === 'Admin' ? 'Admin' : u.role === 'Dealer' ? 'Dealer' : 'Employee';
        if (type !== typeFilter) return false;
      }
      
      if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      
      if (statusFilter !== 'All' && u.status !== statusFilter) return false;
      
      if (accessFilter !== 'All') {
        const hasAccess = u.status === 'Active';
        if (accessFilter === 'Enabled' && !hasAccess) return false;
        if (accessFilter === 'Disabled' && hasAccess) return false;
      }
      
      return true;
    });

    result.sort((a, b) => {
      if (a.role === 'Admin' && b.role !== 'Admin') return -1;
      if (b.role === 'Admin' && a.role !== 'Admin') return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [users, searchQuery, typeFilter, roleFilter, statusFilter, accessFilter]);

  const hasActiveFilters = searchQuery || typeFilter !== 'All' || roleFilter !== 'All' || statusFilter !== 'All' || accessFilter !== 'All';
  const clearFilters = () => {
    setSearchQuery(''); setTypeFilter('All'); setRoleFilter('All'); setStatusFilter('All'); setAccessFilter('All');
  };

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);

  // Handlers
  const countPerms = (perms: UserPermissions) => {
    return Object.values(perms).filter(p => p !== 'none' && p !== undefined).length;
  };

  const getUserType = (role: string) => {
    if (role === 'Admin') return 'Admin';
    if (role === 'Dealer') return 'Dealer';
    return 'Employee';
  };

  const handleOpenEditPerms = (u: CRMUser) => {
    setEditPerms({ ...u.permissions });
    setIsEditPermsOpen(true);
  };

  const handleSavePerms = () => {
    if (!selectedUser || !editPerms) return;
    updateUserPermissions(selectedUser.id, editPerms);
    addActivity({
      type: 'Permissions Updated',
      message: `${selectedUser.name} permissions updated`,
      user: currentUser?.name || 'Admin'
    });
    showToast('Permissions updated successfully.', 'success');
    setIsEditPermsOpen(false);
    setSelectedUser({ ...selectedUser, permissions: editPerms }); // Update local state for panel
  };

  const handleTogglePerm = (module: keyof UserPermissions, isOn: boolean) => {
    if (!editPerms) return;
    
    // Protect Admin's own access permission
    if (selectedUser?.role === 'Admin' && module === 'access' && !isOn) {
      showToast('Admin access cannot be removed from your own account.', 'error');
      return;
    }

    const defaultOn: Record<string, PermissionLevel> = {
      dashboard: 'view',
      leads: 'edit',
      employees: 'full',
      dealers: 'full',
      stock: 'edit',
      reports: 'view',
      access: 'full',
      profile: 'edit'
    };

    setEditPerms({
      ...editPerms,
      [module]: isOn ? defaultOn[module] : 'none'
    });
  };

  const handleResetDemoAccess = () => {
    if (!selectedUser) return;
    showConfirmModal(
      'Reset Demo Access?',
      'Reset permissions to role defaults?',
      () => {
        const defaults: UserPermissions = {
          dashboard: 'view',
          leads: 'edit',
          employees: selectedUser.role === 'Admin' ? 'full' : 'none',
          dealers: selectedUser.role === 'Admin' ? 'full' : 'none',
          stock: 'edit',
          reports: selectedUser.role === 'Admin' ? 'view' : 'none',
          access: selectedUser.role === 'Admin' ? 'full' : 'none',
          profile: 'edit'
        };
        updateUserPermissions(selectedUser.id, defaults);
        addActivity({
          type: 'Permissions Reset',
          message: `${selectedUser.name} permissions reset to defaults`,
          user: currentUser?.name || 'Admin'
        });
        showToast('Permissions reset to role defaults.', 'success');
        setSelectedUser({ ...selectedUser, permissions: defaults });
      }
    );
  };

  const handleToggleAccess = (u: CRMUser) => {
    if (u.role === 'Admin' && u.id === currentUser?.id && u.status === 'Active') {
      showToast('Admin access cannot be disabled for your own account.', 'error');
      return;
    }
    
    const isDisabling = u.status === 'Active';
    showConfirmModal(
      isDisabling ? 'Disable Access?' : 'Enable Access?',
      isDisabling ? `Disable access for ${u.name}? This user will no longer be able to access the application.` : `Enable access for ${u.name}?`,
      () => {
        const newStatus = isDisabling ? 'Inactive' : 'Active';
        updateUserStatus(u.id, newStatus);
        addActivity({
          type: isDisabling ? 'Access Disabled' : 'Access Enabled',
          message: `${u.name} access ${isDisabling ? 'disabled' : 'enabled'}`,
          user: currentUser?.name || 'Admin'
        });
        showToast(`User access ${isDisabling ? 'disabled' : 'enabled'}.`, 'success');
        if (selectedUser?.id === u.id) {
          setSelectedUser({ ...selectedUser, status: newStatus });
        }
      }
    );
  };

  const handleBulkAccess = (enable: boolean) => {
    if (selectedUserIds.length === 0) return;

    // Filter out the current admin if they are trying to disable themselves
    const usersToUpdate = selectedUserIds.filter(id => {
      const user = users.find(u => u.id === id);
      if (!enable && user?.role === 'Admin' && user.id === currentUser?.id) {
        showToast('Skipping your own Admin account.', 'error');
        return false;
      }
      return true;
    });

    if (usersToUpdate.length === 0) return;

    showConfirmModal(
      enable ? 'Enable Bulk Access?' : 'Disable Bulk Access?',
      `${enable ? 'Enable' : 'Disable'} access for ${usersToUpdate.length} selected users?`,
      () => {
        usersToUpdate.forEach(id => {
          updateUserStatus(id, enable ? 'Active' : 'Inactive');
        });
        addActivity({
          type: 'Bulk Access Update',
          message: `Bulk ${enable ? 'enabled' : 'disabled'} access for ${usersToUpdate.length} users`,
          user: currentUser?.name || 'Admin'
        });
        showToast(`Bulk access updated successfully.`, 'success');
        setSelectedUserIds([]);
      }
    );
  };

  // Generate Matrix
  const matrixUsers = [
    { name: 'Admin', perms: { dashboard: true, leads: true, employees: true, dealers: true, stock: true, reports: true, access: true, profile: true } },
    { name: 'Employee', perms: { dashboard: true, leads: true, employees: false, dealers: false, stock: true, reports: false, access: false, profile: true } },
    { name: 'Dealer', perms: { dashboard: true, leads: true, employees: false, dealers: false, stock: true, reports: false, access: false, profile: true } },
  ];

  return (
    <div className="access-page fade-in">
      {/* Header */}
      <div className="access-header">
        <div>
          <div className="access-breadcrumb">Dashboard / Access</div>
          <div className="access-title">
            <h1>Access & Permissions</h1>
            <p>Control user access, roles and application permissions.</p>
          </div>
        </div>
        <button className="btn-outline" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
          Permission Overview <ArrowRight size={16} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="access-summary-grid">
        <div className="access-panel" style={{padding: '1.25rem'}}>
          <div style={{fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>Total Users</div>
          <div style={{fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem'}}>{summary.total}</div>
        </div>
        <div className="access-panel" style={{padding: '1.25rem'}}>
          <div style={{fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>Active Users</div>
          <div style={{fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: '#16a34a'}}>{summary.active}</div>
        </div>
        <div className="access-panel" style={{padding: '1.25rem'}}>
          <div style={{fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>Employees</div>
          <div style={{fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem'}}>{summary.employees}</div>
        </div>
        <div className="access-panel" style={{padding: '1.25rem'}}>
          <div style={{fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>Dealers</div>
          <div style={{fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem'}}>{summary.dealers}</div>
        </div>
      </div>

      {/* Access Overview */}
      <div className="access-panel">
        <h2><Shield size={20} className="icon" /> Access Overview</h2>
        <div className="overview-bar-container">
          <div className="overview-segment admin" style={{width: `${(summary.admins / summary.total) * 100}%`}}></div>
          <div className="overview-segment employee" style={{width: `${(summary.employees / summary.total) * 100}%`}}></div>
          <div className="overview-segment dealer" style={{width: `${(summary.dealers / summary.total) * 100}%`}}></div>
          <div className="overview-segment inactive" style={{width: `${(summary.inactive / summary.total) * 100}%`}}></div>
        </div>
        <div className="overview-legend">
          <div className="legend-item"><div className="legend-dot admin"></div> Admins ({summary.admins})</div>
          <div className="legend-item"><div className="legend-dot employee"></div> Employees ({summary.employees})</div>
          <div className="legend-item"><div className="legend-dot dealer"></div> Dealers ({summary.dealers})</div>
          <div className="legend-item"><div className="legend-dot inactive"></div> Inactive ({summary.inactive})</div>
        </div>
      </div>

      {/* Main Users Table */}
      <div className="access-panel">
        <h2><Users size={20} className="icon" /> All Users</h2>
        
        <div className="access-filters-bar">
          <div className="access-search">
            <Search size={16} color="#64748b" />
            <input type="text" placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <select className="access-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="All">All User Types</option>
            <option value="Admin">Admin</option>
            <option value="Employee">Employee</option>
            <option value="Dealer">Dealer</option>
          </select>
          <select className="access-filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="All">All Roles</option>
            {Array.from(new Set(users.map(u => u.role))).map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <select className="access-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select className="access-filter-select" value={accessFilter} onChange={e => setAccessFilter(e.target.value)}>
            <option value="All">All Access</option>
            <option value="Enabled">Enabled</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>

        {hasActiveFilters && (
          <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem'}}>
            {searchQuery && <div className="filter-chip">"{searchQuery}" <button onClick={() => setSearchQuery('')}><X size={12}/></button></div>}
            {typeFilter !== 'All' && <div className="filter-chip">{typeFilter} Type <button onClick={() => setTypeFilter('All')}><X size={12}/></button></div>}
            {roleFilter !== 'All' && <div className="filter-chip">{roleFilter} Role <button onClick={() => setRoleFilter('All')}><X size={12}/></button></div>}
            {statusFilter !== 'All' && <div className="filter-chip">{statusFilter} Status <button onClick={() => setStatusFilter('All')}><X size={12}/></button></div>}
            {accessFilter !== 'All' && <div className="filter-chip">{accessFilter} Access <button onClick={() => setAccessFilter('All')}><X size={12}/></button></div>}
            <button className="btn-outline" style={{border: 'none', padding: '0.25rem 0.5rem', fontSize: '0.85rem'}} onClick={clearFilters}>Clear All</button>
          </div>
        )}

        <div className="access-table-wrapper">
          <table className="access-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input type="checkbox" 
                    checked={paginatedUsers.length > 0 && selectedUserIds.length === paginatedUsers.length} 
                    onChange={e => {
                      if (e.target.checked) setSelectedUserIds(paginatedUsers.map(u => u.id));
                      else setSelectedUserIds([]);
                    }}
                  />
                </th>
                <th>USER</th>
                <th>TYPE</th>
                <th>ROLE</th>
                <th>STATUS</th>
                <th>PERMISSIONS</th>
                <th>LAST ACTIVITY</th>
                <th>ACCESS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map(u => {
                const userType = getUserType(u.role);
                const isEnabled = u.status === 'Active';
                return (
                  <tr key={u.id} className={!isEnabled ? 'inactive' : ''}>
                    <td>
                      <input type="checkbox" 
                        checked={selectedUserIds.includes(u.id)} 
                        onChange={e => {
                          if (e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                          else setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                        }}
                      />
                    </td>
                    <td>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                        <span style={{fontWeight: 700, color: 'var(--color-navy)'}}>{u.name}</span>
                        <span style={{fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace'}}>{u.id}</span>
                      </div>
                    </td>
                    <td><span className={`type-badge ${userType.toLowerCase()}`}>{userType}</span></td>
                    <td>{u.role}</td>
                    <td>{u.status}</td>
                    <td>
                      <div className="perm-count-badge" onClick={() => setSelectedUser(u)}>
                        {countPerms(u.permissions)} permissions
                      </div>
                    </td>
                    <td style={{fontSize: '0.85rem', color: '#64748b'}}>{u.lastActive || 'Never Logged In'}</td>
                    <td>
                      <span className={isEnabled ? 'status-enabled' : 'status-disabled'}>
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-action" onClick={() => setSelectedUser(u)}>View →</button>
                    </td>
                  </tr>
                );
              })}
              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div style={{textAlign: 'center', padding: '3rem 1rem'}}>
                      <Search size={48} color="#cbd5e1" style={{marginBottom: '1rem'}} />
                      <h3>No matching users.</h3>
                      <p style={{color: '#64748b'}}>Try adjusting your search or filters.</p>
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

      {/* Permission Matrix */}
      <div className="access-panel" style={{marginBottom: '100px'}}>
        <h2><ShieldAlert size={20} className="icon" /> Permission Matrix defaults</h2>
        <div className="matrix-wrapper">
          <table className="permission-matrix">
            <thead>
              <tr>
                <th>Users</th>
                {MODULES.map(m => (
                  <th key={m}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixUsers.map(mu => (
                <tr key={mu.name}>
                  <td>{mu.name}</td>
                  {MODULES.map(m => (
                    <td key={m}>
                      {mu.perms[m as keyof typeof mu.perms] ? <span className="matrix-check">✓</span> : <span className="matrix-none">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUserIds.length > 0 && (
        <div className="bulk-actions-bar">
          <span style={{fontWeight: 700}}>{selectedUserIds.length} users selected</span>
          <div style={{display: 'flex', gap: '1rem'}}>
            <button className="btn-outline" style={{background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none'}} onClick={() => setSelectedUserIds([])}>Cancel</button>
            <button className="btn-outline" style={{background: 'white', color: '#ef4444', border: 'none'}} onClick={() => handleBulkAccess(false)}>Disable Access</button>
            <button className="btn-primary" style={{background: '#16a34a', color: 'white'}} onClick={() => handleBulkAccess(true)}>Enable Access</button>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedUser && (
        <div className="access-detail-panel-overlay" onClick={() => setSelectedUser(null)}>
          <div className="access-detail-panel" onClick={e => e.stopPropagation()}>
            <div style={{padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between'}}>
              <div>
                <h3 style={{fontSize: '1.5rem', fontWeight: 800}}>{selectedUser.name}</h3>
                <div style={{fontFamily: 'monospace', color: '#64748b'}}>{selectedUser.id} | {selectedUser.email}</div>
              </div>
              <button style={{background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'}} onClick={() => setSelectedUser(null)}><X size={24}/></button>
            </div>

            <div style={{flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem'}}>
              
              {/* Info */}
              <div className="access-2col-grid">
                <div>
                  <div style={{fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>User Type</div>
                  <div style={{fontWeight: 700, marginTop: '0.25rem'}}>{getUserType(selectedUser.role)}</div>
                </div>
                <div>
                  <div style={{fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>Role</div>
                  <div style={{fontWeight: 700, marginTop: '0.25rem'}}>{selectedUser.role}</div>
                </div>
                <div>
                  <div style={{fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>Access</div>
                  <div className={selectedUser.status === 'Active' ? 'status-enabled' : 'status-disabled'} style={{marginTop: '0.25rem'}}>{selectedUser.status === 'Active' ? 'Enabled' : 'Disabled'}</div>
                </div>
                <div>
                  <div style={{fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>Last Activity</div>
                  <div style={{fontWeight: 700, marginTop: '0.25rem'}}>{selectedUser.lastActive || 'Never Logged In'}</div>
                </div>
              </div>

              <div style={{display: 'flex', gap: '1rem'}}>
                {getUserType(selectedUser.role) === 'Employee' && onNavigateToEmployee && (
                  <button className="btn-outline" style={{flex: 1, justifyContent: 'center'}} onClick={() => onNavigateToEmployee(selectedUser.name)}>
                    View Employee Profile <ArrowRight size={16} />
                  </button>
                )}
                {getUserType(selectedUser.role) === 'Dealer' && onNavigateToDealer && (
                  <button className="btn-outline" style={{flex: 1, justifyContent: 'center'}} onClick={() => onNavigateToDealer(selectedUser.name)}>
                    View Dealer Profile <ArrowRight size={16} />
                  </button>
                )}
              </div>

              {/* Permissions */}
              <div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem'}}>
                  <h4 style={{fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>Permissions ({countPerms(selectedUser.permissions)})</h4>
                  <button className="btn-outline" style={{padding: '0.25rem 0.5rem', fontSize: '0.75rem'}} onClick={() => handleOpenEditPerms(selectedUser)}>
                    Edit Permissions
                  </button>
                </div>
                <div className="perm-list-view">
                  {MODULES.map(m => {
                    const hasPerm = selectedUser.permissions[m] !== 'none' && selectedUser.permissions[m] !== undefined;
                    return (
                      <div key={m} className={`perm-list-row ${hasPerm ? 'granted' : 'denied'}`}>
                        <span style={{textTransform: 'capitalize'}}>{m}</span>
                        {hasPerm ? <CheckCircle2 size={16} color="#16a34a" /> : <X size={16} color="#ef4444" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Admin Actions */}
              <div>
                <h4 style={{fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem'}}>Admin Actions</h4>
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  <button className="btn-outline" onClick={handleResetDemoAccess}>
                    <Key size={16} /> Reset Demo Access
                  </button>
                  <button className={selectedUser.status === 'Active' ? 'btn-danger' : 'btn-primary'} onClick={() => handleToggleAccess(selectedUser)}>
                    {selectedUser.status === 'Active' ? 'Disable Access' : 'Enable Access'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {isEditPermsOpen && selectedUser && editPerms && (
        <div className="perm-modal-overlay" onClick={() => setIsEditPermsOpen(false)}>
          <div className="perm-modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Permissions</h2>
            <div style={{marginBottom: '1.5rem', color: '#64748b'}}>
              <span style={{fontWeight: 700, color: 'var(--color-navy)'}}>{selectedUser.name}</span> ({selectedUser.role})
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', borderTop: '1px solid #f1f5f9'}}>
              {MODULES.map(m => {
                const isOn = editPerms[m] !== 'none' && editPerms[m] !== undefined;
                const isAdminProtect = selectedUser.role === 'Admin' && m === 'access';
                return (
                  <div key={m} className="perm-toggle-row">
                    <div className="perm-toggle-label">
                      <span className="perm-toggle-title" style={{textTransform: 'capitalize'}}>{m}</span>
                      <span style={{fontSize: '0.75rem', color: '#64748b'}}>{isOn ? 'Access granted' : 'Access restricted'}</span>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={isOn} 
                        onChange={(e) => handleTogglePerm(m, e.target.checked)}
                        disabled={isAdminProtect}
                      />
                      <span className={`toggle-slider ${isAdminProtect ? 'admin-protected' : ''}`}></span>
                    </label>
                  </div>
                );
              })}
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem'}}>
              <button className="btn-outline" onClick={() => setIsEditPermsOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSavePerms}>Save Permissions</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
