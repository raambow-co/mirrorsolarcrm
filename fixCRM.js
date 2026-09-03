const fs = require('fs');
const content = fs.readFileSync('src/context/CRMContext.tsx', 'utf8');

const replacement = `  const users: User[] = [adminUser, ...employees, ...dealers];

  const addEmployee = async (emp: Omit<Employee, 'id' | 'permissions' | 'role'>) => {
    const newId = \`EMP\${Date.now()}\`; // Fallback ID
    const newEmployee: Employee = { ...emp, id: newId, role: 'Employee', permissions: { ...defaultEmployeePermissions } };
    try {
      await setDoc(doc(db, 'users', newId), newEmployee);
    } catch (err) {
      console.error("Error adding employee:", err);
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
    } catch (err) {
      console.error("Error updating employee:", err);
    }
  };

  const addDealer = async (dealer: Omit<Dealer, 'id' | 'permissions' | 'role'>) => {
    const newId = \`DLR\${Date.now()}\`;
    const newDealer: Dealer = { ...dealer, id: newId, role: 'Dealer', permissions: { ...defaultDealerPermissions } };
    try {
      await setDoc(doc(db, 'users', newId), newDealer);
    } catch (err) {
      console.error("Error adding dealer:", err);
    }
  };

  const updateDealer = async (id: string, updates: Partial<Dealer>) => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
    } catch (err) {
      console.error("Error updating dealer:", err);
    }
  };

  const addLead = async (lead: Omit<MockLead, 'id'>) => {
    try {
      await addDoc(collection(db, 'leads'), lead);
    } catch (err) {
      console.error("Error adding lead:", err);
    }
  };

  const updateLead = async (id: string, updates: Partial<MockLead>) => {
    try {
      await updateDoc(doc(db, 'leads', id), updates);
    } catch (err) {
      console.error("Error updating lead:", err);
    }
  };

  const updateLeadStage = async (leadId: string, newStage: Stage) => {
    try {
      const updates: any = { stage: newStage, updatedAt: 'Just now' };
      if (['Converted', 'PM Survey', 'Loan', 'Material', 'Completed'].includes(newStage)) {
        updates.convertedAt = new Date().toISOString();
      }
      await updateDoc(doc(db, 'leads', leadId), updates);
    } catch (err) {
      console.error("Error updating lead stage:", err);
    }
  };

  const updateUserPermissions = async (userId: string, permissions: UserPermissions) => {
    try {
      await updateDoc(doc(db, 'users', userId), { permissions });
    } catch (err) {
      console.error("Error updating user permissions:", err);
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (err) {
      console.error("Error updating user role:", err);
    }
  };

  const updateUserStatus = async (userId: string, status: UserStatus) => {`;

const newContent = content.replace(
  "  const users: User[] = [adminUser, ...employees, ...dealers];\n\n  const updateUserStatus = async (userId: string, status: UserStatus) => {",
  replacement
);

fs.writeFileSync('src/context/CRMContext.tsx', newContent);
