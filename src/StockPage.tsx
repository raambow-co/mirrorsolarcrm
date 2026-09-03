import { useState, useMemo } from 'react';
import { 
  Search, Plus, X, List, TrendingUp, History, ClipboardCheck, CheckCircle2,
  Package, Box, AlertTriangle, AlertCircle
} from 'lucide-react';
import { useStock } from './context/StockContext';
import type { StockItem, StockStatus, StockRequest, RequestStatus } from './context/StockContext';
import { useCRM } from './context/CRMContext';
import { useUI } from './context/UIContext';
import { canManageModule } from './utils/permissionCalculations';
import './StockPage.css';

export default function StockPage() {
  const { 
    stockItems, stockRequests, addStockItem, updateStockItem, adjustStock, reserveStock, releaseStock, archiveStock, updateStockRequestStatus, addStockRequest,
    totalItems, availableUnits, reservedUnits, lowStockCount, outOfStockCount, categorySummary 
  } = useStock();
  const { addActivity, currentUser, leads } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  const isAdmin = currentUser?.role === 'Admin';
  const isEmployee = currentUser?.role === 'Employee';
  const isDealer = currentUser?.role === 'Dealer';
  const canManageStock = canManageModule(currentUser, 'stock');

  const [activeTab, setActiveTab] = useState<'inventory' | 'requests'>('inventory');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [archiveFilter, setArchiveFilter] = useState<'Active' | 'Archived' | 'All'>('Active');
  
  const [reqStatusFilter, setReqStatusFilter] = useState('All');
  const [reqTypeFilter, setReqTypeFilter] = useState('All');
  const [reqSearchQuery, setReqSearchQuery] = useState('');

  // Modals & Panels
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'adjust' | 'reserve' | 'release' | 'request' | 'approve' | 'partially-approve' | 'reject' | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', sku: '', category: 'Solar Panels', unit: 'Units', quantity: 0, minimumStock: 0, maxStock: 100, warehouseLocation: '', notes: ''
  });
  
  const [adjustData, setAdjustData] = useState({ type: 'Add Stock', quantity: 0, reason: '' });
  const [reserveData, setReserveData] = useState({ quantity: 0, dealer: '', lead: '', reason: '' });
  
  const [requestData, setRequestData] = useState({ productSku: '', quantity: 1, requiredDate: '', lead: '', notes: '' });
  const [approvalData, setApprovalData] = useState({ quantity: 0, reason: '' });

  // Filter Logic
  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      if (archiveFilter === 'Active' && item.archived) return false;
      if (archiveFilter === 'Archived' && !item.archived) return false;
      
      const q = searchQuery.toLowerCase();
      if (q && !(item.name.toLowerCase().includes(q) || 
                 item.sku.toLowerCase().includes(q) || 
                 item.category.toLowerCase().includes(q) ||
                 (item.warehouseLocation && item.warehouseLocation.toLowerCase().includes(q)) ||
                 (item.notes && item.notes.toLowerCase().includes(q)))) return false;
      
      if (categoryFilter !== 'All Categories' && item.category !== categoryFilter) return false;
      
      if (statusFilter !== 'All Statuses') {
        if (statusFilter === 'Healthy' && item.status !== 'Healthy') return false;
        if (statusFilter === 'Moderate' && item.status !== 'Moderate') return false;
        if (statusFilter === 'Low' && item.status !== 'Low') return false;
        if (statusFilter === 'Critical' && item.status !== 'Critical') return false;
        if (statusFilter === 'Out of Stock' && item.status !== 'Out of Stock') return false;
      }
      return true;
    });
  }, [stockItems, searchQuery, categoryFilter, statusFilter, archiveFilter]);

  const visibleRequests = useMemo(() => {
    let base = stockRequests;
    if (isDealer) base = base.filter(r => r.requesterType === 'Dealer' && r.requester === currentUser?.name);
    else if (isEmployee) base = base.filter(r => r.requesterType === 'Employee' && r.requester === currentUser?.name);
    
    return base.filter(r => {
      const q = reqSearchQuery.toLowerCase();
      if (q && !(r.id.toLowerCase().includes(q) || 
                 r.itemSku.toLowerCase().includes(q) || 
                 r.requester.toLowerCase().includes(q) ||
                 (r.notes && r.notes.toLowerCase().includes(q)))) return false;
      if (reqStatusFilter !== 'All' && r.status !== reqStatusFilter) return false;
      if (reqTypeFilter !== 'All' && r.requesterType !== reqTypeFilter) return false;
      return true;
    });
  }, [stockRequests, isDealer, isEmployee, currentUser, reqSearchQuery, reqStatusFilter, reqTypeFilter]);

  const hasActiveFilters = searchQuery || categoryFilter !== 'All Categories' || statusFilter !== 'All Statuses' || archiveFilter !== 'Active';

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('All Categories');
    setStatusFilter('All Statuses');
    setArchiveFilter('Active');
  };

  const getStatusClass = (status: StockStatus) => {
    switch (status) {
      case 'Healthy': return 'healthy';
      case 'Moderate': return 'moderate';
      case 'Low': return 'low';
      case 'Critical': return 'critical';
      case 'Out of Stock': return 'out-of-stock';
      default: return '';
    }
  };

  const alertItems = stockItems.filter(item => !item.archived && (item.status === 'Critical' || item.status === 'Low')).slice(0, 3);
  const pendingRequests = stockRequests.filter(r => r.status === 'Pending').length;

  const openModal = (type: typeof modalType, item?: StockItem) => {
    setModalType(type);
    if (item) {
      setSelectedItem(item);
      setFormData({
        name: item.name, sku: item.sku, category: item.category, unit: item.unit, 
        quantity: item.totalQuantity, minimumStock: item.minimumStock, maxStock: item.maxStock, 
        warehouseLocation: item.warehouseLocation, notes: item.notes
      });
      setAdjustData({ type: 'Add Stock', quantity: 0, reason: '' });
      setReserveData({ quantity: 0, dealer: '', lead: '', reason: '' });
    } else {
      setSelectedItem(null);
      setFormData({
        name: '', sku: '', category: 'Solar Panels', unit: 'Units', quantity: 0, minimumStock: 0, maxStock: 100, warehouseLocation: '', notes: ''
      });
    }
  };

  const closeModal = () => setModalType(null);

  const handleAddSubmit = async () => {
    const res = await addStockItem({
      name: formData.name, sku: formData.sku, category: formData.category, unit: formData.unit,
      totalQuantity: formData.quantity, reservedQuantity: 0, minimumStock: formData.minimumStock,
      maxStock: formData.maxStock, warehouseLocation: formData.warehouseLocation, notes: formData.notes
    });
    if (!res.success) {
      showToast(res.error || 'Failed to add', 'error');
    } else {
      showToast('Stock item added successfully.', 'success');
      addActivity({ type: 'Stock Added', message: `Added new stock item ${formData.name}`, user: currentUser?.name || 'Admin' });
      closeModal();
    }
  };

  const handleEditSubmit = () => {
    if (!selectedItem) return;
    updateStockItem(selectedItem.id, {
      name: formData.name, category: formData.category, unit: formData.unit,
      minimumStock: formData.minimumStock, maxStock: formData.maxStock, 
      warehouseLocation: formData.warehouseLocation, notes: formData.notes
    }, currentUser?.name || 'Admin');
    showToast('Stock details updated.', 'success');
    closeModal();
  };

  const handleAdjustSubmit = async () => {
    if (!selectedItem) return;
    const change = adjustData.type === 'Add Stock' ? adjustData.quantity : -adjustData.quantity;
    const res = await adjustStock(selectedItem.id, change, currentUser?.name || 'Admin', adjustData.reason);
    if (!res.success) {
      showToast(res.error || 'Failed to adjust', 'error');
    } else {
      showToast('Stock updated successfully.', 'success');
      addActivity({ type: 'Stock Adjusted', message: `${Math.abs(change)} units ${adjustData.type === 'Add Stock' ? 'added to' : 'removed from'} ${selectedItem.name}`, user: currentUser?.name || 'Admin' });
      closeModal();
    }
  };

  const handleReserveSubmit = async () => {
    if (!selectedItem) return;
    const res = await reserveStock(selectedItem.id, reserveData.quantity, currentUser?.name || 'Admin', reserveData.reason || `For Dealer: ${reserveData.dealer}`);
    if (!res.success) {
      showToast(res.error || 'Failed to reserve', 'error');
    } else {
      showToast('Stock reserved successfully.', 'success');
      addActivity({ type: 'Stock Reserved', message: `Reserved ${reserveData.quantity} units of ${selectedItem.name}`, user: currentUser?.name || 'Admin' });
      closeModal();
    }
  };

  const handleReleaseSubmit = async () => {
    if (!selectedItem) return;
    const res = await releaseStock(selectedItem.id, reserveData.quantity, currentUser?.name || 'Admin', reserveData.reason);
    if (!res.success) {
      showToast(res.error || 'Failed to release', 'error');
    } else {
      showToast('Reservation released.', 'success');
      addActivity({ type: 'Stock Released', message: `Released ${reserveData.quantity} units of ${selectedItem.name}`, user: currentUser?.name || 'Admin' });
      closeModal();
    }
  };

  const handleArchive = (item: StockItem) => {
    showConfirmModal('Archive Item?', `Are you sure you want to archive ${item.name}? It will be hidden from normal inventory.`, () => {
      archiveStock(item.id, currentUser?.name || 'Admin');
      showToast('Inventory item archived.', 'success');
      setSelectedItem(null);
    });
  };

  const handleRequestStockSubmit = () => {
    if (!requestData.productSku || requestData.quantity <= 0 || !requestData.requiredDate) {
      showToast('Please fill all required fields.', 'error');
      return;
    }
    addStockRequest({
      requester: currentUser?.name || 'Unknown',
      requesterType: (currentUser?.role === 'Dealer' || currentUser?.role === 'Employee') ? currentUser.role : 'Employee',
      dealer: isDealer ? currentUser?.name : (isEmployee ? requestData.lead : ''), // Simplified assumption
      itemSku: requestData.productSku,
      requestedQty: requestData.quantity,
      requiredDate: requestData.requiredDate,
      priority: 'Medium',
      notes: requestData.notes,
      relatedLead: requestData.lead
    });
    addActivity({
      type: 'Request Created',
      message: `${currentUser?.name} requested ${requestData.quantity} units of ${requestData.productSku}`,
      user: currentUser?.name || 'Unknown'
    });
    showToast('Stock request submitted successfully.', 'success');
    closeModal();
  };

  const handleApproveRequest = async (isPartial: boolean = false) => {
    if (!selectedRequest) return;
    const action = isPartial ? 'Partially Approved' : 'Approved';
    const res = await updateStockRequestStatus(selectedRequest.id, action, currentUser?.name || 'Admin', approvalData.reason, isPartial ? approvalData.quantity : undefined);
    if (!res.success) {
      showToast(res.error || 'Approval failed', 'error');
    } else {
      showToast(`Request ${action.toLowerCase()}.`, 'success');
      addActivity({ type: 'Request Updated', message: `Stock request ${selectedRequest.id} ${action.toLowerCase()}`, user: currentUser?.name || 'Admin' });
      closeModal();
      setSelectedRequest(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest || !approvalData.reason) {
      showToast('Reason is required to reject a request.', 'error');
      return;
    }
    const res = await updateStockRequestStatus(selectedRequest.id, 'Rejected', currentUser?.name || 'Admin', approvalData.reason);
    if (res.success) {
      showToast('Request rejected.', 'success');
      addActivity({ type: 'Request Updated', message: `Stock request ${selectedRequest.id} rejected.`, user: currentUser?.name || 'Admin' });
      closeModal();
      setSelectedRequest(null);
    }
  };

  const handleRequestAction = (req: StockRequest, action: RequestStatus) => {
    if (action === 'Completed') {
       showConfirmModal('Complete Request', `Mark ${req.id} as completed? This will deduct the stock from inventory permanently.`, async () => {
         const res = await updateStockRequestStatus(req.id, 'Completed', currentUser?.name || 'Admin');
         if (res.success) {
           showToast('Request completed.', 'success');
           addActivity({ type: 'Request Updated', message: `Stock request ${req.id} completed.`, user: currentUser?.name || 'Admin' });
           setSelectedRequest(null);
         } else {
           showToast(res.error || 'Failed to complete', 'error');
         }
       });
       return;
    }
    
    // For Approve/Partial/Reject, open the respective modals
    if (action === 'Approved') {
      setSelectedRequest(req);
      setModalType('approve');
      setApprovalData({ quantity: req.requestedQty, reason: '' });
    } else if (action === 'Partially Approved') {
      setSelectedRequest(req);
      setModalType('partially-approve');
      setApprovalData({ quantity: req.requestedQty - 1, reason: '' });
    } else if (action === 'Rejected') {
      setSelectedRequest(req);
      setModalType('reject');
      setApprovalData({ quantity: 0, reason: '' });
    }
  };

  return (
    <div className="stock-page fade-in">
      {/* Breadcrumb & Header */}
      <div className="stock-header">
        <div>
          <div className="stock-breadcrumb">Dashboard / Stock</div>
          <div className="stock-title">
            <h1>Stock Management</h1>
            <p>Monitor inventory, stock availability and material requests.</p>
          </div>
        </div>
        <div className="stock-header-actions">
          <button className="btn-outline" onClick={() => setActiveTab(activeTab === 'inventory' ? 'requests' : 'inventory')}>
            <List size={18} />
            Stock Requests
            {pendingRequests > 0 && <span className="badge">{pendingRequests}</span>}
          </button>
          {canManageStock ? (
            <button className="btn-primary" onClick={() => openModal('add')}>
              <Plus size={18} />
              Add Stock
            </button>
          ) : (
            <button className="btn-primary" onClick={() => openModal('request')}>
              <Plus size={18} />
              Request Stock
            </button>
          )}
        </div>
      </div>

      {activeTab === 'inventory' ? (
        <>
          {/* Summary Cards */}
          <div className="stock-summary-grid">
            <div className="stock-summary-card">
              <div className="card-header-row">
                <div className="card-icon navy"><Box size={20} /></div>
                <span className="card-label">Total Items</span>
              </div>
              <span className="card-value">{totalItems}</span>
              <span className="card-desc">Across all categories</span>
            </div>
            <div className="stock-summary-card">
              <div className="card-header-row">
                <div className="card-icon success"><Package size={20} /></div>
                <span className="card-label">Available Units</span>
              </div>
              <span className="card-value">{availableUnits.toLocaleString()}</span>
              <span className="card-desc">Units ready</span>
            </div>
            <div className="stock-summary-card">
              <div className="card-header-row">
                <div className="card-icon yellow"><ClipboardCheck size={20} /></div>
                <span className="card-label">Reserved</span>
              </div>
              <span className="card-value">{reservedUnits.toLocaleString()}</span>
              <span className="card-desc">Already allocated</span>
            </div>
            <div className="stock-summary-card">
              <div className="card-header-row">
                <div className="card-icon orange"><AlertTriangle size={20} /></div>
                <span className="card-label">Low Stock</span>
              </div>
              <span className="card-value">{lowStockCount}</span>
              <span className="card-desc">Needs attention</span>
            </div>
            <div className="stock-summary-card">
              <div className="card-header-row">
                <div className="card-icon danger"><AlertCircle size={20} /></div>
                <span className="card-label">Out of Stock</span>
              </div>
              <span className="card-value">{outOfStockCount}</span>
              <span className="card-desc">Immediate action</span>
            </div>
          </div>

          <div className="row-grid-2-1">
            <div className="stock-panel">
              <h2><Box size={20} className="icon" /> Inventory Overview</h2>
              <div className="inventory-categories">
                {Object.entries(categorySummary).map(([cat, summary]) => {
                  const percentAvailable = summary.max > 0 ? (summary.val / summary.max) * 100 : 0;
                  const percentReserved = summary.max > 0 ? (summary.reserved / summary.max) * 100 : 0;
                  return (
                    <div key={cat} className="inv-cat-item">
                      <div className="inv-cat-header">
                        <span>{cat} <span className="text-muted" style={{fontSize:'0.8rem'}}>({summary.count} items)</span></span>
                        <div className="inv-cat-stats">
                          <span style={{color: '#16a34a'}}>Avail: {summary.val.toLocaleString()}</span>
                          <span style={{color: 'var(--color-yellow)'}}>Res: {summary.reserved.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="inv-cat-bar-container">
                        <div className="inv-cat-bar-available" style={{ width: `${percentAvailable}%` }}></div>
                        <div className="inv-cat-bar-reserved" style={{ width: `${percentReserved}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="stock-panel">
              <h2><AlertTriangle size={20} className="icon" style={{color: 'var(--color-orange)'}} /> Low Stock Alerts</h2>
              {alertItems.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {alertItems.map(item => (
                    <div key={item.id} style={{padding: '1rem', background: item.status === 'Critical' ? '#fef2f2' : '#fffbeb', borderRadius: '8px', border: `1px solid ${item.status === 'Critical' ? '#fecaca' : '#fde68a'}`}}>
                      <div style={{fontWeight: 700, marginBottom: '0.25rem'}}>{item.name}</div>
                      <div style={{fontSize: '0.85rem', color: '#64748b', display: 'flex', justifyContent: 'space-between'}}>
                        <span>Available: <strong style={{color: item.status === 'Critical' ? '#ef4444' : 'var(--color-orange)'}}>{item.totalQuantity - item.reservedQuantity}</strong></span>
                        <span>Min: {item.minimumStock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{padding: '1.5rem', marginTop: 'auto', marginBottom: 'auto'}}>
                  <CheckCircle2 size={32} style={{color: '#16a34a', marginBottom: '0.5rem'}} />
                  <h3 style={{fontSize: '1rem'}}>All inventory levels are healthy.</h3>
                </div>
              )}
            </div>
          </div>

          <div className="stock-panel">
            <h2><List size={20} className="icon" /> All Inventory</h2>
            
            <div className="stock-filters-bar">
              <div className="stock-search">
                <Search size={16} color="#64748b" />
                <input type="text" placeholder="Search inventory..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <select className="stock-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="All Categories">All Categories</option>
                <option value="Solar Panels">Solar Panels</option>
                <option value="Inverters">Inverters</option>
                <option value="Mounting">Mounting</option>
                <option value="Cables">Cables</option>
                <option value="Accessories">Accessories</option>
                <option value="Other">Other</option>
              </select>
              <select className="stock-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="All Statuses">All Statuses</option>
                <option value="Healthy">Healthy</option>
                <option value="Moderate">Moderate</option>
                <option value="Low">Low</option>
                <option value="Critical">Critical</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
              <select className="stock-filter-select" value={archiveFilter} onChange={e => setArchiveFilter(e.target.value as any)}>
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
                <option value="All">All</option>
              </select>
            </div>

            {hasActiveFilters && (
              <div className="active-filters">
                {searchQuery && <div className="filter-chip">"{searchQuery}" <button onClick={() => setSearchQuery('')}><X size={12}/></button></div>}
                {categoryFilter !== 'All Categories' && <div className="filter-chip">{categoryFilter} <button onClick={() => setCategoryFilter('All Categories')}><X size={12}/></button></div>}
                {statusFilter !== 'All Statuses' && <div className="filter-chip">{statusFilter} <button onClick={() => setStatusFilter('All Statuses')}><X size={12}/></button></div>}
                {archiveFilter !== 'Active' && <div className="filter-chip">{archiveFilter} <button onClick={() => setArchiveFilter('Active')}><X size={12}/></button></div>}
                <button className="clear-filters-btn" onClick={clearFilters}>Clear All</button>
              </div>
            )}

            {/* Low Stock Alerts */}
            {alertItems.length > 0 && (
              <div style={{marginBottom: '1rem'}}>
                {alertItems.map(item => (
                  <div key={item.id} className={`low-stock-alert ${item.status === 'Out of Stock' ? 'out-of-stock' : ''}`}>
                    <div className="low-stock-info">
                      <AlertTriangle size={18} style={{color: item.status === 'Out of Stock' ? '#ef4444' : 'var(--color-orange)'}} />
                      <span>
                        <strong>{item.name}</strong> 
                        {item.status === 'Out of Stock' ? ' is completely out of stock.' : ` has only ${item.totalQuantity - item.reservedQuantity} units left. Min required: ${item.minimumStock}.`}
                      </span>
                    </div>
                    <button className="btn-outline" onClick={() => setSelectedItem(item)} style={{padding: '0.25rem 0.75rem'}}>View</button>
                  </div>
                ))}
              </div>
            )}

            <div className="stock-table-wrapper">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>ITEM</th>
                    <th>AVAILABLE</th>
                    <th>RESERVED</th>
                    <th>TOTAL</th>
                    <th>STATUS</th>
                    <th>UPDATED</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No stock items found.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => {
                      const available = item.totalQuantity - item.reservedQuantity;
                      return (
                        <tr key={item.id} className={item.archived ? 'archived' : ''}>
                          <td>
                            <div className="item-name-col">
                              <span>{item.name} {item.archived && <span className="text-muted text-sm">(Archived)</span>}</span>
                              <span className="item-sku">{item.sku}</span>
                            </div>
                          </td>
                          <td>
                            <div className="stock-meter-container">
                              <div className="stock-meter-labels">
                                <span>{available}</span>
                                <span style={{color: '#cbd5e1'}}>{item.maxStock}</span>
                              </div>
                              <div className="stock-meter-track">
                                <div className={
                                  item.status === 'Healthy' || item.status === 'Moderate' ? 'meter-healthy' :
                                  item.status === 'Low' ? 'meter-low' : 'meter-critical'
                                } style={{ width: `${Math.min((available / item.maxStock) * 100, 100)}%` }}></div>
                              </div>
                            </div>
                          </td>
                          <td style={{color: 'var(--color-orange)'}}>{item.reservedQuantity}</td>
                          <td className="text-muted">{item.totalQuantity} {item.unit}</td>
                          <td><span className={`status-badge ${getStatusClass(item.status)}`}>{item.status}</span></td>
                          <td className="text-muted text-sm">{item.updatedAt}</td>
                          <td>
                            <button className="btn-action" onClick={() => setSelectedItem(item)}>View →</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Stock Requests Tab */
        <div className="stock-panel">
          <h2><List size={20} className="icon" /> {isDealer || isEmployee ? 'My Stock Requests' : 'All Stock Requests'}</h2>
          
          <div className="stock-filters" style={{marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
             <div className="search-bar" style={{flex: 1, minWidth: '200px'}}>
               <Search size={18} />
               <input type="text" placeholder="Search requests..." value={reqSearchQuery} onChange={e => setReqSearchQuery(e.target.value)} />
             </div>
             <select value={reqStatusFilter} onChange={e => setReqStatusFilter(e.target.value)}>
               <option value="All">All Statuses</option>
               <option>Pending</option>
               <option>Approved</option>
               <option>Partially Approved</option>
               <option>Rejected</option>
               <option>Completed</option>
             </select>
             {isAdmin && (
               <select value={reqTypeFilter} onChange={e => setReqTypeFilter(e.target.value)}>
                 <option value="All">All Requesters</option>
                 <option>Dealer</option>
                 <option>Employee</option>
               </select>
             )}
          </div>

          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>REQUEST</th>
                  <th>REQUESTER</th>
                  <th>ITEM</th>
                  <th>QTY</th>
                  <th>APPROVED</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map(req => {
                  const item = stockItems.find(i => i.sku === req.itemSku);
                  return (
                    <tr key={req.id}>
                      <td className="font-bold">{req.id}</td>
                      <td>
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                          <span>{req.requester}</span>
                          <span className="text-muted text-sm">{req.requesterType}</span>
                        </div>
                      </td>
                      <td>
                        <div className="item-name-col">
                          <span>{item ? item.name : 'Unknown Item'}</span>
                          <span className="item-sku">{req.itemSku}</span>
                        </div>
                      </td>
                      <td className="font-bold">{req.requestedQty}</td>
                      <td style={{color: req.approvedQty && req.approvedQty > 0 ? '#16a34a' : 'inherit'}}>{req.approvedQty || 0}</td>
                      <td className="text-muted">{req.requestedDate}</td>
                      <td><span className={`status-badge ${
                        req.status === 'Approved' ? 'healthy' : 
                        req.status === 'Partially Approved' ? 'healthy' : 
                        req.status === 'Completed' ? 'healthy' : 
                        req.status === 'Pending' ? 'moderate' : 
                        req.status === 'Rejected' ? 'critical' : 'out-of-stock'
                      }`}>{req.status}</span></td>
                      <td>
                        <button className="btn-action" onClick={() => setSelectedRequest(req)}>View →</button>
                      </td>
                    </tr>
                  );
                })}
                {visibleRequests.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <ClipboardCheck size={48} />
                        <h3>No stock requests found.</h3>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedItem && modalType === null && (
        <div className="detail-panel-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <div>
                <div className="detail-title"><h3>{selectedItem.name}</h3></div>
                <div className="detail-sku">{selectedItem.sku} | {selectedItem.category}</div>
              </div>
              <button className="detail-close" onClick={() => setSelectedItem(null)}><X size={24}/></button>
            </div>
            
            <div className="detail-body">
              {selectedItem.archived && (
                <div style={{background: '#fef2f2', padding: '1rem', borderRadius: '8px', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <AlertCircle size={18}/> This item is archived and hidden from normal inventory.
                </div>
              )}

              <div className="detail-section">
                <h4>Inventory Status</h4>
                <div className="stock-level-visual">
                  <div className="stock-level-bar">
                    <div className={`stock-bar-available ${(selectedItem.totalQuantity - selectedItem.reservedQuantity) <= selectedItem.minimumStock ? 'low' : ''}`} 
                         style={{width: `${Math.max(0, Math.min(100, ((selectedItem.totalQuantity - selectedItem.reservedQuantity) / Math.max(1, selectedItem.totalQuantity)) * 100))}%`}}></div>
                    <div className="stock-bar-reserved" 
                         style={{width: `${Math.max(0, Math.min(100, (selectedItem.reservedQuantity / Math.max(1, selectedItem.totalQuantity)) * 100))}%`}}></div>
                  </div>
                  <div className="stock-level-labels">
                    <span>Available: <strong style={{color: '#16a34a'}}>{selectedItem.totalQuantity - selectedItem.reservedQuantity}</strong></span>
                    <span>Reserved: <strong style={{color: 'var(--color-yellow)'}}>{selectedItem.reservedQuantity}</strong></span>
                    <span>Total: <strong>{selectedItem.totalQuantity}</strong></span>
                  </div>
                </div>
                
                <div className="detail-stat" style={{marginBottom: '1.5rem'}}>
                  <label>Status</label>
                  <div><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{selectedItem.status}</span></div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Details</h4>
                <div className="detail-grid">
                  <div className="detail-stat">
                    <label>Warehouse Location</label>
                    <span style={{fontSize: '0.9rem', color: '#64748b'}}>{selectedItem.warehouseLocation || 'Unassigned'}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Min. Required</label>
                    <span style={{fontSize: '0.9rem', color: '#64748b'}}>{selectedItem.minimumStock}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Last Updated</label>
                    <span style={{fontSize: '0.9rem', color: '#64748b'}}>{selectedItem.updatedAt}</span>
                  </div>
                </div>
                {selectedItem.notes && (
                  <div style={{marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b'}}>
                    <strong>Notes:</strong> {selectedItem.notes}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h4>Actions</h4>
                <div className="detail-actions">
                  <button className="btn-action" onClick={() => openModal('edit', selectedItem)}>Edit Details</button>
                  <button className="btn-action" onClick={() => openModal('adjust', selectedItem)}>Adjust Stock</button>
                  <button className="btn-action" onClick={() => openModal('reserve', selectedItem)} disabled={selectedItem.totalQuantity - selectedItem.reservedQuantity === 0}>Reserve Stock</button>
                  <button className="btn-action" onClick={() => openModal('release', selectedItem)} disabled={selectedItem.reservedQuantity === 0}>Release</button>
                  {!selectedItem.archived && <button className="btn-danger" onClick={() => handleArchive(selectedItem)} style={{flexBasis: '100%'}}>Archive Item</button>}
                </div>
              </div>

              <div className="detail-section">
                <h4>Stock Activity</h4>
                <div className="history-timeline">
                  {selectedItem.history.slice(0, 5).map(h => (
                    <div key={h.id} className="history-item">
                      <div className={`history-icon ${h.quantityChange > 0 ? 'positive' : h.quantityChange < 0 ? 'negative' : 'neutral'}`}>
                        {h.quantityChange > 0 ? <TrendingUp size={16}/> : h.quantityChange < 0 ? <TrendingUp size={16} style={{transform: 'rotate(180deg)'}}/> : <History size={16}/>}
                      </div>
                      <div className="history-content">
                        <span className="history-title">{h.quantityChange > 0 ? '+' : ''}{h.quantityChange} units {h.action.toLowerCase()}</span>
                        <div className="history-meta">
                          <span>{h.date}</span>
                          <span>{h.user}</span>
                        </div>
                        {h.reason && <span className="history-reason">{h.reason}</span>}
                      </div>
                    </div>
                  ))}
                  {selectedItem.history.length === 0 && (
                    <span className="text-muted text-sm">No recorded history.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Request Panel */}
      {selectedRequest && (
        <div className="detail-panel-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="detail-panel fade-in" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <div>
                <div className="detail-title"><h3>Request {selectedRequest.id}</h3></div>
                <div className="detail-sku">From: {selectedRequest.requester} ({selectedRequest.requesterType})</div>
              </div>
              <button className="detail-close" onClick={() => setSelectedRequest(null)}><X size={24}/></button>
            </div>
            
            <div className="detail-body">
              <div className="detail-section">
                <h4>Request Status</h4>
                <div className="status-timeline">
                  <div className={`timeline-node completed`}>
                    <div className="timeline-dot"><CheckCircle2 size={14}/></div>
                    <span className="timeline-label">Requested</span>
                    <span className="timeline-date">{selectedRequest.requestedDate}</span>
                  </div>
                  
                  {selectedRequest.status === 'Rejected' ? (
                     <div className={`timeline-node rejected`}>
                       <div className="timeline-dot"><AlertCircle size={14}/></div>
                       <span className="timeline-label">Rejected</span>
                     </div>
                  ) : (
                     <>
                       <div className={`timeline-node ${selectedRequest.status === 'Approved' || selectedRequest.status === 'Partially Approved' || selectedRequest.status === 'Completed' ? 'completed' : selectedRequest.status === 'Pending' ? 'current' : ''}`}>
                         <div className="timeline-dot"><CheckCircle2 size={14}/></div>
                         <span className="timeline-label">Approved</span>
                       </div>
                       <div className={`timeline-node ${selectedRequest.status === 'Completed' ? 'completed' : (selectedRequest.status === 'Approved' || selectedRequest.status === 'Partially Approved' ? 'current' : '')}`}>
                         <div className="timeline-dot"><CheckCircle2 size={14}/></div>
                         <span className="timeline-label">Completed</span>
                       </div>
                     </>
                  )}
                </div>
                
                <div className="detail-grid">
                  <div className="detail-stat">
                    <label>Item SKU</label>
                    <span style={{fontFamily: 'monospace', fontSize: '0.9rem'}}>{selectedRequest.itemSku}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Priority</label>
                    <span style={{color: selectedRequest.priority === 'High' ? '#ef4444' : 'var(--color-navy)'}}>{selectedRequest.priority}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Requested Qty</label>
                    <span style={{fontSize: '1.25rem', color: 'var(--color-orange)'}}>{selectedRequest.requestedQty}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Approved Qty</label>
                    <span style={{fontSize: '1.25rem', color: '#16a34a'}}>{selectedRequest.approvedQty || 0}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Remaining Qty</label>
                    <span style={{fontSize: '1.1rem'}}>{selectedRequest.remainingQty !== undefined ? selectedRequest.remainingQty : selectedRequest.requestedQty}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Required Date</label>
                    <span>{selectedRequest.requiredDate}</span>
                  </div>
                  {selectedRequest.relatedLead && (
                    <div className="detail-stat">
                      <label>Related Lead</label>
                      <span style={{color: 'var(--color-navy)', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => showToast('Navigating to lead...')}>{selectedRequest.relatedLead}</span>
                    </div>
                  )}
                </div>
                {selectedRequest.notes && (
                  <div style={{marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b'}}>
                    <strong>Requester Notes:</strong> {selectedRequest.notes}
                  </div>
                )}
              </div>

              {selectedRequest.status === 'Pending' && canManageStock && (
                <div className="detail-section">
                  <h4>Admin Actions</h4>
                  <div className="detail-actions" style={{flexDirection: 'column'}}>
                    <button className="btn-primary" onClick={() => handleRequestAction(selectedRequest, 'Approved')} style={{justifyContent: 'center'}}>Approve Full Quantity</button>
                    <button className="btn-action" onClick={() => handleRequestAction(selectedRequest, 'Partially Approved')} style={{justifyContent: 'center'}}>Approve Partial</button>
                    <button className="btn-danger" onClick={() => handleRequestAction(selectedRequest, 'Rejected')} style={{justifyContent: 'center'}}>Reject Request</button>
                  </div>
                </div>
              )}

              {(selectedRequest.status === 'Approved' || selectedRequest.status === 'Partially Approved') && canManageStock && (
                <div className="detail-section">
                  <h4>Completion</h4>
                  <p style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem'}}>Mark as completed once the dealer has physically received the stock. This will deduct it from Reserved inventory.</p>
                  <button className="btn-primary" onClick={() => handleRequestAction(selectedRequest, 'Completed')} style={{width: '100%', justifyContent: 'center'}}>Mark Completed</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals for Add/Edit/Adjust/Reserve/Release */}
      {modalType && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="stock-modal" onClick={e => e.stopPropagation()}>
            <h2>
              {modalType === 'add' ? 'Add Stock Item' : 
               modalType === 'edit' ? 'Edit Details' : 
               modalType === 'adjust' ? 'Adjust Stock' : 
               modalType === 'reserve' ? 'Reserve Stock' : 'Release Reservation'}
            </h2>
            
            {(modalType === 'add' || modalType === 'edit') && (
              <>
                <div className="form-group">
                  <label>Item Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>SKU</label>
                    <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} disabled={modalType === 'edit'} />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option>Solar Panels</option><option>Inverters</option><option>Mounting</option><option>Cables</option><option>Accessories</option><option>Other</option>
                    </select>
                  </div>
                </div>
                {modalType === 'add' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Initial Quantity</label>
                      <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="e.g. Units, Kits" />
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Min. Required</label>
                    <input type="number" value={formData.minimumStock} onChange={e => setFormData({...formData, minimumStock: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label>Warehouse</label>
                    <input type="text" value={formData.warehouseLocation} onChange={e => setFormData({...formData, warehouseLocation: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2} />
                </div>
              </>
            )}

            {modalType === 'adjust' && selectedItem && (
              <>
                <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between'}}>
                  <span>Current Available: <strong>{selectedItem.totalQuantity - selectedItem.reservedQuantity}</strong></span>
                  <span>Total Physical: <strong>{selectedItem.totalQuantity}</strong></span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Adjustment Type</label>
                    <select value={adjustData.type} onChange={e => setAdjustData({...adjustData, type: e.target.value})}>
                      <option>Add Stock</option>
                      <option>Remove Stock</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quantity</label>
                    <input type="number" value={adjustData.quantity} onChange={e => setAdjustData({...adjustData, quantity: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <select value={adjustData.reason} onChange={e => setAdjustData({...adjustData, reason: e.target.value})}>
                    <option value="">Select Reason...</option>
                    <option>Received shipment</option>
                    <option>Damaged</option>
                    <option>Correction</option>
                    <option>Allocation</option>
                    <option>Other</option>
                  </select>
                </div>
              </>
            )}

            {modalType === 'reserve' && selectedItem && (
              <>
                <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem'}}>
                  Available to reserve: <strong style={{color: '#16a34a'}}>{selectedItem.totalQuantity - selectedItem.reservedQuantity}</strong>
                </div>
                <div className="form-group">
                  <label>Quantity to Reserve</label>
                  <input type="number" value={reserveData.quantity} onChange={e => setReserveData({...reserveData, quantity: parseInt(e.target.value) || 0})} max={selectedItem.totalQuantity - selectedItem.reservedQuantity} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Related Dealer</label>
                    <input type="text" value={reserveData.dealer} onChange={e => setReserveData({...reserveData, dealer: e.target.value})} placeholder="e.g. Sri Solar Dealers" />
                  </div>
                  <div className="form-group">
                    <label>Related Lead</label>
                    <input type="text" value={reserveData.lead} onChange={e => setReserveData({...reserveData, lead: e.target.value})} placeholder="Optional" />
                  </div>
                </div>
              </>
            )}

            {modalType === 'release' && selectedItem && (
              <>
                <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem'}}>
                  Currently Reserved: <strong style={{color: 'var(--color-orange)'}}>{selectedItem.reservedQuantity}</strong>
                </div>
                <div className="form-group">
                  <label>Quantity to Release</label>
                  <input type="number" value={reserveData.quantity} onChange={e => setReserveData({...reserveData, quantity: parseInt(e.target.value) || 0})} max={selectedItem.reservedQuantity} />
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <input type="text" value={reserveData.reason} onChange={e => setReserveData({...reserveData, reason: e.target.value})} placeholder="e.g. Order cancelled" />
                </div>
              </>
            )}
            {modalType === 'request' && (
              <>
                <div className="form-group">
                  <label>Product *</label>
                  <select value={requestData.productSku} onChange={e => setRequestData({...requestData, productSku: e.target.value})}>
                    <option value="">Select Product...</option>
                    {stockItems.filter(i => !i.archived).map(i => (
                      <option key={i.id} value={i.sku}>{i.name} ({i.sku})</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input type="number" value={requestData.quantity} onChange={e => setRequestData({...requestData, quantity: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label>Required Date *</label>
                    <input type="date" value={requestData.requiredDate} onChange={e => setRequestData({...requestData, requiredDate: e.target.value})} />
                  </div>
                </div>
                {isEmployee && (
                  <div className="form-group">
                    <label>Related Lead (Optional)</label>
                    <select value={requestData.lead} onChange={e => setRequestData({...requestData, lead: e.target.value})}>
                      <option value="">Select Lead...</option>
                      {leads.map(l => <option key={l.id} value={l.id}>{l.customer}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={requestData.notes} onChange={e => setRequestData({...requestData, notes: e.target.value})} rows={2}></textarea>
                </div>
              </>
            )}

            {(modalType === 'approve' || modalType === 'partially-approve') && selectedRequest && (
              <>
                <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem'}}>
                  <p style={{margin: 0}}>Requested: <strong>{selectedRequest.requestedQty}</strong></p>
                  <p style={{margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.9rem'}}>Please confirm the amount to approve.</p>
                </div>
                <div className="form-group">
                  <label>Quantity to Approve</label>
                  <input type="number" value={approvalData.quantity} onChange={e => setApprovalData({...approvalData, quantity: parseInt(e.target.value) || 0})} max={selectedRequest.requestedQty} disabled={modalType === 'approve'} />
                </div>
                <div className="form-group">
                  <label>Reason / Notes (Optional)</label>
                  <input type="text" value={approvalData.reason} onChange={e => setApprovalData({...approvalData, reason: e.target.value})} placeholder="e.g. Approved partially due to low stock" />
                </div>
              </>
            )}

            {modalType === 'reject' && selectedRequest && (
              <>
                <div className="form-group">
                  <label>Rejection Reason *</label>
                  <select value={approvalData.reason} onChange={e => setApprovalData({...approvalData, reason: e.target.value})}>
                    <option value="">Select a reason...</option>
                    <option>Insufficient Stock</option>
                    <option>Invalid Request</option>
                    <option>Duplicate</option>
                    <option>Other</option>
                  </select>
                </div>
              </>
            )}

            <div className="modal-actions" style={{marginTop: '1.5rem', display: 'flex', gap: '0.5rem'}}>
              <button className="btn-outline" onClick={closeModal} style={{flex: 1}}>Cancel</button>
              
              {modalType === 'add' ? <button className="btn-primary" onClick={handleAddSubmit} style={{flex: 1}}>Add Item</button> :
               modalType === 'edit' ? <button className="btn-primary" onClick={handleEditSubmit} style={{flex: 1}}>Save Changes</button> :
               modalType === 'adjust' ? <button className="btn-primary" onClick={handleAdjustSubmit} style={{flex: 1}}>Save Adjustment</button> :
               modalType === 'reserve' ? <button className="btn-primary" onClick={handleReserveSubmit} style={{flex: 1}}>Confirm Reservation</button> :
               modalType === 'release' ? <button className="btn-primary" onClick={handleReleaseSubmit} style={{flex: 1}}>Release Stock</button> :
               modalType === 'request' ? <button className="btn-primary" onClick={handleRequestStockSubmit} style={{flex: 1}}>Submit Request</button> :
               (modalType === 'approve' || modalType === 'partially-approve') ? <button className="btn-primary" onClick={() => handleApproveRequest(modalType === 'partially-approve')} style={{flex: 1}}>Confirm Approval</button> :
               modalType === 'reject' ? <button className="btn-danger" onClick={handleRejectRequest} style={{flex: 1}}>Confirm Rejection</button> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
