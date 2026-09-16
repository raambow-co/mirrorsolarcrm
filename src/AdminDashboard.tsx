import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Users, Briefcase, Package, Shield, 
  Bell, ChevronDown, ChevronRight, LogOut, Settings, User, 
  Menu, X, PanelLeftClose, PanelLeftOpen, 
  TrendingUp, Activity, AlertCircle, ArrowRight,
  UserPlus, CheckCircle2, Sun, Wallet, CheckCircle, PieChart,
  CheckSquare, Calendar, Wrench, Check, ThumbsUp, ThumbsDown, CreditCard
} from 'lucide-react';
import logoUrl from './assets/mirrorsolarlogo.png';
import './AdminDashboard.css';
import StockPage from './StockPage';
import { useStock } from './context/StockContext';
import { useCRM, STAGES } from './context/CRMContext';
import type { MockLead, Stage } from './context/CRMContext';
import { useUI } from './context/UIContext';
import AdminEmployeesPage from './AdminEmployeesPage';
import AdminDealersPage from './AdminDealersPage';
import AdminAccessPage from './AdminAccessPage';
import AccessRestricted from './components/AccessRestricted';
import { canAccessRoute } from './utils/permissionCalculations';
import LeadsPage from './LeadsPage';
import AdminReportsPage from './AdminReportsPage';
import ProfilePage from './ProfilePage';
import TasksPage from './TasksPage';
import CalendarPage from './CalendarPage';
import PaymentsPage from './PaymentsPage';

// --- Custom Hooks ---
function useCountUp(end: number, duration: number = 1200) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const p = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - Math.pow(1 - p, 4);
      setCount(Math.floor(easeOut * end));
      
      if (p < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);

  return count;
}

interface AdminDashboardProps {
  onSignOut: () => void;
}



