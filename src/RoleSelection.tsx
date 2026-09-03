import { useEffect, useState } from 'react';
import { Shield, User, Briefcase, ArrowRight } from 'lucide-react';
import logoUrl from './assets/mirrorsolarlogo.png';
import './RoleSelection.css';

export default function RoleSelection({ onSelectRole }: { onSelectRole?: (role: string) => void }) {
  const [stage, setStage] = useState(0);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    // Advanced orchestration sequence
    const t1 = setTimeout(() => setStage(1), 100);  // Background solar arcs
    const t2 = setTimeout(() => setStage(2), 250);  // Logo settles
    const t3 = setTimeout(() => setStage(3), 400);  // "Welcome back"
    const t4 = setTimeout(() => setStage(4), 500);  // "Login as"
    const t5 = setTimeout(() => setStage(5), 650);  // Description
    const t6 = setTimeout(() => setStage(6), 700);  // Cards enter + path
    const t7 = setTimeout(() => setStage(7), 1000); // Footer text + accent
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
    };
  }, []);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setTimeout(() => {
      if (onSelectRole) onSelectRole(role);
    }, 600);
  };

  return (
    <div className="role-container">
      {/* 1. Subtle Solar Ecosystem Background Layers */}
      <div className={`role-bg-ecosystem ${stage >= 1 ? 'reveal' : ''}`}>
        {/* Large partial solar circle */}
        <div className="bg-solar-ring"></div>
        {/* Navy geometric arc */}
        <div className="bg-navy-arc"></div>
        {/* Tiny accent nodes */}
        <div className="bg-node node-1"></div>
        <div className="bg-node node-2"></div>
      </div>

      <div className={`role-logo-container ${stage >= 2 ? 'reveal' : ''}`}>
        <img src={logoUrl} alt="Solar CRM Logo" className="role-logo" />
      </div>

      <div className="role-header">
        <h3 className={`role-welcome ${stage >= 3 ? 'reveal' : ''}`}>Welcome back</h3>
        <h1 className={`role-title ${stage >= 4 ? 'reveal' : ''}`}>Login as</h1>
        <p className={`role-subtitle ${stage >= 5 ? 'reveal' : ''}`}>Choose how you want to access Solar CRM</p>
      </div>

      <div className="role-cards-section">
        {/* Curved energy path connecting cards */}
        <div className={`role-energy-path ${stage >= 6 ? 'reveal' : ''}`}>
          <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="energy-path-svg">
            <path d="M 0 100 C 300 160, 700 40, 1000 100" />
          </svg>
        </div>

        <div className={`role-cards-wrapper ${stage >= 6 ? 'reveal' : ''}`}>
          <button 
            className={`role-card card-admin ${selectedRole === 'Admin' ? 'selected' : ''} ${selectedRole && selectedRole !== 'Admin' ? 'dimmed' : ''}`} 
            onClick={() => handleRoleSelect('Admin')}
          >
            <div className="role-card-content">
              <div className="role-icon-wrapper icon-admin">
                <Shield className="role-icon" size={24} strokeWidth={1.75} />
              </div>
              <h2>Admin</h2>
              <p>Manage the entire CRM</p>
            </div>
            <div className="role-card-footer">
              <ArrowRight className="role-arrow" size={18} />
            </div>
            <div className="card-accent-line accent-admin">
              <div className="accent-line-traveler"></div>
            </div>
          </button>

          <button 
            className={`role-card card-employee ${selectedRole === 'Employee' ? 'selected' : ''} ${selectedRole && selectedRole !== 'Employee' ? 'dimmed' : ''}`} 
            onClick={() => handleRoleSelect('Employee')}
          >
            <div className="role-card-content">
              <div className="role-icon-wrapper icon-employee">
                <User className="role-icon" size={24} strokeWidth={1.75} />
              </div>
              <h2>Employee</h2>
              <p>Manage assigned leads</p>
            </div>
            <div className="role-card-footer">
              <ArrowRight className="role-arrow" size={18} />
            </div>
            <div className="card-accent-line accent-employee">
              <div className="accent-line-traveler"></div>
            </div>
          </button>

          <button 
            className={`role-card card-dealer ${selectedRole === 'Dealer' ? 'selected' : ''} ${selectedRole && selectedRole !== 'Dealer' ? 'dimmed' : ''}`} 
            onClick={() => handleRoleSelect('Dealer')}
          >
            <div className="role-card-content">
              <div className="role-icon-wrapper icon-dealer">
                <Briefcase className="role-icon" size={24} strokeWidth={1.75} />
              </div>
              <h2>Dealer</h2>
              <p>Manage your leads</p>
            </div>
            <div className="role-card-footer">
              <ArrowRight className="role-arrow" size={18} />
            </div>
            <div className="card-accent-line accent-dealer">
              <div className="accent-line-traveler"></div>
            </div>
          </button>
        </div>
      </div>

      <div className={`role-footer ${stage >= 7 ? 'reveal' : ''}`}>
        <h4>One platform. Every solar operation.</h4>
        <p>Select your account type to continue</p>
      </div>

      {/* Bottom Brand Accent */}
      <div className={`bottom-brand-accent ${stage >= 7 ? 'reveal' : ''}`}>
        <div className="brand-line"></div>
        <div className="brand-node"></div>
        <div className="brand-line"></div>
      </div>
    </div>
  );
}
