import { useState, useEffect } from 'react';
import { Menu, Bell } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { canAccessRoute } from '../utils/permissionCalculations';
import AccessRestricted from '../components/AccessRestricted';
import DealerSidebar from './DealerSidebar';

// Stubs for future pages
import DealerDashboard from './DealerDashboard';
import ProfilePage from '../ProfilePage';
import LeadsPage from '../LeadsPage';
import FollowupsPage from '../FollowupsPage';
import StockPage from '../StockPage';
import AdminReportsPage from '../AdminReportsPage';
import TasksPage from '../TasksPage';
import CalendarPage from '../CalendarPage';
import PaymentsPage from '../PaymentsPage';

interface DealerAppProps {
  onSignOut: () => void;
}

export default function DealerApp({ onSignOut }: DealerAppProps) {
  const { currentUser } = useCRM();
  
  const [currentPath, setCurrentPath] = useState('/dealer/dashboard');
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
    const routeName = currentPath === '/dealer/dashboard' ? 'Dashboard' :
                      currentPath === '/dealer/leads' ? 'Leads' :
                      currentPath === '/dealer/payments' ? 'Dashboard' :
                      currentPath === '/dealer/followups' ? 'Leads' :
                      currentPath === '/dealer/tasks' ? 'Dashboard' :
                      currentPath === '/dealer/calendar' ? 'Dashboard' :
                      currentPath === '/dealer/stock' ? 'Stock' :
                      currentPath === '/dealer/reports' ? 'Reports' :
                      currentPath === '/dealer/profile' ? 'Profile' : 'Dashboard';

    if (!canAccessRoute(currentUser, routeName)) {
      return <AccessRestricted onReturnToDashboard={() => handleNavigate('/dealer/dashboard')} />;
    }

    switch (currentPath) {
      case '/dealer/dashboard':
        return <DealerDashboard onNavigate={handleNavigate} />;
      case '/dealer/leads':
        return <LeadsPage {...(routeFilters || {})} />;
      case '/dealer/payments':
        return <PaymentsPage onNavigate={handleNavigate} />;
      case '/dealer/followups':
        return <FollowupsPage />;
      case '/dealer/tasks':
        return <TasksPage onNavigate={handleNavigate} />;
      case '/dealer/calendar':
        return <CalendarPage onNavigate={handleNavigate} />;
      case '/dealer/stock':
        return <StockPage />;
      case '/dealer/profile':
        return <ProfilePage />;
      case '/dealer/reports':
        return <AdminReportsPage onNavigate={handleNavigate} />;
      default:
        return <DealerDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="admin-layout">
      <DealerSidebar 
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
              <span className="font-semibold text-navy">Dealer Workspace</span>
            </div>
          </div>
          
          <div className="header-right">
            <button className="notification-btn">
              <Bell size={20} />
              <span className="notification-indicator"></span>
            </button>
            
            <div className="profile-dropdown" onClick={() => setCurrentPath('/dealer/profile')}>
              <div className="avatar">{currentUser?.initials || 'DL'}</div>
              <div className="profile-info desktop-only">
                <span className="profile-name">{currentUser?.name || 'Dealer'}</span>
                <span className="profile-role">Dealer</span>
              </div>
            </div>
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  );
}
