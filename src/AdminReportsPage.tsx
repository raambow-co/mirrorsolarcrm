import React, { useState, useMemo } from 'react';
import { 
  Download, FileText, TrendingUp, TrendingDown, Minus,
  Activity, Package, 
  AlertTriangle, ArrowRight, X, Zap
} from 'lucide-react';
import { useCRM, STAGES } from './context/CRMContext';
import { useStock } from './context/StockContext';
import { useUI } from './context/UIContext';
import './AdminReportsPage.css';
import { 
  filterLeads, getConversionRate, 
  getPipelineFunnel, getEmployeePerformance, getDealerPerformance,
  getFollowUpStats, getLeadPerformanceSeries,
  getPreviousPeriodComparison, getTopInsights, getStockMovementSeries,
  isDateInPeriod, getDocumentAnalytics
} from './utils/analyticsCalculations';
import type { ReportFilters } from './utils/analyticsCalculations';

interface AdminReportsPageProps {
  onNavigate?: (tab: string, context?: any) => void;
}

export default function AdminReportsPage({ onNavigate }: AdminReportsPageProps) {
  const { leads, employees, dealers, activities, currentUser } = useCRM();
  const { stockItems, stockRequests } = useStock();
  const { showToast } = useUI();

  // Date Range State
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [isCustomDateModalOpen, setIsCustomDateModalOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Export Menu State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');

  // Filters State
  const [filters, setFilters] = useState<ReportFilters>({
    employee: null,
    dealer: null,
    stage: null,
    priority: null
  });

  // Employee Perf Metric switch
  const [empMetric, setEmpMetric] = useState<'Leads' | 'Conversions' | 'Follow-ups' | 'Conversion Rate'>('Conversions');

  // Role Based Protection & Filtering
  const authorizedLeads = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return leads;
    if (currentUser.role === 'Employee') return leads.filter(l => l.assignedEmployee === currentUser.name);
    if (currentUser.role === 'Dealer') return leads.filter(l => l.dealer === currentUser.name);
    return [];
  }, [leads, currentUser]);

  const hasReportsPermission = currentUser?.permissions?.reports !== 'none';

  // Derivations
  const filteredLeads = useMemo(() => filterLeads(authorizedLeads, filters), [authorizedLeads, filters]);
  
  const periodLeads = useMemo(() => 
    filteredLeads.filter(l => isDateInPeriod(l.createdAt, dateRange, customFrom, customTo)), 
  [filteredLeads, dateRange, customFrom, customTo]);
  
  // Total DB State
  const totalLeadsCount = filteredLeads.length;
  const activeLeadsCount = filteredLeads.filter(l => !['Converted', 'Installation', 'Loan', 'Material', 'Completed'].includes(l.stage)).length;
  
  // Period State
  const periodLeadsCount = periodLeads.length;
  const periodConvertedCount = periodLeads.filter(l => ['Converted', 'Installation', 'Loan', 'Material', 'Completed'].includes(l.stage)).length;
  const periodConversionRate = getConversionRate(periodConvertedCount, periodLeadsCount);

  // Tracking vs Project (Current State)
  const totalTrackingLeads = filteredLeads.filter(l => l.leadType === 'tracking' || !l.leadType).length;
  const totalProjectLeads = filteredLeads.filter(l => l.leadType === 'project').length;
  
  const followUpStats = useMemo(() => getFollowUpStats(periodLeads), [periodLeads]);
  const pipelineFunnel = useMemo(() => getPipelineFunnel(filteredLeads), [filteredLeads]);
  const employeePerf = useMemo(() => getEmployeePerformance(periodLeads, employees), [periodLeads, employees]);
  const dealerPerf = useMemo(() => getDealerPerformance(periodLeads, dealers), [periodLeads, dealers]);
  const documentAnalytics = useMemo(() => getDocumentAnalytics(filteredLeads), [filteredLeads]);
  
  const leadSeries = useMemo(() => getLeadPerformanceSeries(periodLeads), [periodLeads]);
  
  // Pass stockRequests to getStockMovementSeries instead of stockItems
  const stockMovementSeries = useMemo(() => getStockMovementSeries(stockRequests), [stockRequests]);

  const topInsights = useMemo(() => getTopInsights(authorizedLeads, employees, dealers, stockItems), [authorizedLeads, employees, dealers, stockItems]);

  // Stock summary
  const totalStockItems = stockItems.length;
  const availableUnits = stockItems.reduce((sum, item) => sum + (item.totalQuantity - item.reservedQuantity), 0);
  const reservedUnits = stockItems.reduce((sum, item) => sum + item.reservedQuantity, 0);
  const lowStockProducts = stockItems.filter(item => (item.totalQuantity - item.reservedQuantity) > 0 && (item.totalQuantity - item.reservedQuantity) <= item.minimumStock);
  const outOfStockProducts = stockItems.filter(item => (item.totalQuantity - item.reservedQuantity) <= 0);
  const totalStockRequests = stockRequests.length;
  const pendingRequests = stockRequests.filter(r => r.status === 'Pending').length;
  const approvedRequests = stockRequests.filter(r => r.status === 'Approved' || r.status === 'Completed').length;
  const rejectedRequests = stockRequests.filter(r => r.status === 'Rejected').length;

  const activeActivities = [...activities].reverse().slice(0, 10);

  // Previous Period Comparisons
  const prevLeads = getPreviousPeriodComparison(filteredLeads, 'leads');
  const prevConv = getPreviousPeriodComparison(filteredLeads, 'conversions');
  const prevFollowups = getPreviousPeriodComparison(filteredLeads, 'followups');
  const prevStockMovements = { change: 0, trend: 'stable' }; // Fixed to 0 since we have no real historical stock data

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(customFrom) > new Date(customTo)) {
      showToast("Invalid Date Range: From date must be before To date.", "error");
      return;
    }
    setDateRange('Custom Range');
    setIsCustomDateModalOpen(false);
  };

  const handleExport = (type: string) => {
    setExportFormat(type);
    setIsExportMenuOpen(false);
    setIsExportPreviewOpen(true);
  };

  const executeExport = () => {
    setIsExportPreviewOpen(false);
    if (exportFormat === 'csv') {
      const headers = ['ID,Customer,Phone,Email,Location,Dealer,AssignedEmployee,Stage,Priority,CreatedAt,LeadType\n'];
      const rows = periodLeads.map(l => 
        `${l.id},"${l.customer}","${l.phone}","${l.email}","${l.location}","${l.dealer}","${l.assignedEmployee}","${l.stage}","${l.priority}","${l.createdAt}","${l.leadType || 'tracking'}"\n`
      );
      const blob = new Blob([headers.join('') + rows.join('')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `msolar_leads_report_${new Date().getTime()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('CSV Exported Successfully', 'success');
    } else {
      showToast(`Export to ${exportFormat.toUpperCase()} is not supported. Use CSV.`, 'error');
    }
  };

  const handleClearFilters = () => {
    setFilters({ employee: null, dealer: null, stage: null, priority: null });
  };

  const removeFilter = (key: keyof ReportFilters) => {
    setFilters(prev => ({ ...prev, [key]: null }));
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== null);

  const renderTrend = (comp: { change: number, trend: string }) => {
    if (comp.change > 0) return <span className="trend positive"><TrendingUp size={14} /> +{comp.change}%</span>;
    if (comp.change < 0) return <span className="trend negative"><TrendingDown size={14} /> {comp.change}%</span>;
    return <span className="trend stable"><Minus size={14} /> 0%</span>;
  };

  if (!hasReportsPermission) {
    return (
      <div className="reports-page-container empty-state-container">
        <div className="empty-state">
          <AlertTriangle size={48} className="text-orange" />
          <h3>Access Denied</h3>
          <p>You do not have permission to view Reports & Analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page-container">
      {/* Header */}
      <div className="reports-header">
        <div className="reports-title">
          <h1>Reports & Analytics</h1>
          <p>Understand sales activity, team performance and inventory movement.</p>
        </div>
        <div className="reports-actions">
          <select 
            className="date-select" 
            value={dateRange === 'Custom Range' ? 'Custom Range' : dateRange} 
            onChange={(e) => {
              if (e.target.value === 'Custom Range') setIsCustomDateModalOpen(true);
              else setDateRange(e.target.value);
            }}
          >
            <option>Today</option>
            <option>Yesterday</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Month</option>
            <option>Last Month</option>
            <option>This Quarter</option>
            <option>Custom Range</option>
          </select>
          
          {currentUser?.permissions?.reports === 'full' && (
            <div className="btn-export-wrapper" onMouseLeave={() => setIsExportMenuOpen(false)}>
              <button className="btn-export" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}>
                <Download size={18} /> Export Report
              </button>
              {isExportMenuOpen && (
                <div className="export-menu">
                  <button onClick={() => handleExport('pdf')}><FileText size={16} /> PDF</button>
                  <button onClick={() => handleExport('csv')}><Download size={16} /> CSV</button>
                  <button onClick={() => handleExport('excel')}><Package size={16} /> Excel</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="reports-filters-bar">
        {currentUser?.role === 'Admin' && (
          <>
            <select className="filter-select" value={filters.employee || ''} onChange={e => setFilters({...filters, employee: e.target.value || null})}>
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <select className="filter-select" value={filters.dealer || ''} onChange={e => setFilters({...filters, dealer: e.target.value || null})}>
              <option value="">All Dealers</option>
              {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </>
        )}
        <select className="filter-select" value={filters.stage || ''} onChange={e => setFilters({...filters, stage: e.target.value || null})}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={filters.priority || ''} onChange={e => setFilters({...filters, priority: e.target.value || null})}>
          <option value="">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {hasActiveFilters && (
          <div className="active-filters">
            {Object.entries(filters).map(([k, v]) => v ? (
              <div key={k} className="filter-chip">
                {v}
                <button onClick={() => removeFilter(k as keyof ReportFilters)}><X size={12} /></button>
              </div>
            ) : null)}
            <button className="clear-filters-btn" onClick={handleClearFilters}>Clear All</button>
          </div>
        )}
      </div>

      {totalLeadsCount === 0 && !hasActiveFilters && currentUser?.role !== 'Admin' ? (
        <div className="empty-state">
          <Activity size={48} />
          <h3>No data available for this period.</h3>
          <p>Start interacting with leads to see analytics.</p>
        </div>
      ) : (
        <div className="reports-content-layout">
          {/* Main Content Area */}
          <div className="reports-main-column">
            
            {/* Summary Cards */}
            <div className="summary-cards-grid">
              <div className="summary-card">
                <span className="card-title">TOTAL ACTIVE LEADS</span>
                <div className="card-body">
                  <span className="card-value">{activeLeadsCount}</span>
                </div>
              </div>
              <div className="summary-card highlight">
                <span className="card-title">NEW LEADS ({dateRange})</span>
                <div className="card-body">
                  <span className="card-value">{periodLeadsCount}</span>
                  {renderTrend(prevLeads)}
                </div>
              </div>
              <div className="summary-card">
                <span className="card-title">PERIOD CONVERSION</span>
                <div className="card-body">
                  <span className="card-value">{periodConversionRate}</span>
                  {renderTrend(prevConv)}
                </div>
              </div>
              <div className="summary-card">
                <span className="card-title">PROJECT LEADS</span>
                <div className="card-body">
                  <span className="card-value">{totalProjectLeads}</span>
                </div>
              </div>
              <div className="summary-card">
                <span className="card-title">TRACKING LEADS</span>
                <div className="card-body">
                  <span className="card-value">{totalTrackingLeads}</span>
                </div>
              </div>
              {currentUser?.role === 'Admin' && (
                <div className="summary-card">
                  <span className="card-title">PENDING STOCK REQ.</span>
                  <div className="card-body">
                    <span className="card-value">{pendingRequests}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Lead Performance Section */}
            <div className="report-section">
              <h2>Lead Performance</h2>
              <div className="reports-row grid-3-1">
                <div className="report-panel trend-panel">
                  <div className="panel-header">
                    <h3>Lead Trend</h3>
                  </div>
                  <div className="chart-container">
                    {leadSeries.length > 0 ? (
                      <>
                        <svg viewBox="0 0 600 200" className="custom-chart" preserveAspectRatio="none">
                          <line x1="0" y1="40" x2="600" y2="40" className="chart-grid" />
                          <line x1="0" y1="80" x2="600" y2="80" className="chart-grid" />
                          <line x1="0" y1="120" x2="600" y2="120" className="chart-grid" />
                          <line x1="0" y1="160" x2="600" y2="160" className="chart-grid" />
                          
                          {leadSeries.map((s, i) => (
                            <text key={s.day} x={30 + (i * 540) / 6} y="190" className="chart-label">{s.day}</text>
                          ))}

                          <path d={`M ${leadSeries.map((s, i) => `${30 + (i * 540) / 6} ${170 - (s.created/Math.max(...leadSeries.map(x=>x.created)))*150}`).join(' L ')}`} className="chart-line-created" />
                          <path d={`M ${leadSeries.map((s, i) => `${30 + (i * 540) / 6} ${170 - (s.converted/Math.max(...leadSeries.map(x=>x.created)))*150}`).join(' L ')}`} className="chart-line-converted" />
                          
                          {leadSeries.map((s, i) => (
                            <circle key={`c-${i}`} cx={30 + (i * 540) / 6} cy={170 - (s.created/Math.max(...leadSeries.map(x=>x.created)))*150} r="4" className="chart-point created" />
                          ))}
                          {leadSeries.map((s, i) => (
                            <circle key={`cv-${i}`} cx={30 + (i * 540) / 6} cy={170 - (s.converted/Math.max(...leadSeries.map(x=>x.created)))*150} r="4" className="chart-point converted" />
                          ))}
                        </svg>
                        <div className="chart-legend">
                          <div className="legend-item"><div className="legend-dot bg-navy"></div> New Leads</div>
                          <div className="legend-item"><div className="legend-dot bg-yellow"></div> Converted</div>
                        </div>
                      </>
                    ) : (
                      <div className="empty-state">No data available for this period.</div>
                    )}
                  </div>
                </div>
                <div className="report-panel stats-list-panel">
                  <div className="stat-row">
                    <span className="stat-label">Total Leads</span>
                    <span className="stat-num">{totalLeadsCount}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Active Leads</span>
                    <span className="stat-num">{activeLeadsCount}</span>
                  </div>
                  <div className="stat-row highlight">
                    <span className="stat-label">Converted Leads</span>
                    <span className="stat-num text-yellow">{periodConvertedCount}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Lost Leads</span>
                    <span className="stat-num text-orange">0</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Conversion Rate</span>
                    <span className="stat-num text-yellow">{periodConversionRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pipeline Analytics */}
            <div className="report-section">
              <h2>Pipeline Performance</h2>
              <div className="report-panel pipeline-panel">
                <div className="pipeline-funnel-visual">
                  {pipelineFunnel.map((stage, idx) => {
                    const dropoff = idx > 0 && pipelineFunnel[idx-1].count > 0 
                      ? Math.round((stage.count / pipelineFunnel[idx-1].count) * 100) 
                      : (idx === 0 ? 100 : 0);
                    return (
                      <div key={stage.stage} className="pipeline-stage-block">
                        <div className="stage-bar-container">
                          <div className="stage-bar" style={{ width: `${Math.max(10, (stage.count / Math.max(1, totalLeadsCount)) * 100)}%` }}></div>
                        </div>
                        <div className="stage-info">
                          <span className="stage-name">{stage.stage}</span>
                          <span className="stage-count">{stage.count} ({stage.percentage})</span>
                        </div>
                        {idx > 0 && (
                          <div className="stage-dropoff">
                            <ArrowRight size={14} /> {dropoff}%
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Document Verification Analytics */}
            <div className="report-section">
              <h2>Document Verification (Project Leads)</h2>
              <div className="reports-row grid-4">
                <div className="report-panel stats-list-panel horizontal" style={{ gridColumn: 'span 4', display: 'flex', justifyContent: 'space-between' }}>
                  <div className="stat-box" style={{ padding: '1rem', flex: 1 }}>
                    <span className="stat-label">Total Expected</span>
                    <span className="stat-num">{documentAnalytics.totalExpected}</span>
                  </div>
                  <div className="stat-box" style={{ padding: '1rem', flex: 1 }}>
                    <span className="stat-label">Uploaded</span>
                    <span className="stat-num text-blue">{documentAnalytics.uploaded}</span>
                  </div>
                  <div className="stat-box" style={{ padding: '1rem', flex: 1 }}>
                    <span className="stat-label">Pending Review</span>
                    <span className="stat-num text-orange">{documentAnalytics.pending}</span>
                  </div>
                  <div className="stat-box" style={{ padding: '1rem', flex: 1 }}>
                    <span className="stat-label">Verified</span>
                    <span className="stat-num text-green">{documentAnalytics.verified}</span>
                  </div>
                  <div className="stat-box" style={{ padding: '1rem', flex: 1 }}>
                    <span className="stat-label">Needs Addt'l Info</span>
                    <span className="stat-num text-yellow">{documentAnalytics.additionalRequired}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Performance (Admin Only) */}
            {currentUser?.role === 'Admin' && (
              <div className="report-section">
                <div className="section-header-row">
                  <h2>Employee Performance</h2>
                  <div className="metric-switcher">
                    {['Leads', 'Conversions', 'Follow-ups', 'Conversion Rate'].map(m => (
                      <button 
                        key={m} 
                        className={`metric-btn ${empMetric === m ? 'active' : ''}`}
                        onClick={() => setEmpMetric(m as any)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="report-panel table-panel">
                  <div className="table-responsive">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>EMPLOYEE</th>
                          <th>PROJECTS / TRACKING</th>
                          <th>CONVERTED</th>
                          <th>CONVERSION RATE</th>
                          <th>FOLLOW-UPS</th>
                          <th>PERFORMANCE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeePerf.length > 0 ? employeePerf.map(emp => {
                          let perfLabel = 'Stable';
                          let perfClass = 'stable';
                          if (emp.conversionRateNum > 30) { perfLabel = 'Strong'; perfClass = 'strong'; }
                          else if (emp.conversionRateNum < 10) { perfLabel = 'Needs Attention'; perfClass = 'attention'; }

                          return (
                            <tr key={emp.name} onClick={() => onNavigate && onNavigate('employees')} className="clickable-row">
                              <td className="bold">{emp.name}</td>
                              <td>{emp.projectLeads} / {emp.trackingLeads}</td>
                              <td>{emp.converted}</td>
                              <td>{emp.conversionRate}</td>
                              <td>{emp.followUps}</td>
                              <td><span className={`perf-badge ${perfClass}`}>{perfLabel}</span></td>
                            </tr>
                          );
                        }) : (
                          <tr><td colSpan={6} className="text-center">No employee data available.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Dealer Performance (Admin Only) */}
            {currentUser?.role === 'Admin' && (
              <div className="report-section">
                <h2>Dealer Performance</h2>
                <div className="reports-row grid-2-1">
                  <div className="report-panel table-panel">
                    <div className="table-responsive">
                      <table className="analytics-table">
                        <thead>
                          <tr>
                            <th>DEALER</th>
                            <th>PROJECTS / TRACKING</th>
                            <th>CONVERTED</th>
                            <th>CONVERSION RATE</th>
                            <th>PERFORMANCE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dealerPerf.length > 0 ? dealerPerf.map(dlr => {
                            let perfLabel = 'Stable';
                            let perfClass = 'stable';
                            if (dlr.conversionRateNum > 40) { perfLabel = 'Strong'; perfClass = 'strong'; }
                            else if (dlr.conversionRateNum < 10) { perfLabel = 'Needs Attention'; perfClass = 'attention'; }

                            return (
                              <tr key={dlr.name} onClick={() => onNavigate && onNavigate('dealers')} className="clickable-row">
                                <td className="bold">{dlr.name}</td>
                                <td>{dlr.projectLeads} / {dlr.trackingLeads}</td>
                                <td>{dlr.converted}</td>
                                <td>{dlr.conversionRate}</td>
                                <td><span className={`perf-badge ${perfClass}`}>{perfLabel}</span></td>
                              </tr>
                            );
                          }) : (
                            <tr><td colSpan={5} className="text-center">No dealer data available.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="report-panel ranking-panel">
                    <h3>Top Performing Dealers</h3>
                    <div className="ranking-list">
                      {dealerPerf.slice(0, 5).map((dlr, idx) => (
                        <div key={dlr.name} className="ranking-item">
                          <span className="rank-number">#{idx + 1}</span>
                          <div className="rank-info">
                            <span className="rank-name">{dlr.name}</span>
                            <span className="rank-metric">{dlr.converted} Conversions ({dlr.conversionRate})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Follow-up Analytics */}
            <div className="report-section">
              <h2>Follow-up Performance</h2>
              <div className="reports-row grid-2-1">
                <div className="report-panel stats-list-panel horizontal">
                  <div className="stat-box">
                    <span className="stat-label">Scheduled</span>
                    <span className="stat-num">{followUpStats.total}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Completed</span>
                    <span className="stat-num text-green">{followUpStats.completed}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Overdue</span>
                    <span className="stat-num text-orange">{followUpStats.overdue}</span>
                  </div>
                  <div className="stat-box highlight bg-navy text-white">
                    <span className="stat-label text-white">Completion Rate</span>
                    <span className="stat-num">{followUpStats.completionRate}%</span>
                  </div>
                </div>
                <div className="report-panel attention-panel border-orange">
                  <h3><AlertTriangle size={18} className="text-orange" /> Overdue Analysis</h3>
                  <div className="attention-content">
                    <div className="attention-stat">
                      <span className="huge text-orange">{followUpStats.overdue}</span>
                      <span>Total Overdue</span>
                    </div>
                    {followUpStats.overdue > 0 && currentUser?.role === 'Admin' && employeePerf[0] && (
                      <p>Top employee with overdue: <strong>{employeePerf[0].name}</strong></p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Analytics (Admin & Employee) */}
            {currentUser?.role !== 'Dealer' && (
              <div className="report-section">
                <h2>Stock Analytics</h2>
                <div className="reports-row grid-2-1">
                  
                  <div className="report-panel trend-panel">
                    <h3>Stock Movement Trend</h3>
                    <div className="chart-container">
                      <svg viewBox="0 0 600 200" className="custom-chart" preserveAspectRatio="none">
                        <line x1="0" y1="40" x2="600" y2="40" className="chart-grid" />
                        <line x1="0" y1="80" x2="600" y2="80" className="chart-grid" />
                        <line x1="0" y1="120" x2="600" y2="120" className="chart-grid" />
                        <line x1="0" y1="160" x2="600" y2="160" className="chart-grid" />
                        
                        {stockMovementSeries.map((s, i) => (
                          <text key={s.day} x={30 + (i * 540) / 6} y="190" className="chart-label">{s.day}</text>
                        ))}

                        <path d={`M ${stockMovementSeries.map((s, i) => `${30 + (i * 540) / 6} ${170 - (s.approved/Math.max(1, ...stockMovementSeries.map(x=>Math.max(x.pending, x.approved, x.rejected))))*150}`).join(' L ')}`} className="chart-line-converted" />
                        <path d={`M ${stockMovementSeries.map((s, i) => `${30 + (i * 540) / 6} ${170 - (s.pending/Math.max(1, ...stockMovementSeries.map(x=>Math.max(x.pending, x.approved, x.rejected))))*150}`).join(' L ')}`} className="chart-line-created" />
                        
                        {stockMovementSeries.map((s, i) => (
                          <circle key={`a-${i}`} cx={30 + (i * 540) / 6} cy={170 - (s.approved/Math.max(1, ...stockMovementSeries.map(x=>Math.max(x.pending, x.approved, x.rejected))))*150} r="4" className="chart-point converted" />
                        ))}
                        {stockMovementSeries.map((s, i) => (
                          <circle key={`p-${i}`} cx={30 + (i * 540) / 6} cy={170 - (s.pending/Math.max(1, ...stockMovementSeries.map(x=>Math.max(x.pending, x.approved, x.rejected))))*150} r="4" className="chart-point created" />
                        ))}
                      </svg>
                      <div className="chart-legend">
                        <div className="legend-item"><div className="legend-dot bg-navy"></div> Pending Requests</div>
                        <div className="legend-item"><div className="legend-dot bg-yellow"></div> Approved Requests</div>
                      </div>
                    </div>
                  </div>

                  <div className="report-panel stats-list-panel">
                    <div className="stat-row">
                      <span className="stat-label">Total Products</span>
                      <span className="stat-num">{totalStockItems}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Available Units</span>
                      <span className="stat-num">{availableUnits}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Reserved Units</span>
                      <span className="stat-num">{reservedUnits}</span>
                    </div>
                    <div className="stat-row highlight">
                      <span className="stat-label">Low Stock Products</span>
                      <span className="stat-num text-yellow">{lowStockProducts.length}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Out of Stock</span>
                      <span className="stat-num text-red">{outOfStockProducts.length}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Stock Requests</span>
                      <span className="stat-num">{totalStockRequests}</span>
                    </div>
                  </div>

                </div>

                {lowStockProducts.length > 0 && (
                  <div className="reports-row">
                    <div className="report-panel table-panel">
                      <h3>Low Stock Alerts</h3>
                      <div className="table-responsive">
                        <table className="analytics-table">
                          <thead>
                            <tr>
                              <th>PRODUCT</th>
                              <th>AVAILABLE</th>
                              <th>MINIMUM</th>
                              <th>STATUS</th>
                              <th>ACTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lowStockProducts.map((p: any) => (
                              <tr key={p.id}>
                                <td className="bold">{p.name}</td>
                                <td>{p.totalQuantity - p.reservedQuantity} {p.unit}</td>
                                <td>{p.minimumStock}</td>
                                <td><span className={`status-badge ${p.status === 'Critical' ? 'critical' : 'low'}`}>{p.status}</span></td>
                                <td><button className="text-btn" onClick={() => onNavigate && onNavigate('stock')}>View Stock</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar / Insights Column */}
          <div className="reports-sidebar">
            <div className="report-panel insight-panel bg-navy text-white">
              <h3 className="text-white">
                <Zap size={18} className="text-yellow" /> Key Insights
                {lowStockProducts.length > 0 && <span className="text-muted"><AlertTriangle size={14} className="text-yellow" /> Inventory warning</span>}
              </h3>
              <div className="insight-list">
                {topInsights.map((insight, idx) => (
                  <div key={idx} className="insight-item">
                    <div className="insight-bullet"></div>
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="report-panel activity-panel">
              <h3>Recent Business Activity</h3>
              <div className="activity-timeline">
                {activeActivities.length > 0 ? activeActivities.map(act => (
                  <div key={act.id} className="timeline-item">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <p className="timeline-msg">{act.message}</p>
                      <span className="timeline-meta">{act.user} • {act.createdAt}</span>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state small">No recent activity.</div>
                )}
              </div>
            </div>
            
            {/* Inventory Health Visual */}
            {currentUser?.role !== 'Dealer' && (
              <div className="report-panel health-panel">
                <h3>Inventory Health</h3>
                <div className="health-bar-container">
                  <div className="health-bar healthy" style={{ flex: Math.max(1, totalStockItems - lowStockProducts.length - outOfStockProducts.length) }} title="Healthy"></div>
                  <div className="health-bar low" style={{ flex: Math.max(0.1, lowStockProducts.length) }} title="Low Stock"></div>
                  <div className="health-bar out" style={{ flex: Math.max(0.1, outOfStockProducts.length) }} title="Out of Stock"></div>
                </div>
                <div className="health-legend">
                  <div className="legend-item"><div className="legend-dot bg-green"></div> Healthy</div>
                  <div className="legend-item"><div className="legend-dot bg-orange"></div> Low Stock</div>
                  <div className="legend-item"><div className="legend-dot bg-red"></div> Out of Stock</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {isCustomDateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCustomDateModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Custom Date Range</h2>
              <button className="close-btn" onClick={() => setIsCustomDateModalOpen(false)}><X size={20} /></button>
            </div>
            <form className="modal-form" onSubmit={handleApplyCustomDate}>
              <div className="form-group">
                <label>From</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>To</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsCustomDateModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Apply</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isExportPreviewOpen && (
        <div className="modal-overlay" onClick={() => setIsExportPreviewOpen(false)}>
          <div className="modal-content export-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Report Preview</h2>
              <button className="close-btn" onClick={() => setIsExportPreviewOpen(false)}><X size={20} /></button>
            </div>
            <div className="export-preview-body">
              <div className="preview-doc">
                <h1 className="preview-title">Solar CRM Report</h1>
                <p className="preview-meta">Generated: {new Date().toLocaleString()}</p>
                <p className="preview-meta">Date Range: {dateRange}</p>
                {hasActiveFilters && <p className="preview-meta">Filters Applied: Yes</p>}
                
                <div className="preview-section">
                  <h4>Summary</h4>
                  <p>Total Leads: {totalLeadsCount}</p>
                  <p>Overall Conv: {periodConversionRate}%</p>
                  <p>Completed Follow-ups: {followUpStats.completed}</p>
                </div>
                <div className="preview-section">
                  <h4>Pipeline</h4>
                  <p>Conversions: {periodConvertedCount}</p>
                  <p>Active: {activeLeadsCount}</p>
                </div>
                <div className="preview-watermark">PREVIEW ONLY</div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setIsExportPreviewOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={executeExport}><Download size={16} style={{marginRight: '8px'}} /> Export {exportFormat.toUpperCase()}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
