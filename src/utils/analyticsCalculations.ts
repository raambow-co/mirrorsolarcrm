import type { MockLead, Employee, Dealer, Stage } from '../context/CRMContext';
import { STAGES } from '../context/CRMContext';

export interface ReportFilters {
  employee: string | null;
  dealer: string | null;
  stage: string | null;
  priority: string | null;
}

export function isDateInPeriod(dateStr: string | undefined, dateRange: string, customFrom?: string, customTo?: string): boolean {
  if (!dateStr) return false;
  
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (dateRange === 'Today') {
    return d >= today;
  }
  if (dateRange === 'Yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return d >= yesterday && d < today;
  }
  if (dateRange === 'Last 7 Days') {
    const last7 = new Date(today);
    last7.setDate(last7.getDate() - 7);
    return d >= last7;
  }
  if (dateRange === 'Last 30 Days') {
    const last30 = new Date(today);
    last30.setDate(last30.getDate() - 30);
    return d >= last30;
  }
  if (dateRange === 'This Month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= startOfMonth;
  }
  if (dateRange === 'Last Month') {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return d >= startOfLastMonth && d <= endOfLastMonth;
  }
  if (dateRange === 'This Quarter') {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfQuarter = new Date(now.getFullYear(), quarterMonth, 1);
    return d >= startOfQuarter;
  }
  if (dateRange === 'Custom Range' && customFrom && customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    return d >= from && d <= to;
  }
  
  return true;
}

export function filterLeads(leads: MockLead[], filters: ReportFilters): MockLead[] {
  return leads.filter(l => {
    if (filters.employee && l.assignedEmployee !== filters.employee) return false;
    if (filters.dealer && l.dealer !== filters.dealer) return false;
    if (filters.stage && l.stage !== filters.stage) return false;
    if (filters.priority && l.priority !== filters.priority) return false;
    return true;
  });
}

export function getConversionRate(convertedCount: number, totalCount: number): string {
  if (totalCount === 0) return '0%';
  return ((convertedCount / totalCount) * 100).toFixed(1).replace(/\.0$/, '') + '%';
}

export function getPipelineFunnel(leads: MockLead[]) {
  const stageCounts: Record<Stage, number> = {} as Record<Stage, number>;
  STAGES.forEach(s => stageCounts[s] = 0);

  leads.forEach(l => {
    if (stageCounts[l.stage] !== undefined) {
      stageCounts[l.stage]++;
    }
  });

  const total = leads.length;
  
  return STAGES.map(stage => {
    const count = stageCounts[stage] || 0;
    return {
      stage,
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1).replace(/\.0$/, '') + '%' : '0%'
    };
  });
}

export function getEmployeePerformance(leads: MockLead[], employees: Employee[]) {
  const perf = employees.map(emp => {
    const empLeads = leads.filter(l => l.assignedEmployee === emp.name);
    const converted = empLeads.filter(l => ['Converted', 'Installation', 'Loan', 'Material', 'Completed'].includes(l.stage)).length;
    const active = empLeads.length - converted;
    const followUps = empLeads.filter(l => l.followUp.status === 'Completed').length;
    
    return {
      name: emp.name,
      initials: emp.initials,
      totalLeads: empLeads.length,
      trackingLeads: empLeads.filter(l => l.leadType === 'tracking' || !l.leadType).length,
      projectLeads: empLeads.filter(l => l.leadType === 'project').length,
      active,
      converted,
      conversionRate: getConversionRate(converted, empLeads.length),
      conversionRateNum: empLeads.length > 0 ? (converted / empLeads.length) * 100 : 0,
      followUps
    };
  });

  return perf.sort((a, b) => {
    if (b.converted !== a.converted) return b.converted - a.converted;
    if (b.conversionRateNum !== a.conversionRateNum) return b.conversionRateNum - a.conversionRateNum;
    return b.totalLeads - a.totalLeads;
  });
}

