import type { MockLead, Activity, User, Stage } from '../context/CRMContext';
import { STAGES } from '../context/CRMContext';

export type WorkloadLevel = 'Light' | 'Normal' | 'Heavy';

export interface EmployeePerformance {
  totalLeads: number;
  activeLeads: number;
  convertedLeads: number;
  conversionRate: number;
  workload: WorkloadLevel;
  performanceLevel: 'High' | 'Medium' | 'Low';
}

export const getEmployeeLeads = (employeeName: string, leads: MockLead[]) => {
  return leads.filter(l => l.assignedEmployee === employeeName && !l.archived);
};

export const getEmployeeActiveLeads = (employeeName: string, leads: MockLead[]) => {
  return leads.filter(l => l.assignedEmployee === employeeName && l.stage !== 'Completed' && !l.archived);
};

export const getEmployeeConvertedLeads = (employeeName: string, leads: MockLead[]) => {
  return leads.filter(l => l.assignedEmployee === employeeName && l.stage === 'Completed' && !l.archived);
};

export const getEmployeeConversionRate = (total: number, converted: number): number => {
  if (total === 0) return 0;
  return Math.round((converted / total) * 100);
};

export const getEmployeeWorkloadStatus = (activeLeads: number): WorkloadLevel => {
  if (activeLeads >= 13) return 'Heavy';
  if (activeLeads >= 6) return 'Normal';
  return 'Light';
};

export const getEmployeePerformanceLevel = (conversionRate: number): 'High' | 'Medium' | 'Low' => {
  if (conversionRate >= 50) return 'High';
  if (conversionRate >= 30) return 'Medium';
  return 'Low';
};

export const getEmployeePerformance = (employeeName: string, leads: MockLead[]): EmployeePerformance => {
  const eLeads = getEmployeeLeads(employeeName, leads);
  const totalLeads = eLeads.length;
  const activeLeads = getEmployeeActiveLeads(employeeName, leads).length;
  const convertedLeads = getEmployeeConvertedLeads(employeeName, leads).length;
  const conversionRate = getEmployeeConversionRate(totalLeads, convertedLeads);
  const workload = getEmployeeWorkloadStatus(activeLeads);
  const performanceLevel = getEmployeePerformanceLevel(conversionRate);

  return {
    totalLeads,
    activeLeads,
    convertedLeads,
    conversionRate,
    workload,
    performanceLevel
  };
};

export const getEmployeeFollowUps = (employeeName: string, leads: MockLead[]) => {
  const eLeads = getEmployeeLeads(employeeName, leads);
  const followUps = eLeads.map(l => l.followUp).filter(f => f !== undefined);
  
  return {
    total: followUps.length,
    dueToday: followUps.filter(f => f.status === 'Due Today').length,
    overdue: followUps.filter(f => f.status === 'Overdue').length,
    upcoming: followUps.filter(f => f.status === 'Upcoming').length,
    completed: followUps.filter(f => f.status === 'Completed').length,
  };
};

export const getEmployeeDealers = (employeeName: string, leads: MockLead[]) => {
  const eLeads = getEmployeeLeads(employeeName, leads);
  const dealerMap = new Map<string, number>();
  
  eLeads.forEach(l => {
    const dealerName = l.dealer;
    if (dealerName) {
      dealerMap.set(dealerName, (dealerMap.get(dealerName) || 0) + 1);
    }
  });

  return Array.from(dealerMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

export const getEmployeePipeline = (employeeName: string, leads: MockLead[]) => {
  const eLeads = getEmployeeLeads(employeeName, leads);
  return {
    'Lead': eLeads.filter(l => l.stage === 'Lead').length,
    'Converted': eLeads.filter(l => l.stage === 'Converted').length,
    'Installation': eLeads.filter(l => l.stage === 'Installation').length,
    'Loan': eLeads.filter(l => l.stage === 'Loan').length,
    'Material': eLeads.filter(l => l.stage === 'Material').length,
    'Completed': eLeads.filter(l => l.stage === 'Completed').length,
  };
};

export const getEmployeeActivity = (employeeName: string, activities: Activity[]) => {
  // Activity objects in CRMContext might not have 'employee' explicitly set in all cases,
  // but they have 'user' which matches employeeName when they take action,
  // or they might have an 'employee' field for activities related to them.
  return activities.filter(a => a.employee === employeeName).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// --- USER SCOPED SELECTORS (For Employee Dashboard) ---

export const getMyLeads = (userName: string, leads: MockLead[]) => {
  return leads.filter(l => l.assignedEmployee === userName);
};

export const getMyActiveLeads = (userName: string, leads: MockLead[]) => {
  return getMyLeads(userName, leads).filter(l => l.stage !== 'Converted' && l.stage !== 'Completed');
};

export const getMyConvertedLeads = (userName: string, leads: MockLead[]) => {
  return getMyLeads(userName, leads).filter(l => l.stage === 'Converted');
};

export const getMyPipeline = (userName: string, leads: MockLead[]) => {
  const myLeads = getMyLeads(userName, leads);
  return STAGES.reduce((acc, stage) => {
    acc[stage] = myLeads.filter(l => l.stage === stage).length;
    return acc;
  }, {} as Record<Stage, number>);
};

export const getMyFollowUpsRaw = (userName: string, leads: MockLead[]) => {
  return getMyLeads(userName, leads)
    .filter(l => l.followUp)
    .map(l => ({ ...l.followUp, lead: l }));
};

export const getMyOverdueFollowUps = (userName: string, leads: MockLead[]) => {
  return getMyFollowUpsRaw(userName, leads).filter(f => f.status === 'Overdue');
};

export const getMyActivity = (userName: string, activities: Activity[]) => {
  // Activity explicitly linked to the employee name or where user is them
  return activities.filter(a => a.employee === userName || a.user === userName);
};

export const getMyDealers = (userName: string, leads: MockLead[], dealers: User[]) => {
  const myLeads = getMyLeads(userName, leads);
  const dealerNames = new Set(myLeads.map(l => l.dealer).filter(Boolean));
  return dealers.filter(d => dealerNames.has(d.name));
};

export const getMyPerformance = (userName: string, leads: MockLead[]) => {
  const myLeads = getMyLeads(userName, leads);
  const totalLeads = myLeads.length;
  const convertedLeads = myLeads.filter(l => l.stage === 'Converted').length;
  const activeLeads = myLeads.filter(l => l.stage !== 'Converted' && l.stage !== 'Completed').length;
  const completedFollowUps = myLeads.filter(l => l.followUp?.status === 'Completed').length; 
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  
  return {
    totalLeads,
    convertedLeads,
    conversionRate,
    completedFollowUps,
    activeLeads
  };
};
