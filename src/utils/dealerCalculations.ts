import type { MockLead, Activity, Employee } from '../context/CRMContext';
import type { StockRequest } from '../context/StockContext';

export interface DealerPerformance {
  totalLeads: number;
  convertedLeads: number;
  activeLeads: number;
  conversionRate: number;
  performanceLevel: 'High' | 'Medium' | 'Low';
}

export const getDealerLeads = (dealerName: string, leads: MockLead[]) => {
  return leads.filter(l => l.dealer === dealerName && !l.archived);
};

export const getDealerConvertedLeads = (dealerName: string, leads: MockLead[]) => {
  return leads.filter(l => l.dealer === dealerName && l.stage === 'Converted' && !l.archived);
};

export const getDealerActiveLeads = (dealerName: string, leads: MockLead[]) => {
  return leads.filter(l => l.dealer === dealerName && l.stage !== 'Converted' && l.stage !== 'Completed' && !l.archived);
};

export const getDealerConversionRate = (total: number, converted: number): number => {
  if (total === 0) return 0;
  return Math.round((converted / total) * 100);
};

export const getDealerPerformanceLevel = (conversionRate: number): 'High' | 'Medium' | 'Low' => {
  if (conversionRate >= 50) return 'High';
  if (conversionRate >= 30) return 'Medium';
  return 'Low';
};

export const getDealerPerformance = (dealerName: string, leads: MockLead[]): DealerPerformance => {
  const dLeads = getDealerLeads(dealerName, leads);
  const totalLeads = dLeads.length;
  const convertedLeads = getDealerConvertedLeads(dealerName, leads).length;
  const activeLeads = getDealerActiveLeads(dealerName, leads).length;
  const conversionRate = getDealerConversionRate(totalLeads, convertedLeads);
  const performanceLevel = getDealerPerformanceLevel(conversionRate);

  return {
    totalLeads,
    convertedLeads,
    activeLeads,
    conversionRate,
    performanceLevel
  };
};

export const getDealerStockRequests = (dealerName: string, requests: StockRequest[]) => {
  return requests.filter(r => r.dealer === dealerName);
};

export const getDealerActivity = (dealerName: string, activities: Activity[]) => {
  return activities.filter(a => a.dealer === dealerName);
};

export const getDealerEmployees = (dealerName: string, leads: MockLead[], employees: Employee[]) => {
  const dLeads = getDealerLeads(dealerName, leads);
  const employeeNames = Array.from(new Set(dLeads.map(l => l.assignedEmployee)));
  
  return employeeNames.map(name => {
    const emp = employees.find(e => e.name === name);
    const empLeads = dLeads.filter(l => l.assignedEmployee === name);
    const empConverted = empLeads.filter(l => l.stage === 'Completed');
    return {
      name,
      employeeId: emp?.id,
      totalLeads: empLeads.length,
      convertedLeads: empConverted.length
    };
  }).sort((a, b) => b.totalLeads - a.totalLeads);
};

export const getDealerFollowUps = (dealerName: string, leads: MockLead[]) => {
  const dLeads = getDealerLeads(dealerName, leads);
  const followUps = dLeads.map(l => l.followUp).filter(f => f !== undefined);
  
  return {
    total: followUps.length,
    dueToday: followUps.filter(f => f.status === 'Due Today').length,
    overdue: followUps.filter(f => f.status === 'Overdue').length,
    upcoming: followUps.filter(f => f.status === 'Upcoming').length,
    completed: followUps.filter(f => f.status === 'Completed').length,
  };
};

export const getDealerPipeline = (dealerName: string, leads: MockLead[]) => {
  const dLeads = getDealerLeads(dealerName, leads);
  return {
    'Lead': dLeads.filter(l => l.stage === 'Lead').length,
    'Converted': dLeads.filter(l => l.stage === 'Converted').length,
    'Installation': dLeads.filter(l => l.stage === 'Installation').length,
    'Loan': dLeads.filter(l => l.stage === 'Loan').length,
    'Material': dLeads.filter(l => l.stage === 'Material').length,
    'Completed': dLeads.filter(l => l.stage === 'Completed').length,
  };
};

export const getDealerFollowUpsRaw = (dealerName: string, leads: MockLead[]) => {
  return getDealerLeads(dealerName, leads)
    .filter(l => l.followUp)
    .map(l => ({ ...l.followUp, lead: l }));
};

export const getDealerOverdueFollowUps = (dealerName: string, leads: MockLead[]) => {
  return getDealerFollowUpsRaw(dealerName, leads).filter(f => f.status === 'Overdue');
};

export const getDealerLeadOverview = (dealerName: string, leads: MockLead[]) => {
  const dLeads = getDealerLeads(dealerName, leads);
  return {
    'New': dLeads.filter(l => l.stage === 'Lead').length,
    'In Progress': dLeads.filter(l => l.stage === 'Installation' || l.stage === 'Loan' || l.stage === 'Material').length,
    'Converted': dLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length,
    'Lost': 0 // Assuming no lost stage for now based on current STAGES
  };
};