export function getDealerPerformance(leads: MockLead[], dealers: Dealer[]) {
  const perf = dealers.map(dlr => {
    const dlrLeads = leads.filter(l => l.dealer === dlr.name);
    const converted = dlrLeads.filter(l => ['Converted', 'Installation', 'Loan', 'Material', 'Completed'].includes(l.stage)).length;
    const active = dlrLeads.length - converted;
    
    return {
      name: dlr.name,
      initials: dlr.initials,
      totalLeads: dlrLeads.length,
      trackingLeads: dlrLeads.filter(l => l.leadType === 'tracking' || !l.leadType).length,
      projectLeads: dlrLeads.filter(l => l.leadType === 'project').length,
      active,
      converted,
      conversionRate: getConversionRate(converted, dlrLeads.length),
      conversionRateNum: dlrLeads.length > 0 ? (converted / dlrLeads.length) * 100 : 0,
    };
  });

  return perf.sort((a, b) => {
    if (b.converted !== a.converted) return b.converted - a.converted;
    if (b.conversionRateNum !== a.conversionRateNum) return b.conversionRateNum - a.conversionRateNum;
    return b.totalLeads - a.totalLeads;
  });
}

export function getFollowUpStats(leads: MockLead[]) {
  const stats = {
    today: 0,
    overdue: 0,
    upcoming: 0,
    completed: 0
  };

  leads.forEach(l => {
    if (l.followUp.status === 'Due Today') stats.today++;
    else if (l.followUp.status === 'Overdue') stats.overdue++;
    else if (l.followUp.status === 'Upcoming') stats.upcoming++;
    else if (l.followUp.status === 'Completed') stats.completed++;
  });

  const total = stats.today + stats.overdue + stats.upcoming + stats.completed;
  const completionRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  return { ...stats, completionRate, total };
}

export function getDocumentAnalytics(leads: MockLead[]) {
  const stats = {
    uploaded: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    additionalRequired: 0,
    totalExpected: 0
  };

  const projectLeads = leads.filter(l => l.leadType === 'project');
  
  projectLeads.forEach(l => {
    stats.totalExpected += 22; // Using the 22-point document system
    
    if (l.documents) {
      l.documents.forEach(doc => {
        if (doc.status === 'Uploaded') stats.uploaded++;
        else if (doc.status === 'Pending') stats.pending++;
        else if (doc.status === 'Verified') stats.verified++;
        else if (doc.status === 'Rejected' as any) stats.rejected++;
        else if (doc.status === 'Additional Document Required') stats.additionalRequired++;
      });
    }
  });

  return stats;
}

export function getTopPerformers(leads: MockLead[], employees: Employee[], dealers: Dealer[]) {
  const empPerf = getEmployeePerformance(leads, employees);
  const dlrPerf = getDealerPerformance(leads, dealers);
  
  return {
    topEmployee: empPerf[0] || null,
    topDealer: dlrPerf[0] || null
  };
}

export function getLeadPerformanceSeries(leads: MockLead[]) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const agg: Record<string, { created: number; converted: number }> = {
    'Mon': { created: 0, converted: 0 },
    'Tue': { created: 0, converted: 0 },
    'Wed': { created: 0, converted: 0 },
    'Thu': { created: 0, converted: 0 },
    'Fri': { created: 0, converted: 0 },
    'Sat': { created: 0, converted: 0 },
    'Sun': { created: 0, converted: 0 }
  };

  leads.forEach(l => {
    if (l.createdAt) {
      const cDay = dayNames[new Date(l.createdAt).getDay()];
      if (agg[cDay]) agg[cDay].created++;
    }
    if (l.convertedAt) {
      const convDay = dayNames[new Date(l.convertedAt).getDay()];
      if (agg[convDay]) agg[convDay].converted++;
    }
  });

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
    day,
    created: agg[day].created,
    converted: agg[day].converted
  }));
}

