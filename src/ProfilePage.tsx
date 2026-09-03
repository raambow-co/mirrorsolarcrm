import React, { useState } from 'react';
import { User, Settings, Bell, Lock, Shield, Mail, Phone, Moon } from 'lucide-react';
import { useCRM } from './context/CRMContext';
import { useUI } from './context/UIContext';
import './SharedProfile.css';

export default function ProfilePage() {
  const { currentUser, leads } = useCRM();
  const { showToast } = useUI();
  
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Profile settings saved successfully', 'success');
  };

  const handlePasswordChange = () => {
    showToast('Password updated securely', 'success');
  };

  const activeLeads = leads.filter(l => !l.archived && l.stage !== 'Completed').length;

  return (
    <div className="dealer-profile-container">
      <div className="dealer-profile-header">
        <h1>Profile & Settings</h1>
        <p>Manage your account settings and preferences.</p>
      </div>

      <div className="profile-layout-grid">
        
        {/* Left Column: Avatar Card */}
        <div className="profile-card-left">
          <div className="profile-avatar-wrapper">
            <span className="profile-avatar-text">{currentUser?.name.charAt(0) || 'U'}</span>
          </div>
          <h2 className="profile-name-title">{currentUser?.name || 'Administrator'}</h2>
          <span className="profile-role-pill">{currentUser?.role || 'Admin'}</span>
          
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>{activeLeads}</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Active Leads</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>12</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Tasks Due</span>
            </div>
          </div>
        </div>

        {/* Right Column: Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Personal Info */}
          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <User className="profile-section-icon" size={20} /> Personal Information
            </h3>
            <form className="premium-form" onSubmit={handleSaveProfile}>
              <div className="premium-input-group">
                <label>Full Name</label>
                <input type="text" defaultValue={currentUser?.name || 'Administrator'} />
              </div>
              <div className="premium-input-group">
                <label>Email Address</label>
                <input type="email" defaultValue={`${currentUser?.name?.toLowerCase().replace(' ', '.')}@msolar.com`} />
              </div>
              <div className="premium-input-group">
                <label>Phone Number</label>
                <input type="tel" defaultValue="+91 98765 43210" />
              </div>
              <button type="submit" className="premium-btn-primary">Save Changes</button>
            </form>
          </div>

          {/* Preferences */}
          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <Settings className="profile-section-icon" size={20} /> Preferences
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>Email Notifications</span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Receive daily summaries and alerts via email.</span>
                </div>
                <div 
                  style={{ width: '48px', height: '24px', background: notifications ? 'var(--color-yellow)' : '#cbd5e1', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                  onClick={() => { setNotifications(!notifications); showToast(notifications ? 'Notifications disabled' : 'Notifications enabled', 'info'); }}
                >
                  <div style={{ position: 'absolute', top: '2px', left: notifications ? 'calc(100% - 22px)' : '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: '0.3s' }}></div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>Dark Mode Theme</span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Switch the CRM interface to a dark color scheme.</span>
                </div>
                <div 
                  style={{ width: '48px', height: '24px', background: darkMode ? 'var(--color-yellow)' : '#cbd5e1', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                  onClick={() => { setDarkMode(!darkMode); showToast('Dark mode preference saved', 'info'); }}
                >
                  <div style={{ position: 'absolute', top: '2px', left: darkMode ? 'calc(100% - 22px)' : '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: '0.3s' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <Shield className="profile-section-icon" size={20} /> Security Settings
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>Two-Factor Authentication (2FA)</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Require a verification code when logging in.</span>
              </div>
              <div 
                style={{ width: '48px', height: '24px', background: twoFactor ? '#16a34a' : '#cbd5e1', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                onClick={() => { setTwoFactor(!twoFactor); showToast(twoFactor ? '2FA Disabled' : '2FA Enabled', 'success'); }}
              >
                <div style={{ position: 'absolute', top: '2px', left: twoFactor ? 'calc(100% - 22px)' : '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: '0.3s' }}></div>
              </div>
            </div>

            <div className="premium-form" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
              <div className="premium-input-group">
                <label>Current Password</label>
                <input type="password" placeholder="••••••••" />
              </div>
              <div className="premium-input-group">
                <label>New Password</label>
                <input type="password" placeholder="••••••••" />
              </div>
              <button type="button" className="premium-btn-primary" onClick={handlePasswordChange} style={{ background: '#f8fafc', color: 'var(--color-navy)', border: '1px solid #e2e8f0' }}>Update Password</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