export default function AdminDashboard({ onSignOut }: AdminDashboardProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  
  const [stageAnimation, setStageAnimation] = useState(0);

  // Lead State
  const { leads, employees, dealers, currentUser, activities, tasks, updateLeadStage, updateLead, addActivity } = useCRM();
  const { showToast, showConfirmModal } = useUI();
  const { deductDealerStockForLeadMaterial } = useStock();
  const [selectedStage, setSelectedStage] = useState<Stage>('Installation');
  const [selectedLead, setSelectedLead] = useState<MockLead | null>(null);

  // Auto-sync open lead details drawer with live real-time Firestore updates
  useEffect(() => {
    if (selectedLead) {
      const liveLead = leads.find(l => l.id === selectedLead.id);
      if (liveLead && JSON.stringify(liveLead) !== JSON.stringify(selectedLead)) {
        setSelectedLead(liveLead);
      }
    }
  }, [leads]);
  
  // Modal State
  const [isLeadDetailOpen, setIsLeadDetailOpen] = useState(false);
  const [pendingStageChange, setPendingStageChange] = useState<Stage | null>(null);

  // Quick Installation Rejection Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetLead, setRejectTargetLead] = useState<MockLead | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApproveInstallation = async (lead: MockLead) => {
    if (lead.dealerSpecifications && lead.dealer) {
      const deductionRes = await deductDealerStockForLeadMaterial(
        lead.id,
        lead.customer,
        lead.dealer,
        lead.dealerSpecifications,
        currentUser?.name || 'Admin'
      );
      if (deductionRes.deductedSummary && deductionRes.deductedSummary !== 'No material quantities specified') {
        addActivity({
          type: 'Stock Consumed',
          message: `Material stock deducted for ${lead.customer} from ${lead.dealer} inventory: ${deductionRes.deductedSummary}`,
          user: currentUser?.name || 'Admin',
          dealer: lead.dealer,
          leadId: lead.id
        });
      }
    }
    updateLead(lead.id, { stage: 'Installation', installationApprovalStatus: 'Approved' });
    addActivity({
      type: 'Installation Approved',
      message: `Admin approved installation stage for ${lead.customer}`,
      user: currentUser?.name || 'Admin',
      leadId: lead.id,
      dealer: lead.dealer
    });
    showToast(`Installation approved & materials deducted from ${lead.dealer}'s inventory!`, 'success');
  };

  const handleRejectInstallation = () => {
    if (!rejectTargetLead) return;
    updateLead(rejectTargetLead.id, { 
      installationApprovalStatus: 'Rejected',
      installationRejectionReason: rejectReason || 'Requirements not met'
    });
    addActivity({
      type: 'Installation Rejected',
      message: `Admin rejected installation for ${rejectTargetLead.customer}: ${rejectReason || 'Pending requirements'}`,
      user: currentUser?.name || 'Admin',
      leadId: rejectTargetLead.id,
      dealer: rejectTargetLead.dealer
    });
    showToast(`Installation rejected for ${rejectTargetLead.customer}`, 'error');
    setShowRejectModal(false);
    setRejectTargetLead(null);
    setRejectReason('');
  };

  // Employee Filter State
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string | null>(null);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Dealer Filter State
  const [selectedDealerFilter, setSelectedDealerFilter] = useState<string | null>(null);
  const [isDealerDropdownOpen, setIsDealerDropdownOpen] = useState(false);
  const dealerDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
      if (dealerDropdownRef.current && !dealerDropdownRef.current.contains(event.target as Node)) {
        setIsDealerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Staggered entrance
  useEffect(() => {
    const timers = [
      setTimeout(() => setStageAnimation(1), 100), // Sidebar
      setTimeout(() => setStageAnimation(2), 200), // Header
      setTimeout(() => setStageAnimation(3), 300), // Welcome
      setTimeout(() => setStageAnimation(4), 450), // Overview Cards
      setTimeout(() => setStageAnimation(5), 600), // Pipeline
      setTimeout(() => setStageAnimation(6), 750), // Chart & Stock
      setTimeout(() => setStageAnimation(7), 900), // Bottom Tables
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const { availableUnits, categorySummary } = useStock();

  // Mock Animated Numbers (Base amounts + dynamic amounts)
  const leadsCount = useCountUp(leads.length);
  const employeesCount = useCountUp(employees.length);
  const dealersCount = useCountUp(dealers.length);
  const stockCount = useCountUp(availableUnits);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleNavClick = (itemName: string) => {
    setActiveTab(itemName);
    setExpandedMenu(null);
    setIsEmployeeDropdownOpen(false);
    setIsDealerDropdownOpen(false);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const handleOpenLead = (lead: MockLead) => {
    setSelectedLead(lead);
    setIsLeadDetailOpen(true);
  };

  const handleCloseLeadDetail = () => {
    setIsLeadDetailOpen(false);
    setSelectedLead(null);
    setPendingStageChange(null);
  };

  const handleConfirmStageChange = (newStage: Stage) => {
    if (selectedLead && newStage) {
      updateLeadStage(selectedLead.id, newStage);
      addActivity({
        type: 'Stage Changed',
        message: `Lead ${selectedLead.customer} stage changed to ${newStage}`,
        user: currentUser?.name || 'Admin',
        leadId: selectedLead.id,
      });
      showToast(`Lead stage updated to ${newStage}`, 'success');
      setIsLeadDetailOpen(false);
      setPendingStageChange(null);
      setSelectedLead(null);
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Leads', icon: <Activity size={20} /> },
    { name: 'Tasks', icon: <CheckSquare size={20} /> },
    { name: 'Calendar', icon: <Calendar size={20} /> },
    { 
      name: 'Employees', 
      icon: <Users size={20} />
    },
    { 
      name: 'Dealers', 
      icon: <Briefcase size={20} />,
      children: ['Sri Solar Dealers', 'Green Energy', 'Sun Power', 'Aditya Solar', 'Bright Energy']
    },
    { name: 'Stock', icon: <Package size={20} /> },
    { name: 'Payments', icon: <CreditCard size={20} /> },
    { name: 'Reports', icon: <PieChart size={20} /> },
    { name: 'Access', icon: <Shield size={20} /> },
  ];

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchEmp = selectedEmployeeFilter ? l.assignedEmployee === selectedEmployeeFilter : true;
      const matchDlr = selectedDealerFilter ? l.dealer === selectedDealerFilter : true;
      return matchEmp && matchDlr;
    });
  }, [leads, selectedEmployeeFilter, selectedDealerFilter]);

  const visibleLeads = useMemo(() => {
    return filteredLeads.filter(l => l.stage === selectedStage);
  }, [filteredLeads, selectedStage]);

  const pendingInstallationLeads = useMemo(() => {
    return leads.filter(l => l.installationApprovalStatus === 'Pending' && !l.archived);
  }, [leads]);

  const pipelineCounts = useMemo(() => {
    const counts: Record<Stage, number> = {
      'Lead': 0,
      'Converted': 0,
      'Installation': 0,
      'Loan': 0,
      'Material': 0,
      'Completed': 0
    };
    filteredLeads.forEach(l => {
      if (counts[l.stage] !== undefined) counts[l.stage]++;
    });
    return counts;
  }, [filteredLeads]);

  return (
    <div className="admin-layout">
      {/* --- SIDEBAR --- */}
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''} ${stageAnimation >= 1 ? 'reveal' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            <img src={logoUrl} alt="Solar CRM" className="sidebar-logo" />
          </div>
          <button className="sidebar-collapse-btn desktop-only" onClick={toggleSidebar}>
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="sidebar-close-btn mobile-only" onClick={toggleMobileMenu}>
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = activeTab === item.name;
            const isExpanded = expandedMenu === item.name;
            const hasChildren = !!item.children;

            return (
              <div key={item.name} className="nav-group" ref={item.name === 'Employees' ? dropdownRef : item.name === 'Dealers' ? dealerDropdownRef : null}>
                <button 
                  className={`nav-item ${isActive && !hasChildren ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => handleNavClick(item.name)}
                  title={isSidebarCollapsed ? item.name : undefined}
                >
                  <span className={`nav-icon`}>{item.icon}</span>
                  {!isSidebarCollapsed && <span className="nav-text">{item.name}</span>}
                  
                  {isActive && !isSidebarCollapsed && !hasChildren && <span className="nav-active-dot"></span>}
                  
                  {!isSidebarCollapsed && hasChildren && (
                    <span className="nav-chevron">
                      <ChevronRight size={16} className={`chevron-icon ${isExpanded ? 'rotate' : ''}`} />
                    </span>
                  )}
                </button>

                {/* Standard Submenu */}
                {hasChildren && !isSidebarCollapsed && (
                  <div className={`nav-submenu ${isExpanded ? 'open' : ''}`}>
                    {item.children?.map(child => (
                      <div key={child} className="submenu-item">{child}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className={`footer-item ${activeTab === 'Profile' ? 'active' : ''}`} title={isSidebarCollapsed ? "Profile" : undefined} onClick={() => handleNavClick('Profile')}>
            <User size={18} />
            {!isSidebarCollapsed && <span>Profile</span>}
          </button>
          <button className={`footer-item ${activeTab === 'Profile' ? 'active' : ''}`} title={isSidebarCollapsed ? "Settings" : undefined} onClick={() => handleNavClick('Profile')}>
            <Settings size={20} />
            {!isSidebarCollapsed && <span>Settings</span>}
          </button>
          <div className="sidebar-divider"></div>
          <button className="footer-item sign-out" onClick={onSignOut} title={isSidebarCollapsed ? "Sign Out" : undefined}>
            <LogOut size={20} />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={toggleMobileMenu}></div>}

      {/* --- MAIN CONTENT --- */}
      <main className="admin-main">
        <header className={`admin-header ${stageAnimation >= 2 ? 'reveal' : ''}`}>
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
              <Menu size={24} />
            </button>
            <div className="breadcrumb">
              <span className="text-muted">Solar CRM</span>
              <span className="mx-2">/</span>
              <span className="text-navy font-semibold">{activeTab}</span>
            </div>
          </div>
          
          <div className="header-right">
            <button className="notification-btn" onClick={() => handleNavClick('Tasks')} title="View Tasks & Notifications">
              <Bell size={20} />
              <span className="notification-indicator"></span>
            </button>
            <div className="profile-dropdown" onClick={() => handleNavClick('Profile')} style={{cursor: 'pointer'}} title="View Profile & Settings">
              <div className="avatar">{currentUser?.initials || 'A'}</div>
              <div className="profile-info desktop-only">
                <span className="profile-name">{currentUser?.name || 'Admin'}</span>
                <span className="profile-role">{currentUser?.role || 'Administrator'}</span>
              </div>
              <ChevronDown size={16} className="text-muted" />
            </div>
          </div>
        </header>

        {!canAccessRoute(currentUser, activeTab) ? (
          <AccessRestricted onReturnToDashboard={() => setActiveTab('Dashboard')} />
        ) : activeTab === 'Stock' ? (
          <StockPage />
        ) : activeTab === 'Employees' ? (
          <AdminEmployeesPage 
            onNavigateToLeads={() => {
              setActiveTab('Leads');
            }} 
            onNavigateToAccess={() => {
              setActiveTab('Access');
            }} 
          />
        ) : activeTab === 'Dealers' ? (
          <AdminDealersPage onNavigateToLeads={() => setActiveTab('Leads')} />
        ) : activeTab === 'Leads' ? (
          <LeadsPage />
        ) : activeTab === 'Access' ? (
          <AdminAccessPage 
            onNavigateToEmployee={() => {
              setActiveTab('Employees');
            }} 
            onNavigateToDealer={() => {
              setActiveTab('Dealers');
            }} 
          />
        ) : activeTab === 'Payments' ? (
          <PaymentsPage onNavigate={handleNavClick} />
        ) : activeTab === 'Reports' ? (
          <AdminReportsPage onNavigate={handleNavClick} />
        ) : activeTab === 'Profile' ? (
          <ProfilePage />
        ) : activeTab === 'Tasks' ? (
          <TasksPage onNavigate={handleNavClick} />
        ) : activeTab === 'Calendar' ? (
          <CalendarPage onNavigate={handleNavClick} />
        ) : (
        <div className="dashboard-content">
          <div className={`welcome-section ${stageAnimation >= 3 ? 'reveal' : ''}`}>
            <h1>Good morning, Admin</h1>
            <div className="welcome-accent"></div>
            <p>Here’s what’s happening across your solar operations today.</p>
          </div>

          <div className={`overview-grid ${stageAnimation >= 4 ? 'reveal' : ''}`}>
            <div className="overview-card interactive-card" style={{animationDelay: '0s'}} onClick={() => handleNavClick('Leads')}>
              <div className="card-header">
                <span className="card-title">Active Leads</span>
                <div className="card-icon"><Activity size={18} /></div>
              </div>
              <div className="card-value">{leadsCount}</div>
              <div className="card-footer text-positive">
                <TrendingUp size={14} /> <span>+12.5% this month</span>
              </div>
              <div className="card-bottom-accent"></div>
            </div>

            <div className="dashboard-card-wrapper" style={{animationDelay: '0.1s'}} ref={dropdownRef}>
              <div className="overview-card interactive-card" onClick={(e) => { e.stopPropagation(); setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen); setIsDealerDropdownOpen(false); }}>
                <div className="card-header">
                  <span className="card-title">Employees</span>
                  <div className="card-icon"><Users size={18} /></div>
                </div>
                <div className="card-value">{employeesCount}</div>
                <div className="card-footer text-neutral">
                  <span>{employees.filter(e => e.status === 'Active').length} active</span>
                </div>
                <div className="card-bottom-accent"></div>
              </div>
              
              {isEmployeeDropdownOpen && (
                <div className="card-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div className="card-dropdown-header">EMPLOYEES</div>
                  {employees.map(emp => (
                    <div 
                      key={emp.id} 
                      className={`card-dropdown-item ${selectedEmployeeFilter === emp.name ? 'selected' : ''}`}
                      onClick={() => { setSelectedEmployeeFilter(emp.name); setIsEmployeeDropdownOpen(false); }}
                    >
                      <span className="dropdown-item-name">{emp.name}</span>
                      <span className="dropdown-item-arrow">→</span>
                    </div>
                  ))}
                  <div className="card-dropdown-footer" onClick={() => handleNavClick('Employees')}>
                    View all employees →
                  </div>
                </div>
              )}
            </div>

            <div className="dashboard-card-wrapper" style={{animationDelay: '0.2s'}} ref={dealerDropdownRef}>
              <div className="overview-card interactive-card" onClick={(e) => { e.stopPropagation(); setIsDealerDropdownOpen(!isDealerDropdownOpen); setIsEmployeeDropdownOpen(false); }}>
                <div className="card-header">
                  <span className="card-title">Dealers</span>
                  <div className="card-icon"><Briefcase size={18} /></div>
                </div>
                <div className="card-value">{dealersCount}</div>
                <div className="card-footer text-neutral">
                  <span>{dealers.filter(d => d.status === 'Active').length} active</span>
                </div>
                <div className="card-bottom-accent"></div>
              </div>

              {isDealerDropdownOpen && (
                <div className="card-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div className="card-dropdown-header">DEALERS</div>
                  {dealers.map(dealer => (
                    <div 
                      key={dealer.id} 
                      className={`card-dropdown-item ${selectedDealerFilter === dealer.name ? 'selected' : ''}`}
                      onClick={() => { setSelectedDealerFilter(dealer.name); setIsDealerDropdownOpen(false); }}
                    >
                      <span className="dropdown-item-name">{dealer.name}</span>
                      <span className="dropdown-item-arrow">→</span>
                    </div>
                  ))}
                  <div className="card-dropdown-footer" onClick={() => handleNavClick('Dealers')}>
                    View all dealers →
                  </div>
                </div>
              )}
            </div>

            <div className="overview-card interactive-card" style={{animationDelay: '0.3s'}} onClick={() => handleNavClick('Stock')}>
              <div className="card-header">
                <span className="card-title">Stock Items</span>
                <div className="card-icon"><Package size={18} /></div>
              </div>
              <div className="card-value">{stockCount.toLocaleString()}</div>
              <div className="card-footer text-neutral">
                <span>Across 32 items</span>
              </div>
              <div className="card-bottom-accent"></div>
            </div>
          </div>

          {/* TODAY'S TASKS */}
          <div className={`dashboard-panel ${stageAnimation >= 4 ? 'reveal' : ''}`} style={{marginBottom: '1.5rem', animationDelay: '0.4s'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <h3 style={{fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <CheckSquare size={18} color="#0284c7" /> Today's Tasks
              </h3>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button className="btn-outline" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => handleNavClick('Calendar')}>
                  <Calendar size={14} style={{marginRight: '0.25rem'}} /> Calendar
                </button>
                <button className="btn-primary" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => handleNavClick('Tasks')}>
                  View All
                </button>
              </div>
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                const activeTasks = tasks.filter(t => t.dueDate <= today && t.status !== 'Completed');
                
                const activeFollowups = leads
                  .filter(l => l.followUp && !l.archived && (l.followUp.status === 'Due Today' || l.followUp.status === 'Overdue'))
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
                  <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer'}} onClick={() => handleNavClick(item.type)}>
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

          {/* PENDING INSTALLATION APPROVALS ALERT */}
          {pendingInstallationLeads.length > 0 && (
            <div className="dashboard-panel" style={{background: '#fffbeb', border: '1px solid #fde68a', padding: '1.25rem', marginBottom: '1.5rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.6rem'}}>
                  <AlertCircle size={22} color="#d97706" />
                  <div>
                    <h3 style={{margin: 0, fontSize: '1.05rem', color: '#92400e', fontWeight: 700}}>Pending Installation Approvals</h3>
                    <p style={{margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#b45309'}}>
                      {pendingInstallationLeads.length} {pendingInstallationLeads.length === 1 ? 'project requires' : 'projects require'} your approval to start the installation stage
                    </p>
                  </div>
                </div>
                <span style={{background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #fcd34d'}}>
                  {pendingInstallationLeads.length} Pending Action
                </span>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '0.6rem'}}>
                {pendingInstallationLeads.map(lead => (
                  <div key={lead.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: '#fff', borderRadius: '8px', border: '1px solid #fde68a', flexWrap: 'wrap', gap: '0.75rem'}}>
                    <div>
                      <div style={{fontWeight: 700, color: '#1e293b', fontSize: '0.95rem'}}>{lead.customer} <span style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 400}}>({lead.id})</span></div>
                      <div style={{fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem'}}>
                        Dealer: <strong>{lead.dealer}</strong> • Assigned Employee: <strong>{lead.assignedEmployee || 'Unassigned'}</strong> • Location: <strong>{lead.location}</strong>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                      <button 
                        className="btn-primary" 
                        style={{padding: '0.35rem 0.85rem', fontSize: '0.85rem', background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.35rem'}}
                        onClick={() => handleApproveInstallation(lead)}
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button 
                        className="btn-outline" 
                        style={{padding: '0.35rem 0.85rem', fontSize: '0.85rem', color: '#dc2626', borderColor: '#fca5a5'}}
                        onClick={() => { setRejectTargetLead(lead); setShowRejectModal(true); }}
                      >
                        Reject
                      </button>
                      <button 
                        className="btn-outline" 
                        style={{padding: '0.35rem 0.75rem', fontSize: '0.85rem'}}
                        onClick={() => { setSelectedLead(lead); setIsLeadDetailOpen(true); }}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PIPELINE & LEAD LIST */}
          <div className={`dashboard-panel pipeline-panel ${stageAnimation >= 5 ? 'reveal' : ''}`}>
            <div className="pipeline-header-area">
              <div className="pipeline-titles">
                <h2>LEAD PIPELINE</h2>
                <p>Track and manage customers through every stage</p>
              </div>
              
              <div className="pipeline-filter-indicator">
                {selectedEmployeeFilter || selectedDealerFilter ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="filter-text text-sm" style={{color: 'var(--color-navy)', marginRight: '4px'}}>Showing:</span>
                    {selectedEmployeeFilter && (
                      <div className="active-filter-pill">
                        <span className="pill-text">{selectedEmployeeFilter}</span>
                        <button className="clear-filter-btn" onClick={() => setSelectedEmployeeFilter(null)}>
                           <X size={14} />
                        </button>
                      </div>
                    )}
                    {selectedDealerFilter && (
                      <div className="active-filter-pill">
                         <span className="pill-text">{selectedDealerFilter}</span>
                         <button className="clear-filter-btn" onClick={() => setSelectedDealerFilter(null)}>
                           <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="filter-text text-sm" style={{color: 'var(--color-navy)'}}>Showing: <span className="font-semibold" style={{marginLeft: '4px'}}>All Leads</span></span>
                  </div>
                )}
              </div>
            </div>

            <div className="pipeline-flow-crm">
              {STAGES.map((s, idx, arr) => {
                const isActive = selectedStage === s;
                
                // Card Config
                let icon, colorClass;
                if (s === 'Lead') { icon = <UserPlus size={18} />; colorClass = 'stage-card-lead'; }
                else if (s === 'Converted') { icon = <CheckCircle2 size={18} />; colorClass = 'stage-card-converted'; }
                else if (s === 'Installation') { icon = <Wrench size={18} />; colorClass = 'stage-card-survey'; }
                else if (s === 'Loan') { icon = <Wallet size={18} />; colorClass = 'stage-card-loan'; }
                else if (s === 'Material') { icon = <Package size={18} />; colorClass = 'stage-card-material'; }
                else { icon = <CheckCircle size={18} />; colorClass = 'stage-card-completed'; }

                return (
                  <React.Fragment key={s}>
                    <div 
                      className={`crm-stage-card ${colorClass} ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedStage(s)}
                    >
                      <div className="stage-card-header">
                        <div className="stage-card-icon">{icon}</div>
                        <span className="stage-card-name">{s}</span>
                      </div>
                      <div className="stage-card-count">{pipelineCounts[s]}</div>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="crm-pipeline-connector">
                        <ArrowRight size={20} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="pipeline-divider"></div>

            <div className="pipeline-leads-header">
              <h3>Leads in {selectedStage}</h3>
              <span className="leads-count-badge">{visibleLeads.length} Leads</span>
            </div>

            <div className="table-responsive">
              <table className="data-table interactive-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Dealer</th>
                    <th>Assigned</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-state">No leads currently in this stage.</td>
                    </tr>
                  ) : (
                    visibleLeads.map((l) => (
                      <tr key={l.id} onClick={() => handleOpenLead(l)}>
                        <td>
                          <div className="text-sm font-medium text-navy">{l.customer}</div>
                        </td>
                        <td className="text-dealer">{l.dealer}</td>
                        <td className="text-employee">{l.assignedEmployee}</td>
                        <td>
                          <button className="view-btn">View</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>



          <div className="dashboard-row grid-2-1">
            {/* EMPLOYEE PERFORMANCE */}
            <div className={`dashboard-panel ${stageAnimation >= 7 ? 'reveal' : ''}`}>
              <div className="panel-header">
                <h2>Employee Perf.</h2>
              </div>
              <div className="perf-list">
                <div className="perf-list-header">
                  <span>Employee</span>
                  <span>Conv.</span>
                </div>
                {[
                  { n: 'Aditya', leads: 24, conv: 12 },
                  { n: 'Ravi', leads: 21, conv: 9 },
                  { n: 'Suresh', leads: 18, conv: 8 },
                  { n: 'Ramesh', leads: 15, conv: 7 },
                ].map(emp => (
                  <div className="perf-item" key={emp.n}>
                    <span className="perf-name">{emp.n}</span>
                    <div className="perf-stats">
                      <div className="perf-mini-bar"><div style={{width: `${(emp.conv/20)*100}%`}}></div></div>
                      <span className="perf-val">{emp.conv}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DEALER PERFORMANCE */}
            <div className={`dashboard-panel ${stageAnimation >= 7 ? 'reveal' : ''}`}>
              <div className="panel-header">
                <h2>Dealer Perf.</h2>
              </div>
              <div className="perf-list">
                <div className="perf-list-header">
                  <span>Dealer</span>
                  <span>Conv.</span>
                </div>
                {[
                  { n: 'Sun Power', leads: 32, conv: 18 },
                  { n: 'Green Energy', leads: 28, conv: 14 },
                  { n: 'Sri Solar', leads: 24, conv: 12 },
                ].map(dlr => (
                  <div className="perf-item" key={dlr.n}>
                    <span className="perf-name truncate" title={dlr.n}>{dlr.n}</span>
                    <div className="perf-stats">
                      <span className="perf-val font-medium text-navy">{dlr.conv}</span>
                      <span className="text-xs text-muted">/ {dlr.leads}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}
      </main>

      {/* LEAD DETAIL SLIDE-OVER PANEL */}
      {isLeadDetailOpen && selectedLead && (
        <>
          <div className="panel-overlay" onClick={handleCloseLeadDetail}></div>
          <div className="lead-detail-panel">
            <div className="lead-detail-header">
              <h2>Lead Details</h2>
              <button className="close-btn" onClick={handleCloseLeadDetail}><X size={20} /></button>
            </div>
            
            <div className="lead-detail-content">
              <div className="detail-group">
                <span className="detail-value text-xl font-semibold text-navy">{selectedLead.customer}</span>
                <span className="detail-label">Lead ID: {selectedLead.id}</span>
              </div>
              
              <div className="detail-group">
                <span className="detail-label">Dealer</span>
                <span className="detail-value">{selectedLead.dealer}</span>
              </div>
              
              <div className="detail-group">
                <span className="detail-label">Assigned Employee</span>
                <span className="detail-value">{selectedLead.assignedEmployee}</span>
              </div>
              
              <div className="detail-group">
                <span className="detail-label">Current Stage</span>
                <span className="detail-value">{selectedLead.stage}</span>
              </div>
              
              <div className="detail-group">
                <span className="detail-label">Updated</span>
                <span className="detail-value">{selectedLead.updatedAt}</span>
              </div>

              <div className="detail-action-group">
                <label className="detail-label">Change Stage</label>
                <div className="stage-select-wrapper">
                  <select 
                    value={pendingStageChange || selectedLead.stage} 
                    onChange={(e) => {
                      const newStage = e.target.value as Stage;
                      setPendingStageChange(newStage);
                      showConfirmModal(
                        'Change Lead Stage?',
                        `Are you sure you want to move ${selectedLead.customer} from ${selectedLead.stage} to ${newStage}?`,
                        () => handleConfirmStageChange(newStage),
                        { confirmText: 'Confirm Change', cancelText: 'Cancel' }
                      );
                    }}
                    className="stage-select"
                  >
                    {STAGES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="select-icon" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showRejectModal && rejectTargetLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '450px'}}>
            <h3 style={{marginTop: 0, color: '#991b1b'}}>Reject Installation Request</h3>
            <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem'}}>
              Provide a reason for rejecting the installation stage for <strong>{rejectTargetLead.customer}</strong>:
            </p>
            <textarea 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)}
              placeholder="E.g. Advance payment proof pending, quotation incomplete..."
              style={{width: '100%', minHeight: '90px', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', marginBottom: '1.25rem'}}
            />
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => { setShowRejectModal(false); setRejectTargetLead(null); setRejectReason(''); }}>Cancel</button>
              <button className="btn-primary" style={{background: '#dc2626', borderColor: '#dc2626'}} onClick={handleRejectInstallation}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