export function getPreviousPeriodComparison(currentLeads: MockLead[], type: 'leads' | 'conversions' | 'followups') {
  const now = new Date();
  const fifteenDaysAgo = new Date(now);
  fifteenDaysAgo.setDate(now.getDate() - 15);
  
  let currentCount = 0;
  let previousCount = 0;

  currentLeads.forEach(l => {
    const isCurrent = l.createdAt && new Date(l.createdAt) >= fifteenDaysAgo;
    const isPrevious = l.createdAt && new Date(l.createdAt) < fifteenDaysAgo;

    if (type === 'leads') {
      if (isCurrent) currentCount++;
      if (isPrevious) previousCount++;
    } else if (type === 'conversions') {
      if (['Converted', 'Installation', 'Loan', 'Material', 'Completed'].includes(l.stage)) {
        if (isCurrent) currentCount++;
        if (isPrevious) previousCount++;
      }
    } else if (type === 'followups') {
      if (l.followUp.status === 'Completed') {
        if (isCurrent) currentCount++;
        if (isPrevious) previousCount++;
      }
    }
  });

  if (previousCount === 0) return { change: currentCount > 0 ? 100 : 0, trend: currentCount > 0 ? 'up' : 'stable' };
  
  const change = Math.round(((currentCount - previousCount) / previousCount) * 100);
  
  return {
    change,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
  };
}

export function getTopInsights(leads: MockLead[], employees: Employee[], dealers: Dealer[], stockItems: any[]) {
  const insights: string[] = [];
  
  const prevLeadComp = getPreviousPeriodComparison(leads, 'conversions');
  
  if (prevLeadComp.change > 0) {
    insights.push(`Lead conversion increased ${prevLeadComp.change}% compared with previous period.`);
  } else if (prevLeadComp.change < 0) {
    insights.push(`Lead conversion decreased ${Math.abs(prevLeadComp.change)}% compared with previous period.`);
  }

  const lowStock = stockItems.filter(i => i.status === 'Low' || i.status === 'Critical' || i.status === 'Out of Stock').length;
  if (lowStock > 0) {
    insights.push(`${lowStock} products are below minimum stock or out of stock.`);
  }
  
  const empPerf = getEmployeePerformance(leads, employees);
  if (empPerf.length > 0 && empPerf[0].totalLeads > 0) {
    const topEmp = empPerf[0];
    const topEmpFollowups = leads.filter(l => l.assignedEmployee === topEmp.name && l.followUp.status === 'Completed').length;
    const topEmpTotalFollowups = leads.filter(l => l.assignedEmployee === topEmp.name).length;
    if (topEmpTotalFollowups > 0) {
      const completionRate = Math.round((topEmpFollowups / topEmpTotalFollowups) * 100);
      insights.push(`${topEmp.name} completed ${completionRate}% of assigned follow-ups.`);
    }
  }

  const dlrPerf = getDealerPerformance(leads, dealers);
  if (dlrPerf.length > 0 && dlrPerf[0].converted > 0) {
    insights.push(`${dlrPerf[0].name} generated the most conversions.`);
  }
  
  if (insights.length === 0) {
    insights.push("Not enough data to generate insights.");
  }
  
  return insights.slice(0, 4);
}

export function getStockMovementSeries(stockRequests: any[]) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const agg: Record<string, { pending: number; approved: number; rejected: number }> = {
    'Mon': { pending: 0, approved: 0, rejected: 0 },
    'Tue': { pending: 0, approved: 0, rejected: 0 },
    'Wed': { pending: 0, approved: 0, rejected: 0 },
    'Thu': { pending: 0, approved: 0, rejected: 0 },
    'Fri': { pending: 0, approved: 0, rejected: 0 },
    'Sat': { pending: 0, approved: 0, rejected: 0 },
    'Sun': { pending: 0, approved: 0, rejected: 0 }
  };

  stockRequests.forEach(req => {
    if (req.requestedDate) {
      const day = dayNames[new Date(req.requestedDate).getDay()];
      if (agg[day]) {
        if (req.status === 'Pending') agg[day].pending++;
        else if (req.status === 'Approved' || req.status === 'Completed') agg[day].approved++;
        else if (req.status === 'Rejected') agg[day].rejected++;
      }
    }
  });

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
    day,
    pending: agg[day].pending,
    approved: agg[day].approved,
    rejected: agg[day].rejected
  }));
}
