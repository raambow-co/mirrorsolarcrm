

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User as CRMUser, UserPermissions } from './CRMContext';

const defaultAdminPermissions: UserPermissions = {
  dashboard: 'full', leads: 'full', employees: 'full', dealers: 'full', stock: 'full', reports: 'full', access: 'full', profile: 'full'
};

interface AuthContextType {
  currentUser: CRMUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CRMUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        // Fetch custom user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            let userData = userDoc.data() as CRMUser;
            // Inject fallback permissions if they are missing
            if (!userData.permissions) {
              const defaultEmployeePermissions = {
                dashboard: 'view', leads: 'edit', employees: 'none', dealers: 'none', stock: 'view', reports: 'none', access: 'none', profile: 'edit'
              };
              const defaultDealerPermissions = {
                dashboard: 'view', leads: 'edit', employees: 'none', dealers: 'none', stock: 'view', reports: 'none', access: 'none', profile: 'edit'
              };
              if (userData.role === 'Admin') userData.permissions = defaultAdminPermissions;
              else if (userData.role === 'Employee') userData.permissions = defaultEmployeePermissions as any;
              else if (userData.role === 'Dealer') userData.permissions = defaultDealerPermissions as any;
              else userData.permissions = {} as any;
            }
            setCurrentUser(userData);
          } else {
            console.error("User document not found in Firestore!");
            setCurrentUser(null);
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
          setCurrentUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
