import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';

export type StockStatus = 'Healthy' | 'Moderate' | 'Low' | 'Critical' | 'Out of Stock';

export interface StockHistoryItem {
  id: string;
  date: string;
  action: string;
  quantityChange: number;
  before: number;
  after: number;
  user: string;
  reason: string;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  totalQuantity: number; 
  reservedQuantity: number; 
  unit: string;
  minimumStock: number;
  maxStock: number; 
  warehouseLocation: string;
  notes: string;
  status: StockStatus;
  updatedAt: string;
  archived: boolean;
  history: StockHistoryItem[];
}

export type RequestStatus = 'Pending' | 'Approved' | 'Partially Approved' | 'Rejected' | 'Completed';

export interface StockRequest {
  id: string;
  requester: string;
  requesterType: 'Employee' | 'Dealer';
  dealer?: string;
  itemSku: string;
  requestedQty: number;
  approvedQty?: number;
  remainingQty?: number;
  requestedDate: string;
  requiredDate: string;
  priority: 'High' | 'Medium' | 'Low';
  notes: string;
  status: RequestStatus;
  relatedLead?: string;
}

interface StockContextType {
  stockItems: StockItem[];
  stockRequests: StockRequest[];
  
  addStockItem: (item: Omit<StockItem, 'id' | 'status' | 'updatedAt' | 'history' | 'archived'>) => Promise<{ success: boolean; error?: string }>;
  updateStockItem: (id: string, updates: Partial<StockItem>, user?: string, reason?: string) => Promise<void>;
  adjustStock: (id: string, change: number, user: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  reserveStock: (id: string, quantity: number, user: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  releaseStock: (id: string, quantity: number, user: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  archiveStock: (id: string, user: string) => Promise<void>;
  
  addStockRequest: (req: Omit<StockRequest, 'id' | 'status' | 'requestedDate'>) => Promise<void>;
  updateStockRequestStatus: (reqId: string, status: RequestStatus, user: string, reason?: string, partialQty?: number) => Promise<{ success: boolean; error?: string }>;

  totalItems: number;
  availableUnits: number;
  reservedUnits: number;
  lowStockCount: number;
  criticalCount: number;
  outOfStockCount: number;
  
  categorySummary: Record<string, { val: number; max: number; warn: boolean; status: StockStatus; count: number; reserved: number }>;
}

const calculateStatus = (available: number, minimumStock: number, maxStock: number): StockStatus => {
  if (available <= 0) return 'Out of Stock';
  const percentage = maxStock > 0 ? (available / maxStock) * 100 : 100;
  if (available <= minimumStock) {
    if (available <= Math.max(1, minimumStock * 0.3)) return 'Critical';
    return 'Low';
  }
  if (percentage > 30) return 'Healthy';
  return 'Moderate';
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const StockContext = createContext<StockContextType | undefined>(undefined);

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);

  useEffect(() => {
    const unsubscribeItems = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const items: StockItem[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as StockItem);
      });
      setStockItems(items);
    });

    const unsubscribeRequests = onSnapshot(collection(db, 'stockRequests'), (snapshot) => {
      const requests: StockRequest[] = [];
      snapshot.forEach(doc => {
        requests.push({ id: doc.id, ...doc.data() } as StockRequest);
      });
      setStockRequests(requests);
    });

