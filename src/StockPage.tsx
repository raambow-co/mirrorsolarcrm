import { useState, useMemo } from 'react';
import { 
  Search, Plus, X, List, TrendingUp, History, ClipboardCheck, CheckCircle2,
  Package, Box, AlertTriangle, AlertCircle, Truck, Layers, FileSpreadsheet,
  Check, ArrowRight, UserCheck, ShieldCheck, ChevronRight, Clock, Trash2, ArrowUpRight
} from 'lucide-react';
import { useStock } from './context/StockContext';
import type { 
  StockItem, StockStatus, StockRequest, RequestStatus, StockDispatch, StockDispatchItem, DealerStockItem 
} from './context/StockContext';
import { useCRM } from './context/CRMContext';
import { useUI } from './context/UIContext';
import { canManageModule } from './utils/permissionCalculations';
import './StockPage.css';

export default function StockPage() {
  const { 
    stockItems, stockRequests, dealerStockList, stockDispatches, materialConsumptions,
    addStockItem, updateStockItem, adjustStock, reserveStock, releaseStock, archiveStock, 
    updateStockRequestStatus, addStockRequest, dispatchStockToDealer,
    totalItems, availableUnits, reservedUnits, lowStockCount, outOfStockCount, categorySummary 
  } = useStock();
  const { addActivity, currentUser, dealers, leads } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  const isAdmin = currentUser?.role === 'Admin';
  const isEmployee = currentUser?.role === 'Employee';
  const isDealer = currentUser?.role === 'Dealer';
  const canManageStock = canManageModule(currentUser, 'stock');

  const [activeTab, setActiveTab] = useState<'inventory' | 'dispatches' | 'dealer_stock' | 'consumptions' | 'requests'>('inventory');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [archiveFilter, setArchiveFilter] = useState<'Active' | 'Archived' | 'All'>('Active');
  
  // Dealer Stock & Dispatches Filter
  const [selectedDealerFilter, setSelectedDealerFilter] = useState<string>('All Dealers');
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState<string>('All');
  
  const [reqStatusFilter, setReqStatusFilter] = useState('All');
  const [reqTypeFilter, setReqTypeFilter] = useState('All');
  const [reqSearchQuery, setReqSearchQuery] = useState('');

  // Modals & Panels
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'adjust' | 'reserve' | 'release' | 'request' | 'approve' | 'partially-approve' | 'reject' | 'dispatch' | null>(null);

  // Warehouse Form State
  const [formData, setFormData] = useState({
    name: '', sku: '', category: 'Solar Panels', unit: 'Units', quantity: 0, minimumStock: 0, maxStock: 100, warehouseLocation: '', notes: ''
  });
  const [adjustData, setAdjustData] = useState({ type: 'Add Stock', quantity: 0, reason: '' });
  const [reserveData, setReserveData] = useState({ quantity: 0, dealer: '', lead: '', reason: '' });
  const [requestData, setRequestData] = useState({ productSku: '', quantity: 1, requiredDate: '', lead: '', notes: '' });
  const [approvalData, setApprovalData] = useState({ quantity: 0, reason: '' });

  // --- Dispatch Modal Form State ---
  const [dispatchTargetDealer, setDispatchTargetDealer] = useState('');
  const [dispatchWaybill, setDispatchWaybill] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchItemsList, setDispatchItemsList] = useState<StockDispatchItem[]>([]);
  const [currentDispatchItemSku, setCurrentDispatchItemSku] = useState('');
  const [currentDispatchItemQty, setCurrentDispatchItemQty] = useState<number>(1);

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

  const filteredDispatches = useMemo(() => {
    return stockDispatches.filter(d => {
      if (selectedDealerFilter !== 'All Dealers' && d.dealer !== selectedDealerFilter) return false;
      if (dispatchStatusFilter !== 'All' && d.status !== dispatchStatusFilter) return false;
      return true;
    });
  }, [stockDispatches, selectedDealerFilter, dispatchStatusFilter]);

  const filteredDealerStock = useMemo(() => {
    return dealerStockList.filter(d => {
      if (selectedDealerFilter !== 'All Dealers' && d.dealer !== selectedDealerFilter) return false;
      const q = searchQuery.toLowerCase();
      if (q && !(d.itemName.toLowerCase().includes(q) || d.itemSku.toLowerCase().includes(q) || d.dealer.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [dealerStockList, selectedDealerFilter, searchQuery]);

  const filteredConsumptions = useMemo(() => {
    return materialConsumptions.filter(c => {
      if (selectedDealerFilter !== 'All Dealers' && c.dealer !== selectedDealerFilter) return false;
      const q = searchQuery.toLowerCase();
      if (q && !(c.customerName.toLowerCase().includes(q) || c.leadId.toLowerCase().includes(q) || c.dealer.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [materialConsumptions, selectedDealerFilter, searchQuery]);

  const pendingRequests = useMemo(() => {
    return stockRequests.filter(r => r.status === 'Pending').length;
  }, [stockRequests]);

  const pendingDispatchesCount = useMemo(() => {
    return stockDispatches.filter(d => d.status === 'Pending Dealer Confirmation').length;
  }, [stockDispatches]);

  const alertItems = useMemo(() => {
    return stockItems.filter(item => !item.archived && (item.status === 'Low' || item.status === 'Critical' || item.status === 'Out of Stock'));
  }, [stockItems]);

  const hasActiveFilters = searchQuery !== '' || categoryFilter !== 'All Categories' || statusFilter !== 'All Statuses' || archiveFilter !== 'Active';

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

  const openModal = (type: typeof modalType, item?: StockItem) => {
    setModalType(type);
    if (type === 'dispatch') {
      setDispatchTargetDealer(dealers[0]?.name || '');
      setDispatchWaybill('');
      setDispatchNotes('');
      setDispatchItemsList([]);
      setCurrentDispatchItemSku(stockItems[0]?.sku || '');
      setCurrentDispatchItemQty(10);
      return;
    }
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

  // Add Item to current dispatch draft
  const handleAddDispatchItem = () => {
    if (!currentDispatchItemSku || currentDispatchItemQty <= 0) return;
    const stockItem = stockItems.find(i => i.sku === currentDispatchItemSku);
    if (!stockItem) return;

    const available = stockItem.totalQuantity - stockItem.reservedQuantity;
    if (currentDispatchItemQty > available) {
      showToast(`Only ${available} ${stockItem.unit} available in warehouse.`, 'error');
      return;
    }

    const existingIndex = dispatchItemsList.findIndex(i => i.sku === currentDispatchItemSku);
    if (existingIndex >= 0) {
      const updated = [...dispatchItemsList];
      updated[existingIndex].quantity += currentDispatchItemQty;
      setDispatchItemsList(updated);
    } else {
      setDispatchItemsList([
        ...dispatchItemsList,
        {
          sku: stockItem.sku,
          name: stockItem.name,
          category: stockItem.category,
          unit: stockItem.unit,
          quantity: currentDispatchItemQty
        }
      ]);
    }
    showToast(`Added ${currentDispatchItemQty} ${stockItem.unit} to dispatch list.`, 'info');
  };

  const handleRemoveDispatchItem = (sku: string) => {
    setDispatchItemsList(dispatchItemsList.filter(i => i.sku !== sku));
  };

  // Submit Bulk Dispatch to Dealer
  const handleDispatchSubmit = async () => {
    if (!dispatchTargetDealer) {
      showToast('Please select a target dealer.', 'error');
      return;
    }
    if (dispatchItemsList.length === 0) {
      showToast('Please add at least one item to dispatch.', 'error');
      return;
    }

    const res = await dispatchStockToDealer(
      dispatchTargetDealer,
      dispatchItemsList,
      dispatchNotes,
      dispatchWaybill,
      currentUser?.name || 'Admin'
    );

    if (!res.success) {
      showToast(res.error || 'Failed to dispatch stock', 'error');
    } else {
      showToast(`Bulk stock dispatched to ${dispatchTargetDealer}! Waiting for dealer confirmation.`, 'success');
      addActivity({
        type: 'Stock Dispatched',
        message: `Admin dispatched ${dispatchItemsList.reduce((acc, i) => acc + i.quantity, 0)} items to ${dispatchTargetDealer}`,
        user: currentUser?.name || 'Admin',
        dealer: dispatchTargetDealer
      });
      closeModal();
      setActiveTab('dispatches');
    }
  };

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
      dealer: isDealer ? currentUser?.name : (isEmployee ? requestData.lead : ''),
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
          <div className="stock-breadcrumb">Dashboard / Stock Management</div>
          <div className="stock-title">
            <h1>Stock Management & Dealer Inventory</h1>
            <p>Monitor warehouse inventory, dealer stock dispatches, and material consumption tracking.</p>
          </div>
        </div>
        <div className="stock-header-actions" style={{display: 'flex', gap: '0.75rem'}}>
          {canManageStock && (
            <button className="btn-secondary" onClick={() => openModal('dispatch')} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#0284c7', color: '#ffffff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: 700}}>
              <Truck size={18} />
              Dispatch Stock to Dealer
            </button>
          )}
          {canManageStock ? (
            <button className="btn-primary" onClick={() => openModal('add')}>
              <Plus size={18} />
              Add Stock Item
            </button>
          ) : (
            <button className="btn-primary" onClick={() => openModal('request')}>
              <Plus size={18} />
              Request Stock
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="stock-tabs-nav" style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        <button 
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', 
            fontWeight: 700, fontSize: '0.92rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'inventory' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'inventory' ? '#2563eb' : '#64748b', cursor: 'pointer'
          }}
        >
          <Box size={18} /> Central Warehouse
        </button>

        <button 
          className={`tab-btn ${activeTab === 'dispatches' ? 'active' : ''}`}
          onClick={() => setActiveTab('dispatches')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', 
            fontWeight: 700, fontSize: '0.92rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'dispatches' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'dispatches' ? '#0284c7' : '#64748b', cursor: 'pointer'
          }}
        >
          <Truck size={18} /> Dealer Dispatches
          {pendingDispatchesCount > 0 && (
            <span style={{background: '#d97706', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 800}}>
              {pendingDispatchesCount} pending
            </span>
          )}
        </button>

        <button 
          className={`tab-btn ${activeTab === 'dealer_stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('dealer_stock')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', 
            fontWeight: 700, fontSize: '0.92rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'dealer_stock' ? '3px solid #16a34a' : '3px solid transparent',
            color: activeTab === 'dealer_stock' ? '#16a34a' : '#64748b', cursor: 'pointer'
          }}
        >
          <Layers size={18} /> Dealer Stock Ledgers
        </button>

        <button 
          className={`tab-btn ${activeTab === 'consumptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('consumptions')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', 
            fontWeight: 700, fontSize: '0.92rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'consumptions' ? '3px solid #8b5cf6' : '3px solid transparent',
            color: activeTab === 'consumptions' ? '#8b5cf6' : '#64748b', cursor: 'pointer'
          }}
        >
          <FileSpreadsheet size={18} /> Material Deductions
        </button>

        <button 
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', 
            fontWeight: 700, fontSize: '0.92rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'requests' ? '3px solid #ea580c' : '3px solid transparent',
            color: activeTab === 'requests' ? '#ea580c' : '#64748b', cursor: 'pointer'
          }}
        >
          <List size={18} /> Stock Requests
          {pendingRequests > 0 && (
            <span style={{background: '#ea580c', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 800}}>
              {pendingRequests}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CENTRAL WAREHOUSE INVENTORY                                        */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
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
                        <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                          <td>
                            <div className="item-name-col">
                              <span className="item-title">{item.name}</span>
                              <span className="item-sku">{item.sku} &bull; {item.category}</span>
                            </div>
                          </td>
                          <td className="font-bold text-success">{available.toLocaleString()} {item.unit}</td>
                          <td className="font-bold text-yellow">{item.reservedQuantity.toLocaleString()} {item.unit}</td>
                          <td className="font-bold">{item.totalQuantity.toLocaleString()} {item.unit}</td>
                          <td>
                            <span className={`status-badge ${getStatusClass(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="text-muted">{item.updatedAt}</td>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEALER BULK DISPATCHES                                             */}
      {/* ========================================================================= */}
      {activeTab === 'dispatches' && (
        <div className="stock-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem'}}>
            <div>
              <h2 style={{margin: 0}}><Truck size={20} className="icon" style={{color: '#0284c7'}} /> Bulk Stock Dispatches to Dealers</h2>
              <p style={{margin: '4px 0 0 0', color: '#64748b', fontSize: '0.88rem'}}>
                Track materials sent from central warehouse to dealers. Dispatches automatically become active in the dealer's stock ledger upon their approval.
              </p>
            </div>
            {canManageStock && (
              <button className="btn-primary" onClick={() => openModal('dispatch')} style={{background: '#0284c7', borderColor: '#0284c7'}}>
                <Plus size={18} /> New Bulk Dispatch
              </button>
            )}
          </div>

          <div className="stock-filters" style={{marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
            <select value={selectedDealerFilter} onChange={e => setSelectedDealerFilter(e.target.value)} style={{padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}>
              <option value="All Dealers">All Dealers</option>
              {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <select value={dispatchStatusFilter} onChange={e => setDispatchStatusFilter(e.target.value)} style={{padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}>
              <option value="All">All Statuses</option>
              <option value="Pending Dealer Confirmation">Pending Dealer Confirmation</option>
              <option value="Confirmed / Delivered">Confirmed / Received</option>
              <option value="Rejected">Rejected by Dealer</option>
            </select>
          </div>

          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>DISPATCH ID</th>
                  <th>TARGET DEALER</th>
                  <th>ITEMS DISPATCHED</th>
                  <th>DISPATCHED BY</th>
                  <th>DATE</th>
                  <th>WAYBILL / NOTES</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{textAlign: 'center', padding: '2.5rem', color: '#64748b'}}>
                      <Truck size={40} style={{color: '#cbd5e1', marginBottom: '0.5rem'}} />
                      <p>No dispatch records found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredDispatches.map(d => (
                    <tr key={d.id}>
                      <td className="font-bold">{d.id}</td>
                      <td>
                        <span style={{fontWeight: 700, color: '#0f172a'}}>{d.dealer}</span>
                      </td>
                      <td>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '3px'}}>
                          {d.items.map((it, idx) => (
                            <span key={idx} style={{fontSize: '0.85rem', color: '#334155'}}>
                              <strong>{it.quantity} {it.unit}</strong> &bull; {it.name} ({it.sku})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-muted">{d.dispatchedBy}</td>
                      <td className="text-muted">{d.dispatchedAt}</td>
                      <td>
                        <div style={{fontSize: '0.85rem'}}>
                          {d.waybillOrNote && <div><strong>Ref:</strong> {d.waybillOrNote}</div>}
                          {d.notes && <div className="text-muted">{d.notes}</div>}
                          {!d.waybillOrNote && !d.notes && <span className="text-muted">-</span>}
                        </div>
                      </td>
                      <td>
                        {d.status === 'Pending Dealer Confirmation' && (
                          <span style={{background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px'}}>
                            <Clock size={13} /> Waiting Dealer
                          </span>
                        )}
                        {d.status === 'Confirmed / Delivered' && (
                          <span style={{background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px'}}>
                            <CheckCircle2 size={13} /> Received {d.acceptedAt ? `(${d.acceptedAt})` : ''}
                          </span>
                        )}
                        {d.status === 'Rejected' && (
                          <span style={{background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px'}}>
                            <AlertCircle size={13} /> Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEALER STOCK LEDGERS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'dealer_stock' && (
        <div className="stock-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem'}}>
            <div>
              <h2 style={{margin: 0}}><Layers size={20} className="icon" style={{color: '#16a34a'}} /> Active Dealer Stock Ledgers</h2>
              <p style={{margin: '4px 0 0 0', color: '#64748b', fontSize: '0.88rem'}}>
                Live inventory balances currently in possession of each dealer. Automatically increases when dispatches are accepted and reduces when installation material is approved.
              </p>
            </div>
          </div>

          <div className="stock-filters" style={{marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
            <div className="stock-search" style={{flex: 1, minWidth: '220px'}}>
              <Search size={16} color="#64748b" />
              <input type="text" placeholder="Search dealer stock or item..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select value={selectedDealerFilter} onChange={e => setSelectedDealerFilter(e.target.value)} style={{padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}>
              <option value="All Dealers">All Dealers</option>
              {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>DEALER</th>
                  <th>ITEM NAME</th>
                  <th>SKU</th>
                  <th>CATEGORY</th>
                  <th>CURRENT QUANTITY</th>
                  <th>LAST UPDATED</th>
                </tr>
              </thead>
              <tbody>
                {filteredDealerStock.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{textAlign: 'center', padding: '2.5rem', color: '#64748b'}}>
                      <Layers size={40} style={{color: '#cbd5e1', marginBottom: '0.5rem'}} />
                      <p>No dealer stock ledgers found. Dispatch inventory to dealers to initialize their stock.</p>
                    </td>
                  </tr>
                ) : (
                  filteredDealerStock.map(d => (
                    <tr key={d.id}>
                      <td className="font-bold" style={{color: '#0f172a'}}>{d.dealer}</td>
                      <td>
                        <span style={{fontWeight: 600}}>{d.itemName}</span>
                      </td>
                      <td className="item-sku">{d.itemSku}</td>
                      <td><span className="badge" style={{background: '#f1f5f9', color: '#475569'}}>{d.category}</span></td>
                      <td>
                        <span style={{
                          fontWeight: 800, 
                          fontSize: '1rem',
                          color: d.quantity > 5 ? '#16a34a' : (d.quantity > 0 ? '#ea580c' : '#dc2626')
                        }}>
                          {d.quantity} {d.unit}
                        </span>
                      </td>
                      <td className="text-muted">{d.lastUpdatedAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MATERIAL DEDUCTIONS FOR PROJECTS                                   */}
      {/* ========================================================================= */}
      {activeTab === 'consumptions' && (
        <div className="stock-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem'}}>
            <div>
              <h2 style={{margin: 0}}><FileSpreadsheet size={20} className="icon" style={{color: '#8b5cf6'}} /> Project Material Consumption History</h2>
              <p style={{margin: '4px 0 0 0', color: '#64748b', fontSize: '0.88rem'}}>
                Automatic stock deduction logs created when admin approves the Material / Installation stage for a dealer's lead.
              </p>
            </div>
          </div>

          <div className="stock-filters" style={{marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
            <div className="stock-search" style={{flex: 1, minWidth: '220px'}}>
              <Search size={16} color="#64748b" />
              <input type="text" placeholder="Search customer, lead ID or dealer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select value={selectedDealerFilter} onChange={e => setSelectedDealerFilter(e.target.value)} style={{padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}>
              <option value="All Dealers">All Dealers</option>
              {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>CONSUMPTION ID</th>
                  <th>LEAD / CUSTOMER</th>
                  <th>DEALER</th>
                  <th>DATE</th>
                  <th>ITEMS DEDUCTED FROM DEALER STOCK</th>
                  <th>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {filteredConsumptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{textAlign: 'center', padding: '2.5rem', color: '#64748b'}}>
                      <FileSpreadsheet size={40} style={{color: '#cbd5e1', marginBottom: '0.5rem'}} />
                      <p>No material consumption records yet. Once material approvals are completed for leads, deductions will be recorded here.</p>
                    </td>
                  </tr>
                ) : (
                  filteredConsumptions.map(c => (
                    <tr key={c.id}>
                      <td className="font-bold">{c.id}</td>
                      <td>
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                          <strong style={{color: '#0f172a'}}>{c.customerName}</strong>
                          <span className="text-muted text-sm">Lead: {c.leadId}</span>
                        </div>
                      </td>
                      <td className="font-bold">{c.dealer}</td>
                      <td className="text-muted">{c.date}</td>
                      <td>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '3px'}}>
                          {c.itemsDeducted.map((it, idx) => (
                            <span key={idx} style={{fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600}}>
                              - {it.quantity} {it.unit} &bull; {it.itemName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{fontSize: '0.85rem', color: '#475569'}}>
                        {c.notes || 'Standard Solar Sizing Deductions'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: STOCK REQUESTS                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
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

      {/* ========================================================================= */}
      {/* DETAIL DRAWER / PANEL                                                     */}
      {/* ========================================================================= */}
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
                <h4>Stock Levels</h4>
                <div className="stock-level-grid">
                  <div className="level-box">
                    <span className="lbl">Available</span>
                    <span className="val text-success">{selectedItem.totalQuantity - selectedItem.reservedQuantity}</span>
                    <span className="unit">{selectedItem.unit}</span>
                  </div>
                  <div className="level-box">
                    <span className="lbl">Reserved</span>
                    <span className="val text-yellow">{selectedItem.reservedQuantity}</span>
                    <span className="unit">{selectedItem.unit}</span>
                  </div>
                  <div className="level-box">
                    <span className="lbl">Total</span>
                    <span className="val">{selectedItem.totalQuantity}</span>
                    <span className="unit">{selectedItem.unit}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Warehouse & Thresholds</h4>
                <div className="detail-list">
                  <div className="detail-row"><span>Status</span><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{selectedItem.status}</span></div>
                  <div className="detail-row"><span>Minimum Level</span><span>{selectedItem.minimumStock} {selectedItem.unit}</span></div>
                  <div className="detail-row"><span>Maximum Level</span><span>{selectedItem.maxStock} {selectedItem.unit}</span></div>
                  <div className="detail-row"><span>Warehouse Location</span><span>{selectedItem.warehouseLocation || 'N/A'}</span></div>
                  <div className="detail-row"><span>Last Updated</span><span>{selectedItem.updatedAt}</span></div>
                  {selectedItem.notes && <div className="detail-row"><span>Notes</span><span>{selectedItem.notes}</span></div>}
                </div>
              </div>

              {canManageStock && (
                <div className="detail-actions">
                  <button className="btn-secondary" onClick={() => openModal('adjust', selectedItem)}>Adjust Quantity</button>
                  <button className="btn-secondary" onClick={() => openModal('reserve', selectedItem)}>Reserve Stock</button>
                  {selectedItem.reservedQuantity > 0 && (
                    <button className="btn-secondary" onClick={() => openModal('release', selectedItem)}>Release Reservation</button>
                  )}
                  <button className="btn-secondary" onClick={() => openModal('edit', selectedItem)}>Edit Details</button>
                  {!selectedItem.archived && (
                    <button className="btn-danger" onClick={() => handleArchive(selectedItem)}>Archive Item</button>
                  )}
                </div>
              )}

              <div className="detail-section">
                <h4>Stock Activity Log</h4>
                <div className="history-timeline">
                  {selectedItem.history.map(h => (
                    <div key={h.id} className="history-item">
                      <div className="history-icon"><Clock size={14}/></div>
                      <div className="history-info">
                        <div className="history-header">
                          <strong>{h.action}</strong>
                          <span className="history-date">{h.date}</span>
                        </div>
                        <div className="history-change">
                          Change: <strong className={h.quantityChange > 0 ? 'text-success' : 'text-danger'}>{h.quantityChange > 0 ? `+${h.quantityChange}` : h.quantityChange} {selectedItem.unit}</strong>
                          <span className="text-muted"> (Balance: {h.after})</span>
                        </div>
                        {h.reason && <div className="history-reason">"{h.reason}"</div>}
                        <div className="history-user">By: {h.user}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Request Modal / Drawer */}
      {selectedRequest && (
        <div className="detail-panel-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <div>
                <div className="detail-title"><h3>Stock Request {selectedRequest.id}</h3></div>
                <div className="detail-sku">Status: {selectedRequest.status}</div>
              </div>
              <button className="detail-close" onClick={() => setSelectedRequest(null)}><X size={24}/></button>
            </div>
            <div className="detail-body">
              <div className="detail-section">
                <h4>Request Details</h4>
                <div className="detail-list">
                  <div className="detail-row"><span>Requester</span><span>{selectedRequest.requester} ({selectedRequest.requesterType})</span></div>
                  <div className="detail-row"><span>Item SKU</span><span className="font-bold">{selectedRequest.itemSku}</span></div>
                  <div className="detail-row"><span>Requested Qty</span><span className="font-bold">{selectedRequest.requestedQty}</span></div>
                  <div className="detail-row"><span>Approved Qty</span><span>{selectedRequest.approvedQty || 0}</span></div>
                  <div className="detail-row"><span>Required Date</span><span>{selectedRequest.requiredDate}</span></div>
                  <div className="detail-row"><span>Created Date</span><span>{selectedRequest.requestedDate}</span></div>
                  {selectedRequest.dealer && <div className="detail-row"><span>Related Dealer</span><span>{selectedRequest.dealer}</span></div>}
                  {selectedRequest.relatedLead && <div className="detail-row"><span>Related Lead</span><span>{selectedRequest.relatedLead}</span></div>}
                  {selectedRequest.notes && <div className="detail-row"><span>Notes</span><span>{selectedRequest.notes}</span></div>}
                </div>
              </div>

              {canManageStock && selectedRequest.status === 'Pending' && (
                <div className="detail-actions" style={{display: 'flex', gap: '0.5rem', marginTop: '1rem'}}>
                  <button className="btn-primary" onClick={() => handleRequestAction(selectedRequest, 'Approved')} style={{flex: 1}}>
                    Approve Full
                  </button>
                  <button className="btn-secondary" onClick={() => handleRequestAction(selectedRequest, 'Partially Approved')} style={{flex: 1}}>
                    Approve Partial
                  </button>
                  <button className="btn-danger" onClick={() => handleRequestAction(selectedRequest, 'Rejected')} style={{flex: 1}}>
                    Reject
                  </button>
                </div>
              )}

              {canManageStock && (selectedRequest.status === 'Approved' || selectedRequest.status === 'Partially Approved') && (
                <div className="detail-actions" style={{marginTop: '1rem'}}>
                  <button className="btn-primary" style={{width: '100%'}} onClick={() => handleRequestAction(selectedRequest, 'Completed')}>
                    Mark Handed Over / Completed
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}
      {modalType && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: modalType === 'dispatch' ? '680px' : '520px'}}>
            <div className="modal-header">
              <h3>
                {modalType === 'add' && 'Add New Stock Item'}
                {modalType === 'edit' && 'Edit Stock Details'}
                {modalType === 'adjust' && `Adjust Stock - ${selectedItem?.name}`}
                {modalType === 'reserve' && `Reserve Stock - ${selectedItem?.name}`}
                {modalType === 'release' && `Release Reserved Stock - ${selectedItem?.name}`}
                {modalType === 'request' && 'Create Stock Request'}
                {modalType === 'approve' && 'Approve Stock Request'}
                {modalType === 'partially-approve' && 'Partially Approve Stock Request'}
                {modalType === 'reject' && 'Reject Stock Request'}
                {modalType === 'dispatch' && 'Bulk Dispatch Stock to Dealer'}
              </h3>
              <button className="modal-close-btn" onClick={closeModal}><X size={20}/></button>
            </div>

            {/* --- BULK DISPATCH TO DEALER MODAL --- */}
            {modalType === 'dispatch' && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
                <div className="form-group">
                  <label style={{fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem'}}>Target Dealer *</label>
                  <select 
                    value={dispatchTargetDealer} 
                    onChange={e => setDispatchTargetDealer(e.target.value)}
                    style={{width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600}}
                  >
                    {dealers.map(d => (
                      <option key={d.id} value={d.name}>{d.name} ({d.address || 'Dealer'})</option>
                    ))}
                  </select>
                </div>

                {/* Add Items to dispatch */}
                <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0'}}>
                  <label style={{fontWeight: 700, fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem', display: 'block'}}>
                    Add Items to Dispatch
                  </label>
                  <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.5rem', alignItems: 'flex-end'}}>
                    <div>
                      <span style={{fontSize: '0.78rem', color: '#64748b'}}>Warehouse Item:</span>
                      <select 
                        value={currentDispatchItemSku} 
                        onChange={e => setCurrentDispatchItemSku(e.target.value)}
                        style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem'}}
                      >
                        {stockItems.filter(i => !i.archived).map(i => {
                          const available = i.totalQuantity - i.reservedQuantity;
                          return (
                            <option key={i.id} value={i.sku}>
                              {i.name} ({i.sku}) - Avail: {available} {i.unit}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <span style={{fontSize: '0.78rem', color: '#64748b'}}>Quantity:</span>
                      <input 
                        type="number" 
                        min="1" 
                        value={currentDispatchItemQty} 
                        onChange={e => setCurrentDispatchItemQty(parseInt(e.target.value) || 0)} 
                        style={{width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem'}}
                      />
                    </div>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      onClick={handleAddDispatchItem}
                      style={{padding: '0.5rem 1rem', height: '36px', fontSize: '0.85rem', background: '#0284c7'}}
                    >
                      + Add
                    </button>
                  </div>

                  {/* List of items added */}
                  <div style={{marginTop: '0.75rem'}}>
                    {dispatchItemsList.length === 0 ? (
                      <p style={{fontSize: '0.82rem', color: '#94a3b8', margin: '0.5rem 0 0 0', textAlign: 'center'}}>No items added to dispatch list yet.</p>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem'}}>
                        {dispatchItemsList.map(it => (
                          <div key={it.sku} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem'}}>
                            <span><strong>{it.quantity} {it.unit}</strong> &bull; {it.name} <span style={{color: '#94a3b8'}}>({it.sku})</span></span>
                            <button type="button" onClick={() => handleRemoveDispatchItem(it.sku)} style={{background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer'}}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Waybill / Tracking No (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. VRL-992812" 
                      value={dispatchWaybill} 
                      onChange={e => setDispatchWaybill(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Dispatch Notes (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Sent via transport" 
                      value={dispatchNotes} 
                      onChange={e => setDispatchNotes(e.target.value)} 
                    />
                  </div>
                </div>

                <div style={{background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.85rem', color: '#1e40af'}}>
                  <strong>Dispatch Workflow:</strong> Stock is immediately deducted from Central Warehouse and recorded as <em>Pending Dealer Confirmation</em>. Once the dealer approves receipt in their dashboard, it will be added to their active stock.
                </div>

                <div className="modal-actions" style={{marginTop: '0.5rem', display: 'flex', gap: '0.75rem'}}>
                  <button type="button" className="btn-outline" onClick={closeModal} style={{flex: 1}}>Cancel</button>
                  <button type="button" className="btn-primary" onClick={handleDispatchSubmit} style={{flex: 2, background: '#0284c7', borderColor: '#0284c7'}}>
                    Confirm & Dispatch Stock
                  </button>
                </div>
              </div>
            )}

            {(modalType === 'add' || modalType === 'edit') && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Item Name *</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Mono PERC 540W" />
                  </div>
                  <div className="form-group">
                    <label>SKU Code *</label>
                    <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="e.g. SP-540-MONO" disabled={modalType === 'edit'} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option>Solar Panels</option>
                      <option>Inverters</option>
                      <option>Mounting</option>
                      <option>Cables</option>
                      <option>Accessories</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Unit of Measure</label>
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                      <option>Units</option>
                      <option>Meters</option>
                      <option>Boxes</option>
                      <option>Sets</option>
                      <option>Kg</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  {modalType === 'add' && (
                    <div className="form-group">
                      <label>Initial Quantity</label>
                      <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Minimum Stock Level</label>
                    <input type="number" value={formData.minimumStock} onChange={e => setFormData({...formData, minimumStock: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label>Maximum Stock Level</label>
                    <input type="number" value={formData.maxStock} onChange={e => setFormData({...formData, maxStock: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Warehouse Location</label>
                  <input type="text" value={formData.warehouseLocation} onChange={e => setFormData({...formData, warehouseLocation: e.target.value})} placeholder="e.g. Bay 2, Shelf C" />
                </div>
                <div className="form-group">
                  <label>Notes / Specifications</label>
                  <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2}></textarea>
                </div>
              </>
            )}

            {modalType === 'adjust' && selectedItem && (
              <>
                <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem'}}>
                  Current Balance: <strong>{selectedItem.totalQuantity} {selectedItem.unit}</strong> (Available: {selectedItem.totalQuantity - selectedItem.reservedQuantity})
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

            {modalType !== 'dispatch' && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
