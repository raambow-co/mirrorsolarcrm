import React from 'react';
import { 
  LayoutDashboard, Activity, Package, CreditCard, Menu, 
  Users, Briefcase, PieChart, Shield, Calendar, CheckSquare, PhoneCall
} from 'lucide-react';
import './MobileBottomNav.css';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MobileBottomNavProps {
  role: 'Admin' | 'Dealer' | 'Employee';
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenMenu: () => void;
  stockBadge?: number;
  leadsBadge?: number;
}

export default function MobileBottomNav({
  role,
  activeTab,
  onSelectTab,
  onOpenMenu,
  stockBadge = 0,
  leadsBadge = 0
}: MobileBottomNavProps) {
  
  // Custom items per role
  const getNavItems = (): NavItem[] => {
    if (role === 'Admin') {
      return [
        { id: 'Dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
        { id: 'Leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        { id: 'Stock', label: 'Stock', icon: <Package size={20} />, badge: stockBadge },
        { id: 'Payments', label: 'Payments', icon: <CreditCard size={20} /> },
      ];
    } else if (role === 'Dealer') {
      return [
        { id: '/dealer/dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
        { id: '/dealer/leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        { id: '/dealer/stock', label: 'Stock', icon: <Package size={20} />, badge: stockBadge },
        { id: '/dealer/payments', label: 'Payments', icon: <CreditCard size={20} /> },
      ];
    } else {
      return [
        { id: '/employee/dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
        { id: '/employee/leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        { id: '/employee/stock', label: 'Stock', icon: <Package size={20} /> },
        { id: '/employee/tasks', label: 'Tasks', icon: <CheckSquare size={20} /> },
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="mobile-bottom-app-bar" aria-label="Mobile Navigation">
      <div className="bottom-bar-inner">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
              type="button"
            >
              <div className="icon-wrapper">
                {item.icon}
                {item.badge && item.badge > 0 ? (
                  <span className="bottom-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                ) : null}
              </div>
              <span className="bottom-nav-label">{item.label}</span>
              {isActive && <div className="active-glow-pill" />}
            </button>
          );
        })}

        <button
          className="bottom-nav-item menu-trigger"
          onClick={onOpenMenu}
          type="button"
          aria-label="Open full menu"
        >
          <div className="icon-wrapper menu-icon">
            <Menu size={20} />
          </div>
          <span className="bottom-nav-label">More</span>
        </button>
      </div>
    </nav>
  );
}
