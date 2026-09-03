import { useState, useMemo } from 'react';
import { Package, AlertTriangle, Archive, Search } from 'lucide-react';
import { useStock } from '../context/StockContext';

import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import '../StockPage.css';

export default function DealerStockPage() {
  const { stockItems } = useStock();
  const { addActivity, currentUser } = useCRM();
  const { showToast } = useUI();
  const dealerName = currentUser?.name || 'Dealer';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  
  const [requestForm, setRequestForm] = useState({ item: '', totalQuantity: '', requiredDate: '', notes: '' });
  
  // Mock Frontend Requests
  const [stockRequests, setStockRequests] = useState([
    { id: 'REQ001', item: '550W Solar Panel', totalQuantity: 20, status: 'Pending', date: 'Oct 24, 2023' }
  ]);

  const categories = ['All', ...Array.from(new Set(stockItems.map(item => item.category)))];

  // Derived Summary
  const availableItemsCount = stockItems.reduce((acc, item) => acc + item.totalQuantity, 0);
  const reservedItemsCount = stockItems.reduce((acc, item) => acc + Math.floor(item.totalQuantity * 0.1), 0);
  const lowStockCount = stockItems.filter(item => item.totalQuantity <= item.minimumStock).length;
  const requestsCount = stockRequests.length;

  const filteredStock = useMemo(() => {
    return stockItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [stockItems, searchQuery, categoryFilter]);

  const submitStockRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setStockRequests([
      { id: `REQ00${stockRequests.length + 2}`, item: requestForm.item, totalQuantity: parseInt(requestForm.totalQuantity) || 0, status: 'Pending', date: 'Just now' },
      ...stockRequests
    ]);
    addActivity({
      type: 'Stock Request',
      message: `Requested ${requestForm.totalQuantity}x ${requestForm.item}`,
      user: dealerName,
      employee: dealerName
    });
    setIsRequestModalOpen(false);
    setRequestForm({ item: '', totalQuantity: '', requiredDate: '', notes: '' });
    
    // Show success toast
    showToast('Stock request submitted successfully', 'success');
  };

  return (
    <div className="stock-page" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-left">
          <p>Dashboard / Stock</p>
          <h1>Stock Inventory</h1>
          <p>View available stock and submit requests.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="lp-btn-primary" onClick={() => setIsRequestModalOpen(true)}>
            Request Stock
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="sp-summary-grid">
        <div className="sp-summary-card">
          <div className="sp-card-header">
            <span className="sp-card-title">Available Items</span>
            <div className="sp-card-icon navy"><Package size={20} /></div>
          </div>
          <div className="sp-card-value">{availableItemsCount}</div>
          <div className="sp-card-bottom-accent navy"></div>
        </div>

        <div className="sp-summary-card">
          <div className="sp-card-header">
            <span className="sp-card-title">Reserved</span>
            <div className="sp-card-icon yellow"><Archive size={20} /></div>
          </div>
          <div className="sp-card-value">{reservedItemsCount}</div>
          <div className="sp-card-bottom-accent yellow"></div>
        </div>

        <div className="sp-summary-card">
          <div className="sp-card-header">
            <span className="sp-card-title">Low Stock</span>
            <div className="sp-card-icon red"><AlertTriangle size={20} /></div>
          </div>
          <div className="sp-card-value">{lowStockCount}</div>
          <div className="sp-card-bottom-accent red"></div>
        </div>

        <div className="sp-summary-card">
          <div className="sp-card-header">
            <span className="sp-card-title">My Requests</span>
            <div className="sp-card-icon orange"><Package size={20} /></div>
          </div>
          <div className="sp-card-value">{requestsCount}</div>
          <div className="sp-card-bottom-accent orange"></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        
        {/* Inventory List */}
        <div>
          <h2 className="lp-section-title">Global Inventory</h2>
          
          <div className="sp-toolbar" style={{ marginBottom: '1rem' }}>
            <div className="sp-search-bar">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search items..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              className="sp-select"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
            </select>
          </div>

          <div className="table-container">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map(item => {
                  const isLowStock = item.totalQuantity <= item.minimumStock;
                  return (
                    <tr key={item.id}>
                      <td data-label="Item">
                        <div className="sp-item-info">
                          <span className="sp-item-name">{item.name}</span>
                          <span className="sp-item-id">{item.id}</span>
                        </div>
                      </td>
                      <td data-label="Category">
                        <span className="sp-category-badge">{item.category}</span>
                      </td>
                      <td data-label="Available">
                        <span className={`sp-count ${isLowStock ? 'sp-low' : 'sp-good'}`}>{item.totalQuantity}</span>
                      </td>
                      <td data-label="Status">
                        {isLowStock ? (
                          <span className="sp-status sp-status-low"><AlertTriangle size={14} /> Low Stock</span>
                        ) : (
                          <span className="sp-status sp-status-ok">Available</span>
                        )}
                      </td>
                      <td data-label="Action">
                        <button className="lp-action-btn" onClick={() => {
                          setRequestForm({...requestForm, item: item.name});
                          setIsRequestModalOpen(true);
                        }}>
                          Request
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredStock.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      No items match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* My Requests Sidebar */}
        <div>
          <h2 className="lp-section-title">Stock Requests</h2>
          <div className="chart-card" style={{ padding: 0 }}>
            {stockRequests.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <p>No stock requests yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {stockRequests.map((req, i) => (
                  <div key={i} style={{ padding: '1.25rem', borderBottom: i < stockRequests.length - 1 ? '1px solid rgba(11,31,58,0.05)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-navy)' }}>{req.item}</span>
                      <span style={{ 
                        background: req.status === 'Pending' ? '#fef3c7' : '#dcfce7',
                        color: req.status === 'Pending' ? '#b45309' : '#16a34a',
                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600
                      }}>{req.status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Qty: <strong style={{ color: 'var(--color-navy)' }}>{req.totalQuantity}</strong></span>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{req.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Request Stock Modal */}
      {isRequestModalOpen && (
        <div className="lp-modal-overlay" onClick={() => setIsRequestModalOpen(false)}>
          <div className="lp-modal-content" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
            <h2 style={{ margin: 0, color: 'var(--color-navy)', fontSize: '1.25rem', fontWeight: 800 }}>Request Stock</h2>
            <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.9rem' }}>Submit a request to Admin for materials.</p>
            <form onSubmit={submitStockRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="lp-form-group">
                <label>Item</label>
                <select required value={requestForm.item} onChange={e => setRequestForm({...requestForm, item: e.target.value})}>
                  <option value="" disabled>Select an item...</option>
                  {stockItems.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                </select>
              </div>
              <div className="lp-form-row">
                <div className="lp-form-group">
                  <label>Quantity</label>
                  <input required type="number" min="1" value={requestForm.totalQuantity} onChange={e => setRequestForm({...requestForm, totalQuantity: e.target.value})} placeholder="e.g. 5" />
                </div>
                <div className="lp-form-group">
                  <label>Required Date</label>
                  <input required type="text" value={requestForm.requiredDate} onChange={e => setRequestForm({...requestForm, requiredDate: e.target.value})} placeholder="e.g. Tomorrow" />
                </div>
              </div>
              <div className="lp-form-group">
                <label>Notes</label>
                <textarea rows={3} value={requestForm.notes} onChange={e => setRequestForm({...requestForm, notes: e.target.value})} placeholder="Optional notes for Admin"></textarea>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="lp-btn-secondary" onClick={() => setIsRequestModalOpen(false)}>Cancel</button>
                <button type="submit" className="lp-btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
