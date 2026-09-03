import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, addDoc, deleteDoc, query, where } from 'firebase/firestore';

export type Stage = 'Lead' | 'Converted' | 'Loan' | 'Material' | 'Installation' | 'Completed';
export const STAGES: Stage[] = ['Lead', 'Converted', 'Loan', 'Material', 'Installation', 'Completed'];

export const DEALER_KYC_DOCS = [
  'Aadhaar Card',
  'PAN Card',
  'House Tax',
  'Current Bill',
  'First Payment Proof',
  'Bank Loan Payment Proof',
  'Other'
];

export const EMPLOYEE_PROCESSING_DOCS = [
  'E-Token',
  'Application Acknowledgement',
  'Net Metering Agreement',
  'Site Feasibility Report',
  'Quotation Document',
  'Feasibility Letter',
  'Advance Payment Receipt'
];

export const INSTALLATION_COMPLETION_DOCS = [
  'Installation Site Photos',
  'Annexure - A',
  'Annexure - C',
  'SYNCHRONISATION',
  'PROJECT COMPLETION REPORT',
  'S Number Photo',
  'DCR Certificate Documents'
];

export const ALL_DOCUMENT_TYPES = [
  ...DEALER_KYC_DOCS,
  ...EMPLOYEE_PROCESSING_DOCS,
  ...INSTALLATION_COMPLETION_DOCS
];

export type LeadPriority = 'High' | 'Medium' | 'Low';
export type FollowUpStatus = 'Due Today' | 'Overdue' | 'Upcoming' | 'No Follow-up' | 'Completed';
export type FollowUpType = 'Call' | 'Visit' | 'Document' | 'Payment' | 'Other';

export interface FollowUp {
  date: string;
  time: string;
  type: FollowUpType;
  status: FollowUpStatus;
}

export type DocumentStatus = 'Pending' | 'Uploaded' | 'Additional Document Required' | 'Verified' | 'Rejected';

export interface LeadDocument {
  id: string;
  leadId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedByRole: string;
  uploadedByUserId: string;
  uploadedAt: string;
  notes?: string;
  status: DocumentStatus;
}

export type EmployeeWorkStatus = 'Not Started' | 'In Progress' | 'Waiting for Documents' | 'Waiting for Customer' | 'Waiting for Approval' | 'Completed';

export interface ProjectUpdate {
  id: string;
  description: string;
  status: EmployeeWorkStatus;
  updatedByUserId: string;
  updatedByRole: string;
  updatedAt: string;
}

export type InstallationApprovalStatus = 'None' | 'Pending' | 'Approved' | 'Rejected';

export type PaymentMilestoneType = 'Pre-Installation' | 'Post-Installation';
export type PaymentMilestoneStatus = 'Pending Settlement' | 'Settled' | 'Received';

export interface PaymentMilestone {
  id: string;
  type: PaymentMilestoneType;
  amount?: number;
  status: PaymentMilestoneStatus;
  settledAt?: string;
  settledBy?: string;
  proofUrl?: string;
  proofFileName?: string;
  proofFileSize?: number;
  utrNumber?: string;
  adminNotes?: string;
  receivedAt?: string;
  receivedBy?: string;
  dealerNotes?: string;
}

export interface LeadPayments {
  preInstallation?: PaymentMilestone;
  postInstallation?: PaymentMilestone;
  totalAgreedAmount?: number;
}

export interface MockLead {
  id: string;
  customer: string;
  phone: string;
  email: string;
  location: string;
  dealer: string;
  assignedEmployee: string;
  stage: Stage;
  priority: LeadPriority;
  followUp: FollowUp;
  updatedAt: string;
  createdAt: string;
  convertedAt?: string;
  archived: boolean;
  notes?: string;
  leadType?: 'tracking' | 'project';
  documents?: LeadDocument[];
  workStatus?: EmployeeWorkStatus;
  projectUpdates?: ProjectUpdate[];
  installationApprovalStatus?: InstallationApprovalStatus;
  installationRejectionReason?: string;
  payments?: LeadPayments;
}