    return () => {
      unsubscribeItems();
      unsubscribeRequests();
    };
  }, []);

  const addStockItem = async (item: Omit<StockItem, 'id' | 'status' | 'updatedAt' | 'history' | 'archived'>) => {
    if (stockItems.some(i => i.sku === item.sku && !i.archived)) {
      return { success: false, error: 'SKU already exists.' };
    }
    
    const available = item.totalQuantity - item.reservedQuantity;
    const newItemId = `ST${Date.now()}`;
    const newItem: StockItem = {
      ...item,
      id: newItemId,
      status: calculateStatus(available, item.minimumStock, item.maxStock),
      updatedAt: 'Just now',
      archived: false,
      history: [{
        id: generateId(),
        date: 'Just now',
        action: 'Initial Stock',
        quantityChange: item.totalQuantity,
        before: 0,
        after: item.totalQuantity,
        user: 'Admin',
        reason: 'Item created'
      }]
    };
    
    try {
      await setDoc(doc(db, 'inventory', newItemId), newItem);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateStockItem = async (id: string, updates: Partial<StockItem>, user = 'System', reason = 'Edited details') => {
    const item = stockItems.find(i => i.id === id);
    if (!item) return;

    const updatedItem = { ...item, ...updates };
    const available = updatedItem.totalQuantity - updatedItem.reservedQuantity;
    updatedItem.status = calculateStatus(available, updatedItem.minimumStock, updatedItem.maxStock);
    updatedItem.updatedAt = 'Just now';
    
    if (updates.totalQuantity !== undefined && updates.totalQuantity !== item.totalQuantity) {
       const change = updates.totalQuantity - item.totalQuantity;
       updatedItem.history = [{
         id: generateId(),
         date: 'Just now',
         action: 'Adjusted',
         quantityChange: change,
         before: item.totalQuantity,
         after: updates.totalQuantity,
         user,
         reason
       }, ...item.history];
    }

    try {
      await updateDoc(doc(db, 'inventory', id), updatedItem);
    } catch(err) {
      console.error(err);
    }
  };

  const adjustStock = async (id: string, change: number, user: string, reason: string) => {
    const item = stockItems.find(i => i.id === id);
    if (!item) return { success: false, error: 'Item not found' };

    const available = item.totalQuantity - item.reservedQuantity;
    if (change < 0 && Math.abs(change) > available) {
      return { success: false, error: 'Insufficient available stock.' };
    }

    const newTotal = item.totalQuantity + change;
    await updateStockItem(id, { totalQuantity: newTotal }, user, reason);
    return { success: true };
  };

  const reserveStock = async (id: string, quantity: number, user: string, reason: string) => {
    const item = stockItems.find(i => i.id === id);
    if (!item) return { success: false, error: 'Item not found' };

    const available = item.totalQuantity - item.reservedQuantity;
    if (quantity > available) {
      return { success: false, error: `Only ${available} units are currently available.` };
    }

    const newReserved = item.reservedQuantity + quantity;
    const newAvailable = item.totalQuantity - newReserved;
    const updatedItem = {
      ...item,
      reservedQuantity: newReserved,
      status: calculateStatus(newAvailable, item.minimumStock, item.maxStock),
      updatedAt: 'Just now',
      history: [{
        id: generateId(),
        date: 'Just now',
        action: 'Reserved',
        quantityChange: -quantity, 
        before: available,
        after: newAvailable,
        user,
        reason
      }, ...item.history]
    };

    try {
      await updateDoc(doc(db, 'inventory', id), updatedItem);
      return { success: true };
    } catch(err: any) {
      return { success: false, error: err.message };
    }
  };

  const releaseStock = async (id: string, quantity: number, user: string, reason: string) => {
    const item = stockItems.find(i => i.id === id);
    if (!item) return { success: false, error: 'Item not found' };

    if (quantity > item.reservedQuantity) {
      return { success: false, error: 'Cannot release more than reserved quantity.' };
    }

    const newReserved = item.reservedQuantity - quantity;
    const available = item.totalQuantity - item.reservedQuantity;
    const newAvailable = item.totalQuantity - newReserved;
    const updatedItem = {
      ...item,
      reservedQuantity: newReserved,
      status: calculateStatus(newAvailable, item.minimumStock, item.maxStock),
      updatedAt: 'Just now',
      history: [{
        id: generateId(),
        date: 'Just now',
        action: 'Released',
        quantityChange: quantity, 
        before: available,
        after: newAvailable,
        user,
        reason
      }, ...item.history]
    };

    try {
      await updateDoc(doc(db, 'inventory', id), updatedItem);
      return { success: true };
    } catch(err: any) {
      return { success: false, error: err.message };
    }
  };

  const archiveStock = async (id: string, user: string) => {
    await updateStockItem(id, { archived: true }, user, 'Archived item');
  };

  const addStockRequest = async (req: Omit<StockRequest, 'id' | 'status' | 'requestedDate'>) => {
    const newReqId = `REQ-${Date.now().toString().slice(-4)}`;
    const newReq: StockRequest = {
      ...req,
      id: newReqId,
      status: 'Pending',
      requestedDate: 'Just now',
      approvedQty: 0,
      remainingQty: req.requestedQty
    };
    try {
      await setDoc(doc(db, 'stockRequests', newReqId), newReq);
    } catch (err) {
      console.error(err);
    }
  };

  const updateStockRequestStatus = async (reqId: string, status: RequestStatus, user: string, reason?: string, partialQty?: number) => {
    const req = stockRequests.find(r => r.id === reqId);
    if (!req) return { success: false, error: 'Request not found' };
    
    const item = stockItems.find(i => i.sku === req.itemSku && !i.archived);
    if (!item && status !== 'Rejected') return { success: false, error: 'Linked item not found or archived' };

    let qtyToReserve = status === 'Partially Approved' ? (partialQty || 0) : req.requestedQty;
    
    if (qtyToReserve > req.requestedQty) {
       qtyToReserve = req.requestedQty;
    }

    if ((status === 'Approved' || status === 'Partially Approved') && item) {
       const available = item.totalQuantity - item.reservedQuantity;
       if (qtyToReserve > available) {
         return { success: false, error: 'Insufficient available stock to approve this request.' };
       }
       if (qtyToReserve > 0) {
         const reserveRes = await reserveStock(item.id, qtyToReserve, user, `Approved request ${req.id}`);
         if (!reserveRes.success) return reserveRes;
       }
    }

    if (status === 'Completed' && item) {
       const amountToComplete = req.approvedQty && req.approvedQty > 0 ? req.approvedQty : req.requestedQty;
       const updatedItem = {
         ...item,
         totalQuantity: item.totalQuantity - amountToComplete,
         reservedQuantity: item.reservedQuantity - amountToComplete,
         history: [{
           id: generateId(),
           date: 'Just now',
           action: 'Completed',
           quantityChange: -amountToComplete,
           before: item.totalQuantity,
           after: item.totalQuantity - amountToComplete,
           user,
           reason: reason || `Completed request ${req.id}`
         }, ...item.history]
       };
       try {
         await updateDoc(doc(db, 'inventory', item.id), updatedItem);
       } catch (err) {
         console.error(err);
       }
    }

    const updatedReq: any = { status };
    if (status === 'Approved') {
      updatedReq.approvedQty = req.requestedQty;
      updatedReq.remainingQty = 0;
    } else if (status === 'Partially Approved' && partialQty !== undefined) {
      updatedReq.approvedQty = partialQty;
      updatedReq.remainingQty = req.requestedQty - partialQty;
    }

    try {
      await updateDoc(doc(db, 'stockRequests', reqId), updatedReq);
      return { success: true };
    } catch(err: any) {
      return { success: false, error: err.message };
    }
  };

  const { totalItems, availableUnits, reservedUnits, lowStockCount, criticalCount, outOfStockCount, categorySummary } = useMemo(() => {
    const activeItems = stockItems.filter(i => !i.archived);
    let totalItems = activeItems.length;
    let availableUnits = 0;
    let reservedUnits = 0;
    let lowStockCount = 0;
    let criticalCount = 0;
    let outOfStockCount = 0;
    
    const categorySummary: Record<string, { val: number; max: number; warn: boolean; status: StockStatus; count: number; reserved: number }> = {};

    activeItems.forEach(item => {
      const available = item.totalQuantity - item.reservedQuantity;
      availableUnits += available;
      reservedUnits += item.reservedQuantity;
      
      if (item.status === 'Low') lowStockCount++;
      if (item.status === 'Critical') criticalCount++;
      if (item.status === 'Out of Stock') outOfStockCount++;

      if (!categorySummary[item.category]) {
         categorySummary[item.category] = { val: 0, max: 0, warn: false, status: 'Healthy', count: 0, reserved: 0 };
      }
      categorySummary[item.category].count++;
      categorySummary[item.category].val += available;
      categorySummary[item.category].reserved += item.reservedQuantity;
      categorySummary[item.category].max += item.maxStock;
    });
    
    Object.keys(categorySummary).forEach(cat => {
      const summary = categorySummary[cat];
      const effectiveMax = summary.max > 0 ? summary.max : 100;
      summary.status = calculateStatus(summary.val, 0, effectiveMax);
      summary.warn = summary.status === 'Low' || summary.status === 'Critical' || summary.status === 'Out of Stock';
    });

    return { totalItems, availableUnits, reservedUnits, lowStockCount, criticalCount, outOfStockCount, categorySummary };
  }, [stockItems]);

  return (
    <StockContext.Provider value={{
      stockItems,
      stockRequests,
      addStockItem,
      updateStockItem,
      adjustStock,
      reserveStock,
      releaseStock,
      archiveStock,
      addStockRequest,
      updateStockRequestStatus,
      totalItems,
      availableUnits,
      reservedUnits,
      lowStockCount,
      criticalCount,
      outOfStockCount,
      categorySummary
    }}>
      {children}
    </StockContext.Provider>
  );
};

export const useStock = () => {
  const context = useContext(StockContext);
  if (context === undefined) {
    throw new Error('useStock must be used within a StockProvider');
  }
  return context;
};
