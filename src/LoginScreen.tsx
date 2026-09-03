import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Loader2, Zap, Eye, EyeOff } from 'lucide-react';
import logoUrl from './assets/mirrorsolarlogo.png';
import { useCRM } from './context/CRMContext';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { seedFirebaseUsers } from './seedFirebase';
import './LoginScreen.css';

interface LoginScreenProps {
  role: string;
  onBack: () => void;
  onLoginSuccess?: (userId: string) => void;
}

export default function LoginScreen({ role, onBack, onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [stage, setStage] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);
  
  const { employees, dealers } = useCRM();

  useEffect(() => {
    // Entrance animations
    const t1 = setTimeout(() => setStage(1), 100);  // Arc draws
    const t2 = setTimeout(() => setStage(2), 300);  // Navy orbit & lines
    const t3 = setTimeout(() => setStage(3), 500);  // Orange nodes fade in
    const t4 = setTimeout(() => setStage(4), 700);  // Logo & Branding
    const t5 = setTimeout(() => setStage(5), 850);  // Form & Yellow Heading Accent

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    setErrorMsg('');
    try {
      let formattedEmail = email.toLowerCase().trim();
      if (!formattedEmail.includes('@')) {
        if (role === 'Dealer') {
          formattedEmail = `${formattedEmail}@dealer.in`;
        } else {
          formattedEmail = `${formattedEmail}@mirrorsolar.in`;
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, password);
      if (onLoginSuccess) {
        onLoginSuccess(userCredential.user.uid);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Invalid email or password.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      const result = await seedFirebaseUsers(employees, dealers);
      if (result.count === 0) {
        alert(`Failed to seed users. Firebase Error: ${result.error}`);
      } else {
        alert(`Successfully seeded ${result.count} users into Firebase! You can now log in with their email and Password123!`);
      }
    } catch (err) {
      alert("Error seeding database.");
    } finally {
      setIsSeeding(false);
    }
  };



  return (
    <div className="login-screen-container">
      {/* LEFT PANEL - Branding */}
      <div className="login-left-panel">
        
        {/* Subtle Solar Energy Visual System */}
        <div className="solar-visual-system">
          {/* Large partial yellow solar circle */}
          <svg className={`visual-yellow-arc ${stage >= 1 ? 'draw' : ''}`} viewBox="0 0 200 200">
             <circle cx="100" cy="100" r="90" className="yellow-arc-path" />
          </svg>
          
          {/* Dark navy curved orbit */}
          <svg className={`visual-navy-orbit ${stage >= 2 ? 'draw' : ''}`} viewBox="0 0 200 200">
             <circle cx="100" cy="100" r="140" className="navy-orbit-path" />
          </svg>

          {/* Thin geometric network */}
          <svg className={`visual-network ${stage >= 2 ? 'reveal' : ''}`} viewBox="0 0 400 400">
             <path d="M 50 150 Q 150 200 300 100" className="network-line" />
             <path d="M 100 300 Q 250 250 350 350" className="network-line" />
          </svg>

          {/* Orange energy nodes */}
          <div className={`energy-node node-1 ${stage >= 3 ? 'reveal' : ''}`}></div>
          <div className={`energy-node node-2 ${stage >= 3 ? 'reveal' : ''}`}></div>
          <div className={`energy-node node-3 ${stage >= 3 ? 'reveal' : ''}`}></div>
          
          {/* Orange Icon Accent */}
          <div className={`solar-icon-container ${stage >= 3 ? 'reveal' : ''}`}>
             <Zap className="solar-icon" size={24} strokeWidth={1.75} />
          </div>
        </div>
        
        <div className="left-content">
          <img src={logoUrl} alt="Solar CRM" className={`login-logo ${stage >= 4 ? 'reveal' : ''}`} />
          
          <div className={`left-text-group ${stage >= 4 ? 'reveal' : ''}`}>
            <h2>Powering <span className="text-highlight">smarter</span> solar operations.</h2>
            <p>Manage leads, teams, dealers and solar operations from one intelligent platform.</p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Login Form */}
      <div className="login-right-panel">
        <div className="login-form-container">
          
          <div className={`login-header ${stage >= 4 ? 'reveal' : ''}`}>
            <div className="role-badge">
              <div className="badge-indicator"></div>
              {role.toUpperCase()}
            </div>
            <h3>Welcome back</h3>
            <h1>{role} Login</h1>
            <div className={`heading-yellow-accent ${stage >= 5 ? 'draw' : ''}`}></div>
          </div>

          <form className="login-form" onSubmit={handleAuthSubmit}>
            {errorMsg && (
              <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem', padding: '0.75rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                {errorMsg}
              </div>
            )}
            
            <div className={`input-group ${stage >= 5 ? 'reveal' : ''}`} style={{ animationDelay: '0.1s' }}>
              <label>Username or Email</label>
              <div className="input-wrapper">
                <input 
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your username (e.g. jaswanth)"
                  required
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', appearance: 'none', background: 'transparent' }}
                />
                <div className="input-focus-border"></div>
              </div>
            </div>

            <div className={`input-group ${stage >= 5 ? 'reveal' : ''}`} style={{ animationDelay: '0.15s', marginTop: '1rem' }}>
              <label>Password</label>
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{ width: '100%', padding: '12px 40px 12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', appearance: 'none', background: 'transparent' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                <div className="input-focus-border"></div>
              </div>
            </div>

            {/* Password input removed for mock login */}
            <div className={`form-actions-row ${stage >= 5 ? 'reveal' : ''}`} style={{ animationDelay: '0.2s' }}>
              <label className="custom-checkbox-container">
                <input type="checkbox" />
                <span className="custom-checkmark"></span>
                <span className="checkbox-text">Remember me</span>
              </label>
            </div>

            <button 
              type="submit" 
              className={`btn-signin ${stage >= 5 ? 'reveal' : ''}`} 
              disabled={isSigningIn}
            >
              <div className="btn-yellow-accent"></div>
              {isSigningIn ? (
                <span className="btn-content loading">
                  <Loader2 className="spinner" size={20} />
                  Signing in...
                </span>
              ) : (
                <span className="btn-content">
                  Sign In <ArrowRight className="btn-arrow" size={18} />
                </span>
              )}
            </button>
          </form>

          <button 
            type="button" 
            className={`btn-back ${stage >= 5 ? 'reveal' : ''}`} 
            onClick={onBack}
          >
            <ArrowLeft className="back-arrow" size={16} /> Change account type
          </button>
          
          <button 
            type="button" 
            className={`btn-back ${stage >= 5 ? 'reveal' : ''}`} 
            onClick={handleSeedDatabase}
            disabled={isSeeding}
            style={{ marginTop: '2rem', color: '#6366f1', background: '#e0e7ff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isSeeding ? 'Seeding...' : 'One-Time Database Seed'}
          </button>
          
        </div>
      </div>
    </div>
  );
}