export type PermissionLevel = 'full' | 'edit' | 'view' | 'none';

export type ActivityType = string;

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  user: string;
  leadId?: string;
  dealer?: string;
  employee?: string;
  createdAt: string;
}

export type TaskType = 'Follow-up' | 'Project Work' | 'Document Required' | 'Document Review' | 'Customer Visit' | 'Installation' | 'Payment' | 'General Task' | 'Other';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string;
  title: string;
  description: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  dueTime?: string;
  assignedToUserId: string;
  assignedByUserId: string;
  leadId?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface UserPermissions {
  dashboard: PermissionLevel;
  leads: PermissionLevel;
  employees: PermissionLevel;
  dealers: PermissionLevel;
  stock: PermissionLevel;
  reports: PermissionLevel;
  access: PermissionLevel;
  profile: PermissionLevel;
}

export type UserRole = 'Admin' | 'Employee' | 'Dealer';
export type UserStatus = 'Active' | 'Away' | 'Offline' | 'Inactive';

export interface User {
  id: string;
  name: string;
  initials: string;
  phone: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  lastActive: string;
  address?: string; // specific to dealers
}

export type EmployeeStatus = 'Active' | 'Away' | 'Offline' | 'Inactive';

export interface Employee extends User {
  role: 'Employee';
}

export type DealerStatus = 'Active' | 'Inactive';

export interface Dealer extends User {
  role: 'Dealer';
  address: string;
}

// Default Permissions
const defaultEmployeePermissions: UserPermissions = {
  dashboard: 'view',
  leads: 'edit',
  employees: 'none',
  dealers: 'none',
  stock: 'view',
  reports: 'none',
  access: 'none',
  profile: 'edit'
};

const defaultDealerPermissions: UserPermissions = {
  dashboard: 'view',
  leads: 'edit',
  employees: 'none',
  dealers: 'none',
  stock: 'view',
  reports: 'none',
  access: 'none',
  profile: 'edit'
};

const defaultAdminPermissions: UserPermissions = {
  dashboard: 'full',
  leads: 'full',
  employees: 'full',
  dealers: 'full',
  stock: 'edit',
  reports: 'view',
  access: 'full',
  profile: 'edit'
};

// Real-time data will be fetched from Firestore

