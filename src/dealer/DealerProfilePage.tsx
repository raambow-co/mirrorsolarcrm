import { useState } from 'react';
import { Mail, Phone, Briefcase, Activity, CheckCircle2, MapPin, Users, TrendingUp, User } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import '../SharedProfile.css';

export default function DealerProfilePage() {
  const { currentUser, leads } = useCRM();
  
  // Local editable state
  const [formData, setFormData] = useState({
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
    address: currentUser?.address || ''
  });

  if (!currentUser) return null;

  // Derived Performance Data
  const myLeads = leads.filter(l => l.dealer === currentUser.name && !l.archived);
  const totalLeads = myLeads.length;
  const convertedLeads = myLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  
  // Assigned Employees
  const assignedEmployees = Array.from(new Set(myLeads.map(l => l.assignedEmployee))).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'Dealer') {
      // In a real app we would call an updateDealer function, but for this mock frontend
      // we just pretend it saved successfully and keep local state.
      console.log('Saved mock dealer data:', formData);
    }
  };

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
            <span className="profile-avatar-text">{currentUser.initials}</span>
          </div>
          <h2 className="profile-name-title">{currentUser.name}</h2>
          <span className="profile-role-pill">{currentUser.role}</span>
        </div>

        {/* Right Column: Settings & Performance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <User className="profile-section-icon" size={20} /> Personal Information
            </h3>
            
            <form className="premium-form" onSubmit={handleSave}>
              <div className="premium-input-group">
                <label>Full Name</label>
                <input type="text" value={currentUser.name} disabled />
              </div>
              
              <div className="premium-input-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  required 
                />
              </div>
              
              <div className="premium-input-group">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  required 
                />
              </div>

              <div className="premium-input-group">
                <label>Business Address</label>
                <textarea 
                  rows={2} 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                  placeholder="Enter your business address"
                ></textarea>
              </div>

              <button type="submit" className="premium-btn-primary">Save Changes</button>
            </form>
          </div>

          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <Activity className="profile-section-icon" size={20} /> Performance Snapshot
            </h3>
            
            <div className="performance-grid">
              <div className="perf-metric-card">
                <span className="perf-metric-header">
                  <Activity size={16} /> Total Leads
                </span>
                <span className="perf-metric-value">{totalLeads}</span>
              </div>
              
              <div className="perf-metric-card">
                <span className="perf-metric-header">
                  <CheckCircle2 size={16} style={{ color: '#16a34a' }} /> Converted
                </span>
                <span className="perf-metric-value">{convertedLeads}</span>
              </div>

              <div className="perf-metric-card">
                <span className="perf-metric-header">
                  <TrendingUp size={16} style={{ color: 'var(--color-orange)' }} /> Conversion Rate
                </span>
                <span className="perf-metric-value">{conversionRate}%</span>
              </div>

              <div className="perf-metric-card">
                <span className="perf-metric-header">
                  <Users size={16} /> Assigned Employees
                </span>
                <span className="perf-metric-value">{assignedEmployees}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
