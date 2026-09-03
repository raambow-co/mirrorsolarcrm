import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import logoUrl from './assets/mirrorsolarlogo.png';
import RoleSelection from './RoleSelection';
import LoginScreen from './LoginScreen';
import AdminDashboard from './AdminDashboard';
import EmployeeApp from './employee/EmployeeApp';
import DealerApp from './dealer/DealerApp';
import './App.css';

import { StockProvider } from './context/StockContext';
import { CRMProvider } from './context/CRMContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { useCRM } from './context/CRMContext';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

function SplashScreen() {
  const [stage, setStage] = useState(0);
  const navigate = useNavigate();
  const { currentUser: authUser, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    
    const timer1 = setTimeout(() => setStage(1), 400); 
    const timer2 = setTimeout(() => setStage(2), 1000); 
    const timer3 = setTimeout(() => setStage(3), 1400); 
    const timer4 = setTimeout(() => setStage(4), 1800); 
    const timer5 = setTimeout(() => setStage(5), 2300); 
    const timer6 = setTimeout(() => setStage(6), 3400);
    const timer7 = setTimeout(() => {
      const user = authUser;
      if (user) {
        navigate(`/${user.role.toLowerCase()}/dashboard`, { replace: true });
      } else {
        navigate('/role', { replace: true });
      }
    }, 3900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      clearTimeout(timer6);
      clearTimeout(timer7);
    };
  }, [loading, authUser, navigate]);

  return (
    <div className={`splash-container ${stage === 6 ? 'fade-out' : ''}`}>
      <div className="logo-section">
        <svg className="energy-svg" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="energyGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-navy)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--color-navy)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--color-yellow)" stopOpacity="1" />
            </linearGradient>
          </defs>
          <path className={`energy-path ${stage >= 1 ? 'move' : ''}`} d="M 10 90 Q 25 50 50 50" />
        </svg>
        <svg className="solar-arc-svg" viewBox="0 0 100 100">
          <circle className={`arc-path ${stage >= 1 ? 'draw' : ''} ${stage >= 2 ? 'complete' : ''}`} cx="50" cy="50" r="48" />
        </svg>
        <img src={logoUrl} alt="Solar CRM Logo" className={`splash-logo ${stage >= 2 ? 'reveal' : ''}`} />
      </div>
      <div className="brand-section">
        <h1 className={`brand-title ${stage >= 3 ? 'reveal' : ''}`}>SOLAR CRM</h1>
        <h2 className={`brand-tagline ${stage >= 3 ? 'reveal-delayed' : ''}`}>Smart Solar Management</h2>
        <div className={`micro-line-container ${stage >= 4 ? 'reveal' : ''}`}>
          <div className="micro-line-traveler"></div>
        </div>
      </div>
      <div className={`loader-container ${stage >= 5 ? 'visible' : ''}`}>
        <div className="dot-loader">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
    </div>
  );
}

function RoleSelectionWrapper() {
  const navigate = useNavigate();
  return <RoleSelection onSelectRole={(r) => { navigate('/login', { state: { role: r } }); }} />;
}

function LoginScreenWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.state?.role || 'Admin';
  
  const { currentUser, loading } = useAuth();
  
  // Watch for successful login from AuthContext
  useEffect(() => {
    if (!loading && currentUser) {
      if (currentUser.role === 'Admin') navigate('/admin/dashboard', { replace: true });
      else if (currentUser.role === 'Employee') navigate('/employee/dashboard', { replace: true });
      else if (currentUser.role === 'Dealer') navigate('/dealer/dashboard', { replace: true });
    }
  }, [currentUser, loading, navigate]);

  return (
    <LoginScreen 
      role={role} 
      onBack={() => navigate('/role')} 
    />
  );
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) {
  const { currentUser: authUser, loading } = useAuth();
  
  if (loading) return null;
  
  const user = authUser;
  if (!user) {
    return <Navigate to="/role" replace />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role.toLowerCase()}/dashboard`} replace />;
  }
  
  return <>{children}</>;
}

function NotFound() {
  const navigate = useNavigate();
  const { currentUser: authUser } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', color: '#0b1f3a', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 800, margin: '0 0 1rem 0' }}>404</h1>
      <p style={{ fontSize: '1.2rem', color: '#64748b', marginBottom: '2rem' }}>Page Not Found</p>
      <button 
        onClick={() => {
          const user = authUser;
          if (user) {
            navigate(`/${user.role.toLowerCase()}/dashboard`);
          } else {
            navigate('/role');
          }
        }}
        style={{ background: '#f5c518', color: '#0b1f3a', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
      >
        Back to Dashboard
      </button>
    </div>
  );
}

function AppContent() {
  const { setCurrentUser } = useCRM();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
    setCurrentUser(null);
    navigate('/role');
  };

  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/role" element={<RoleSelectionWrapper />} />
      <Route path="/login" element={<LoginScreenWrapper />} />
      
      <Route 
        path="/admin/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminDashboard onSignOut={handleSignOut} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/employee/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['Employee']}>
            <EmployeeApp onSignOut={handleSignOut} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dealer/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['Dealer']}>
            <DealerApp onSignOut={handleSignOut} />
          </ProtectedRoute>
        } 
      />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CRMProvider>
          <StockProvider>
            <UIProvider>
              <AppContent />
            </UIProvider>
          </StockProvider>
        </CRMProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