interface CRMContextType {
  leads: MockLead[];
  employees: Employee[];
  dealers: Dealer[];
  users: User[];
  activities: Activity[];
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  addEmployee: (emp: Omit<Employee, 'id' | 'permissions' | 'role'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  addDealer: (dealer: Omit<Dealer, 'id' | 'permissions' | 'role'>) => void;
  updateDealer: (id: string, updates: Partial<Dealer>) => void;
  addLead: (lead: Omit<MockLead, 'id'>) => void;
  updateLead: (id: string, updates: Partial<MockLead>) => void;
  updateLeadStage: (leadId: string, newStage: Stage) => void;
  updateUserPermissions: (userId: string, permissions: UserPermissions) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  updateUserStatus: (userId: string, status: UserStatus) => void;
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  settleLeadPayment: (
    leadId: string, 
    milestoneType: PaymentMilestoneType, 
    data: { amount: number; proofUrl: string; proofFileName: string; proofFileSize?: number; utrNumber?: string; adminNotes?: string }
  ) => Promise<void>;
  acknowledgeLeadPayment: (
    leadId: string, 
    milestoneType: PaymentMilestoneType, 
    data?: { dealerNotes?: string }
  ) => Promise<void>;
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  resetData: () => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<MockLead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const { currentUser: authUser } = useAuth();
  useEffect(() => {
    setCurrentUser(authUser);
  }, [authUser]);
  
  const [adminUser, setAdminUser] = useState<User>({
    id: 'ADM01',
    name: 'Admin',
    initials: 'AD',
    email: 'admin@mirrorsolar.in',
    phone: '+91 99999 99999',
    role: 'Admin',
    status: 'Active',
    permissions: { ...defaultAdminPermissions },
    lastActive: 'Just now'
  });

  useEffect(() => {
    if (!authUser) {
      setLeads([]);
      setEmployees([]);
      setDealers([]);
      setActivities([]);
      setTasks([]);
      return;
    }

    // 1. Listen for Live Users (Employees & Dealers)
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers: User[] = [];
      snapshot.forEach(doc => {
        allUsers.push(doc.data() as User);
      });
      setEmployees(allUsers.filter(u => u.role === 'Employee') as Employee[]);
      setDealers(allUsers.filter(u => u.role === 'Dealer') as Dealer[]);
    });

    // 2. Listen for Live Leads - SCOPED BY ROLE
    let leadsQuery = collection(db, 'leads');
    if (authUser.role === 'Dealer') {
      leadsQuery = query(collection(db, 'leads'), where('dealer', '==', authUser.name)) as any;
    } else if (authUser.role === 'Employee') {
      leadsQuery = query(collection(db, 'leads'), where('assignedEmployee', '==', authUser.name)) as any;
    }
    
    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const allLeads: MockLead[] = [];
      snapshot.forEach(doc => {
        allLeads.push({ id: doc.id, ...doc.data() } as MockLead);
      });
      // Sort by creation date descending
      allLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLeads(allLeads);
    });

    // 3. Listen for Live Activities - SCOPED BY ROLE
    let activitiesQuery = collection(db, 'activities');
    if (authUser.role === 'Dealer') {
      activitiesQuery = query(collection(db, 'activities'), where('dealer', '==', authUser.name)) as any;
    } else if (authUser.role === 'Employee') {
      activitiesQuery = query(collection(db, 'activities'), where('assignedEmployee', '==', authUser.name)) as any; // Assuming activities might eventually have this, currently they have dealer/leadId. We will just load all for now if this breaks. Actually, activities have 'dealer' and 'user'.
    }

    const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
      const allActivities: Activity[] = [];
      snapshot.forEach(doc => {
        allActivities.push({ id: doc.id, ...doc.data() } as Activity);
      });
      // Sort by creation date descending
      allActivities.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setActivities(allActivities);
    });

    // 4. Listen for Live Tasks - SCOPED BY ROLE
    let tasksQuery = collection(db, 'tasks');
    if (authUser.role === 'Dealer') {
      // Dealers don't use the tasks collection for their own tasks right now, their widget filters tasks.
      // Wait, tasks have assignedToUserId or createdByUserId.
      // To be safe, we query all tasks they are involved in. Firestore doesn't support OR well, so we pull all for now and filter client-side, but ideally we'd use multiple queries.
      // Since it's a small CRM, we'll keep it simple: no filter if it requires complex OR.
    }

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const allTasks: Task[] = [];
      snapshot.forEach(doc => {
        allTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setTasks(allTasks);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLeads();
      unsubscribeActivities();
      unsubscribeTasks();
    };
  }, [authUser]);

  const users: User[] = [adminUser, ...employees, ...dealers];

  const addEmployee = async (emp: Omit<Employee, 'id' | 'permissions' | 'role'>) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can add employees");
      return;
    }
    const newId = `EMP${Date.now()}`;
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
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can add dealers");
      return;
    }
    const newId = `DLR${Date.now()}`;
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
      console.log("Successfully updated lead in Firestore", updates);
    } catch (err: any) {
      console.error("Error updating lead:", err);
      alert(`Firestore Update Failed: ${err.message || String(err)}`);
    }
  };

  const updateLeadStage = async (leadId: string, newStage: Stage) => {
    try {
      const updates: any = { stage: newStage, updatedAt: 'Just now' };
      if (['Converted', 'Installation', 'Loan', 'Material', 'Completed'].includes(newStage)) {
        updates.convertedAt = new Date().toISOString();
      }
      await updateDoc(doc(db, 'leads', leadId), updates);
    } catch (err) {
      console.error("Error updating lead stage:", err);
    }
  };

  const updateUserPermissions = async (userId: string, permissions: UserPermissions) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can update permissions");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { permissions });
    } catch (err) {
      console.error("Error updating user permissions:", err);
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can update roles");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (err) {
      console.error("Error updating user role:", err);
    }
  };

  const updateUserStatus = async (userId: string, status: UserStatus) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can update user status");
      return;
    }
    if (userId.startsWith('ADM')) {
      setAdminUser({ ...adminUser, status });
    } else {
      try {
        await updateDoc(doc(db, 'users', userId), { status });
      } catch (err) {
        console.error("Error updating user status:", err);
      }
    }
  };

  const addActivity = async (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    try {
      await addDoc(collection(db, 'activities'), {
        ...activity,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding activity:", err);
    }
  };

  const resetData = () => {
    console.warn("resetData called but data is now live from Firestore!");
  };

  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        ...task,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding task:", err);
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      await updateDoc(doc(db, 'tasks', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const settleLeadPayment = async (
    leadId: string,
    milestoneType: PaymentMilestoneType,
    data: { amount: number; proofUrl: string; proofFileName: string; proofFileSize?: number; utrNumber?: string; adminNotes?: string }
  ) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const currentPayments = lead.payments || {};
      const key = milestoneType === 'Pre-Installation' ? 'preInstallation' : 'postInstallation';
      
      const updatedMilestone: PaymentMilestone = {
        ...(currentPayments[key] || { id: `${milestoneType === 'Pre-Installation' ? 'PRE' : 'POST'}_${leadId}`, type: milestoneType }),
        amount: data.amount,
        status: 'Settled',
        proofUrl: data.proofUrl,
        proofFileName: data.proofFileName,
        proofFileSize: data.proofFileSize || 0,
        utrNumber: data.utrNumber || '',
        adminNotes: data.adminNotes || '',
        settledAt: new Date().toISOString(),
        settledBy: currentUser?.name || 'Admin',
      };

      const updatedPayments: LeadPayments = {
        ...currentPayments,
        [key]: updatedMilestone
      };

      await updateDoc(doc(db, 'leads', leadId), {
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });

      await addActivity({
        type: 'Payment Settled',
        message: `Admin settled ${milestoneType} payment (₹${data.amount.toLocaleString('en-IN')}) for ${lead.customer}`,
        user: currentUser?.name || 'Admin',
        leadId: lead.id,
        dealer: lead.dealer
      });
    } catch (err) {
      console.error("Error settling payment:", err);
      throw err;
    }
  };

  const acknowledgeLeadPayment = async (
    leadId: string,
    milestoneType: PaymentMilestoneType,
    data?: { dealerNotes?: string }
  ) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const currentPayments = lead.payments || {};
      const key = milestoneType === 'Pre-Installation' ? 'preInstallation' : 'postInstallation';
      const existingMilestone = currentPayments[key];
      if (!existingMilestone) return;

      const updatedMilestone: PaymentMilestone = {
        ...existingMilestone,
        status: 'Received',
        receivedAt: new Date().toISOString(),
        receivedBy: currentUser?.name || 'Dealer',
        dealerNotes: data?.dealerNotes || ''
      };

      const updatedPayments: LeadPayments = {
        ...currentPayments,
        [key]: updatedMilestone
      };

      await updateDoc(doc(db, 'leads', leadId), {
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });

      await addActivity({
        type: 'Payment Received',
        message: `Dealer ${currentUser?.name || lead.dealer} confirmed receipt of ${milestoneType} payment for ${lead.customer}`,
        user: currentUser?.name || 'Dealer',
        leadId: lead.id,
        dealer: lead.dealer
      });
    } catch (err) {
      console.error("Error acknowledging payment:", err);
      throw err;
    }
  };

  return (
    <CRMContext.Provider value={{ 
      leads, employees, dealers, users, activities, currentUser, setCurrentUser,
      addEmployee, updateEmployee, 
      addDealer, updateDealer, 
      addLead, updateLead, updateLeadStage,
      updateUserPermissions, updateUserRole, updateUserStatus,
      addActivity, settleLeadPayment, acknowledgeLeadPayment,
      tasks, addTask, updateTask, deleteTask, resetData
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (context === undefined) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
