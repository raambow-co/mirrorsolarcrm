import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import type { Employee, Dealer, User as CRMUser } from './context/CRMContext';

export const seedFirebaseUsers = async (employees: Employee[], dealers: Dealer[]) => {
  const defaultPassword = 'Password123!';
  let seededCount = 0;
  let lastError = '';

  // 1. Seed Admin
  try {
    const adminEmail = 'admin@mirrorsolar.in';
    let uid = '';
    try {
      const adminAuth = await createUserWithEmailAndPassword(auth, adminEmail, defaultPassword);
      uid = adminAuth.user.uid;
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        const adminAuth = await signInWithEmailAndPassword(auth, adminEmail, defaultPassword);
        uid = adminAuth.user.uid;
      } else {
        throw err;
      }
    }
    
    const adminUser: CRMUser = {
      id: uid,
      name: 'Admin User',
      initials: 'AD',
      email: adminEmail,
      phone: '123-456-7890',
      role: 'Admin',
      status: 'Active',
      permissions: { dashboard: 'full', leads: 'full', employees: 'full', dealers: 'full', stock: 'full', reports: 'full', access: 'full', profile: 'full' },
      lastActive: 'Just now'
    };
    await setDoc(doc(db, 'users', uid), adminUser);
    seededCount++;
    console.log("Seeded Admin");
  } catch (err: any) {
    console.error("Error seeding Admin:", err);
    lastError = err.message || err.code || String(err);
  }

  // 2. Seed Employees
  for (const emp of employees) {
    try {
      const email = emp.email.toLowerCase().replace(/\s+/g, '');
      let uid = '';
      try {
        const userAuth = await createUserWithEmailAndPassword(auth, email, defaultPassword);
        uid = userAuth.user.uid;
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          const userAuth = await signInWithEmailAndPassword(auth, email, defaultPassword);
          uid = userAuth.user.uid;
        } else {
          throw err;
        }
      }
      
      const firestoreUser: CRMUser = {
        ...emp,
        id: uid,
        email: email
      };
      
      await setDoc(doc(db, 'users', uid), firestoreUser);
      seededCount++;
      console.log(`Seeded Employee: ${emp.name}`);
    } catch (err: any) {
      console.error(`Error seeding Employee ${emp.name}:`, err);
      if (!lastError) lastError = err.message || err.code || String(err);
    }
  }

  // 3. Seed Dealers
  for (const dlr of dealers) {
    try {
      const email = dlr.email.toLowerCase().replace(/\s+/g, '');
      let uid = '';
      try {
        const userAuth = await createUserWithEmailAndPassword(auth, email, defaultPassword);
        uid = userAuth.user.uid;
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          const userAuth = await signInWithEmailAndPassword(auth, email, defaultPassword);
          uid = userAuth.user.uid;
        } else {
          throw err;
        }
      }
      
      const firestoreUser: CRMUser = {
        ...dlr,
        id: uid,
        email: email
      };
      
      await setDoc(doc(db, 'users', uid), firestoreUser);
      seededCount++;
      console.log(`Seeded Dealer: ${dlr.name}`);
    } catch (err: any) {
      console.error(`Error seeding Dealer ${dlr.name}:`, err);
      if (!lastError) lastError = err.message || err.code || String(err);
    }
  }

  return { count: seededCount, error: lastError };
};
