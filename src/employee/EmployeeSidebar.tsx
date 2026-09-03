import { 
  LayoutDashboard, 
  Users, 
  Bell, 
  Package, 
  User as UserIcon, 
  LogOut,
  PanelLeftClose, 
  PanelLeftOpen,
  CheckSquare,
  Calendar,
  X
} from 'lucide-react';
import logoUrl from '../assets/mirrorsolarlogo.png';
import { useCRM } from '../context/CRMContext';
import { canAccessRoute } from '../utils/permissionCalculations';

interface EmployeeSidebarProps {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  stageAnimation: number;
  currentPath: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}

export default function EmployeeSidebar({
  isSidebarCollapsed,
  toggleSidebar,
  isMobileMenuOpen,
  toggleMobileMenu,
  stageAnimation,
  currentPath,
  onNavigate,
  onSignOut
}: EmployeeSidebarProps) {
  const { currentUser } = useCRM();

  const allNavItems = [
    { name: 'Dashboard', path: '/employee/dashboard', icon: LayoutDashboard, routeName: 'Dashboard' },
    { name: 'My Leads', path: '/employee/leads', icon: Users, routeName: 'Leads' },
    { name: 'Tasks', path: '/employee/tasks', icon: CheckSquare, routeName: 'Dashboard' },
    { name: 'Calendar', path: '/employee/calendar', icon: Calendar, routeName: 'Dashboard' },
    { name: 'Follow-ups', path: '/employee/followups', icon: Bell, routeName: 'Leads' },
    { name: 'Stock', path: '/employee/stock', icon: Package, routeName: 'Stock' },
    { name: 'Reports', path: '/employee/reports', icon: LayoutDashboard, routeName: 'Reports' },
  ];

  const navItems = allNavItems.filter(item => canAccessRoute(currentUser, item.routeName));

  return (
    <>
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''} ${stageAnimation >= 1 ? 'reveal' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            <img src={logoUrl} alt="Solar CRM" className="sidebar-logo" />
          </div>
          <button className="sidebar-collapse-btn desktop-only" onClick={toggleSidebar}>
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="sidebar-close-btn mobile-only" onClick={toggleMobileMenu} aria-label="Close Menu">
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, index) => {
            const isActive = currentPath === item.path;
            const Icon = item.icon;
            
            return (
              <div 
                key={item.name} 
                className={`nav-item-wrapper ${stageAnimation >= 2 ? 'reveal' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <button
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(item.path);
                    if (isMobileMenuOpen) toggleMobileMenu();
                  }}
                  title={isSidebarCollapsed ? item.name : undefined}
                >
                  <Icon size={20} className="nav-icon" />
                  {!isSidebarCollapsed && <span className="nav-text">{item.name}</span>}
                  {isActive && !isSidebarCollapsed && <span className="nav-active-dot"></span>}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {canAccessRoute(currentUser, 'Profile') && (
            <button 
              className="footer-item" 
              title={isSidebarCollapsed ? "Profile" : undefined}
              onClick={() => {
                onNavigate('/employee/profile');
                if (isMobileMenuOpen) toggleMobileMenu();
              }}
            >
              <UserIcon size={18} />
              {!isSidebarCollapsed && <span>Profile</span>}
            </button>
          )}
          
          <div className="sidebar-divider"></div>
          
          <button className="footer-item sign-out" onClick={onSignOut} title={isSidebarCollapsed ? "Sign Out" : undefined}>
            <LogOut size={18} />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
      
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={toggleMobileMenu}></div>}
    </>
  );
}
