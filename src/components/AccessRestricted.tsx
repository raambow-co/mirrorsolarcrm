import { Lock } from 'lucide-react';

interface AccessRestrictedProps {
  onReturnToDashboard: () => void;
}

export default function AccessRestricted({ onReturnToDashboard }: AccessRestrictedProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      padding: '2rem',
      textAlign: 'center',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: '#fef2f2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        color: '#ef4444'
      }}>
        <Lock size={32} />
      </div>
      <h2 style={{
        fontSize: '1.75rem',
        fontWeight: 800,
        color: 'var(--color-navy)',
        marginBottom: '0.5rem'
      }}>
        Access Restricted
      </h2>
      <p style={{
        color: '#64748b',
        fontWeight: 500,
        marginBottom: '2rem',
        maxWidth: '400px'
      }}>
        You don't have permission to view this page. If you believe this is an error, please contact your administrator.
      </p>
      <button 
        style={{
          padding: '0.75rem 1.5rem',
          background: 'var(--color-navy)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          cursor: 'pointer'
        }}
        onClick={onReturnToDashboard}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
