import { useState, useEffect } from 'react';
import { Menu, Bell } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { canAccessRoute } from '../utils/permissionCalculations';
import AccessRestricted from '../components/AccessRestricted';
import EmployeeSidebar from './EmployeeSidebar';
// Stubs for future pages
import EmployeeDashboard from './EmployeeDashboard';
import ProfilePage from '../ProfilePage';
import LeadsPage from '../LeadsPage';
import FollowupsPage from '../FollowupsPage';
import StockPage from '../StockPage';
import AdminReportsPage from '../AdminReportsPage';
import TasksPage from '../TasksPage';
import CalendarPage from '../CalendarPage';

interface EmployeeAppProps {
  onSignOut: () => void;
}

export default function EmployeeApp({ onSignOut }: EmployeeAppProps) {
  const { currentUser } = useCRM();
  
  const [currentPath, setCurrentPath] = useState('/employee/dashboard');
  const [routeFilters, setRouteFilters] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stageAnimation, setStageAnimation] = useState(0);

  useEffect(() => {
    // Initial load animation sequence
    const t1 = setTimeout(() => setStageAnimation(1), 100); 
    const t2 = setTimeout(() => setStageAnimation(2), 200); 
    const t3 = setTimeout(() => setStageAnimation(3), 300); 
    
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleNavigate = (path: string, filters?: any) => {
    setCurrentPath(path);
    setRouteFilters(filters || null);
  };

  // Render the current page based on path
  const renderPage = () => {
    // Determine route name for permission check
    const routeName = currentPath === '/employee/dashboard' ? 'Dashboard' :
                      currentPath === '/employee/leads' ? 'Leads' :
                      currentPath === '/employee/followups' ? 'Leads' :
                      currentPath === '/employee/tasks' ? 'Dashboard' :
                      currentPath === '/employee/calendar' ? 'Dashboard' :
                      currentPath === '/employee/stock' ? 'Stock' :
                      currentPath === '/employee/reports' ? 'Reports' :
                      currentPath === '/employee/profile' ? 'Profile' : 'Dashboard';

    if (!canAccessRoute(currentUser, routeName)) {
      return <AccessRestricted onReturnToDashboard={() => handleNavigate('/employee/dashboard')} />;
    }

    switch (currentPath) {
      case '/employee/dashboard':
        return <EmployeeDashboard onNavigate={handleNavigate} />;
      case '/employee/leads':
        // Pass filters to Leads page (e.g. stage, status) if it supports it
        return <LeadsPage {...(routeFilters || {})} />;
      case '/employee/followups':
        return <FollowupsPage />;
      case '/employee/tasks':
        return <TasksPage onNavigate={handleNavigate} />;
      case '/employee/calendar':
        return <CalendarPage onNavigate={handleNavigate} />;
      case '/employee/stock':
        return <StockPage />;
      case '/employee/profile':
        return <ProfilePage />;
      case '/employee/reports':
        return <AdminReportsPage onNavigate={handleNavigate} />;
      default:
        return <EmployeeDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="admin-layout">
      <EmployeeSidebar 
        isSidebarCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        isMobileMenuOpen={isMobileMenuOpen}
        toggleMobileMenu={toggleMobileMenu}
        stageAnimation={stageAnimation}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onSignOut={onSignOut}
      />
      
      {/* Mobile overlay */}
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={toggleMobileMenu}></div>}

      <main className="admin-main">
        <header className={`admin-header ${stageAnimation >= 1 ? 'reveal' : ''}`}>
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
              <Menu size={24} />
            </button>
            <div className="breadcrumb desktop-only">
              <span className="text-muted">Solar CRM</span>
              <span className="mx-2 text-muted">/</span>
              <span className="font-semibold text-navy">Employee Workspace</span>
            </div>
          </div>
          
          <div className="header-right">
            <button className="notification-btn">
              <Bell size={20} />
              <span className="notification-indicator"></span>
            </button>
            
            <div className="profile-dropdown" onClick={() => setCurrentPath('/employee/profile')}>
              <div className="avatar">{currentUser?.initials || 'EM'}</div>
              <div className="profile-info desktop-only">
                <span className="profile-name">{currentUser?.name || 'Employee'}</span>
                <span className="profile-role">Employee</span>
              </div>
            </div>
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  );
}
