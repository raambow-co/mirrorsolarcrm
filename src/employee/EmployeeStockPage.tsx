import { useState, useMemo } from 'react';
import { Package, AlertTriangle, Archive, Search, ArrowRight } from 'lucide-react';
import { useStock } from '../context/StockContext';

import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import '../StockPage.css'; // Reusing existing Stock CSS layout

export default function EmployeeStockPage() {
  const { stockItems } = useStock();
  const { addActivity, currentUser } = useCRM();
  const { showToast } = useUI();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const categories = ['All', ...Array.from(new Set(stockItems.map(item => item.category)))];

  // Derived Summary
  const availableItemsCount = stockItems.reduce((acc, item) => acc + item.totalQuantity, 0);
  const reservedItemsCount = stockItems.reduce((acc, item) => acc + Math.floor(item.totalQuantity * 0.1), 0);
  const lowStockCount = stockItems.filter(item => item.totalQuantity <= item.minimumStock).length;
  const requestsCount = 4; // Mock

  const filteredStock = useMemo(() => {
    return stockItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [stockItems, searchQuery, categoryFilter]);

  return (
    <div className="stock-page" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-left">
          <p>Dashboard / Stock</p>
          <h1>Stock Inventory</h1>
          <p>View current available and reserved inventory.</p>
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
            <span className="sp-card-title">Stock Requests</span>
            <div className="sp-card-icon orange"><Package size={20} /></div>
          </div>
          <div className="sp-card-value">{requestsCount}</div>
          <div className="sp-card-bottom-accent orange"></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sp-toolbar">
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

      {/* Table */}
      <div className="table-container">
        <table className="sp-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Available</th>
              <th>Reserved</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStock.map(item => {
              const isLowStock = item.totalQuantity <= item.minimumStock;
              const mockReserved = Math.floor(item.totalQuantity * 0.1);
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
                  <td data-label="Reserved">
                    <span className="sp-count sp-neutral">{mockReserved}</span>
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
                      addActivity({
                        type: 'Stock Request',
                        message: `Requested stock for ${item.name}`,
                        user: currentUser?.name || 'Employee',
                        employee: currentUser?.name || 'Employee'
                      });
                      showToast(`Requested stock for ${item.name}`, 'success');
                    }}>
                      Request <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredStock.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  No items match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
