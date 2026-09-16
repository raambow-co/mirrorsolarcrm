import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import type { DealerProjectSpecifications } from './CRMContext';

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

// --- Dealer Specific Inventory Model ---
export interface DealerStockItem {
  id: string; // `${dealer}_${sku}`
  dealer: string;
  itemSku: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  lastUpdatedAt: string;
}

export interface StockDispatchItem {
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
}

export type DispatchStatus = 'Pending Dealer Confirmation' | 'Confirmed / Delivered' | 'Rejected';

export interface StockDispatch {
  id: string;
  dealer: string;
  dispatchedBy: string;
  dispatchedAt: string;
  waybillOrNote?: string;
  items: StockDispatchItem[];
  status: DispatchStatus;
  acceptedAt?: string;
  acceptedBy?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface MaterialConsumptionRecord {
  id: string;
  leadId: string;
  customerName: string;
  dealer: string;
  approvedBy: string;
  date: string;
  itemsDeducted: {
    itemSku: string;
    itemName: string;
    quantity: number;
    unit: string;
  }[];
  notes?: string;
}

interface StockContextType {
  stockItems: StockItem[];
  stockRequests: StockRequest[];
  dealerStockList: DealerStockItem[];
  stockDispatches: StockDispatch[];
  materialConsumptions: MaterialConsumptionRecord[];
  
  // Warehouse Actions
  addStockItem: (item: Omit<StockItem, 'id' | 'status' | 'updatedAt' | 'history' | 'archived'>) => Promise<{ success: boolean; error?: string }>;
  updateStockItem: (id: string, updates: Partial<StockItem>, user?: string, reason?: string) => Promise<void>;
  adjustStock: (id: string, change: number, user: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  reserveStock: (id: string, quantity: number, user: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  releaseStock: (id: string, quantity: number, user: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  archiveStock: (id: string, user: string) => Promise<void>;
  
  // Stock Requests
  addStockRequest: (req: Omit<StockRequest, 'id' | 'status' | 'requestedDate'>) => Promise<void>;
  updateStockRequestStatus: (reqId: string, status: RequestStatus, user: string, reason?: string, partialQty?: number) => Promise<{ success: boolean; error?: string }>;

  // Dealer Dispatch & Stock Management
  dispatchStockToDealer: (dealer: string, items: StockDispatchItem[], notes?: string, waybill?: string, user?: string) => Promise<{ success: boolean; error?: string }>;
  confirmDealerDispatch: (dispatchId: string, dealerName: string, confirmedBy?: string) => Promise<{ success: boolean; error?: string }>;
  rejectDealerDispatch: (dispatchId: string, dealerName: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  deductDealerStockForLeadMaterial: (leadId: string, customerName: string, dealer: string, specs: DealerProjectSpecifications, approvedBy: string) => Promise<{ success: boolean; error?: string; deductedSummary?: string }>;

  // Summaries
  totalItems: number;
  availableUnits: number;
  reservedUnits: number;
  lowStockCount: number;
  criticalCount: number;
  outOfStockCount: number;
  categorySummary: Record<string, { val: number; max: number; warn: boolean; status: StockStatus; count: number; reserved: number }>;

  // Helpers
  getDealerStock: (dealerName: string) => DealerStockItem[];
  getDealerPendingDispatchesCount: (dealerName: string) => number;
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

// Standard seed items for central warehouse
const DEFAULT_STOCK_ITEMS: Omit<StockItem, 'id' | 'status' | 'updatedAt' | 'history' | 'archived'>[] = [
  { sku: 'SP-540W', name: '540 Wp Monocrystalline Panels', category: 'Solar Panels', totalQuantity: 300, reservedQuantity: 0, unit: 'Units', minimumStock: 50, maxStock: 500, warehouseLocation: 'Zone A - Bay 1', notes: 'High efficiency Mono PERC' },
  { sku: 'SP-550W', name: '550 Wp Monocrystalline Panels', category: 'Solar Panels', totalQuantity: 250, reservedQuantity: 0, unit: 'Units', minimumStock: 40, maxStock: 400, warehouseLocation: 'Zone A - Bay 2', notes: 'Standard 550W Module' },
  { sku: 'SP-610W', name: '610 Wp Bifacial TopCon Panels', category: 'Solar Panels', totalQuantity: 200, reservedQuantity: 0, unit: 'Units', minimumStock: 30, maxStock: 350, warehouseLocation: 'Zone A - Bay 3', notes: 'Dual glass Bifacial' },
  { sku: 'STR-PIPE-10FT', name: '10-Feet GI Structure Pipes', category: 'Structure & Mounting', totalQuantity: 450, reservedQuantity: 0, unit: 'Units', minimumStock: 80, maxStock: 600, warehouseLocation: 'Zone B - Rack 1', notes: 'Heavy GI class B' },
  { sku: 'STR-COMP-STD', name: 'Standard Company Structure Set', category: 'Structure & Mounting', totalQuantity: 80, reservedQuantity: 0, unit: 'Sets', minimumStock: 15, maxStock: 100, warehouseLocation: 'Zone B - Rack 2', notes: 'Pre-fabricated' },
  { sku: 'BEND-LONG-L', name: 'Long "L" Bends', category: 'Fittings & Bends', totalQuantity: 600, reservedQuantity: 0, unit: 'Pcs', minimumStock: 100, maxStock: 1000, warehouseLocation: 'Zone C - Bin 1', notes: 'GI 90 deg long' },
  { sku: 'BEND-SHORT-L', name: 'Short "L" Bends', category: 'Fittings & Bends', totalQuantity: 550, reservedQuantity: 0, unit: 'Pcs', minimumStock: 100, maxStock: 1000, warehouseLocation: 'Zone C - Bin 2', notes: 'GI 90 deg short' },
  { sku: 'BEND-T', name: '"T" Bends', category: 'Fittings & Bends', totalQuantity: 500, reservedQuantity: 0, unit: 'Pcs', minimumStock: 80, maxStock: 800, warehouseLocation: 'Zone C - Bin 3', notes: 'GI 3-way T connector' },
  { sku: 'CONN-STR-JNT', name: 'Straight Joint Connectors', category: 'Fittings & Bends', totalQuantity: 800, reservedQuantity: 0, unit: 'Pcs', minimumStock: 150, maxStock: 1200, warehouseLocation: 'Zone C - Bin 4', notes: 'GI Couplers' },
  { sku: 'CBL-DC-RED', name: 'DC Cable (RED) 4 sqmm', category: 'DC Cables', totalQuantity: 2500, reservedQuantity: 0, unit: 'Meters', minimumStock: 500, maxStock: 5000, warehouseLocation: 'Zone D - Spool 1', notes: 'Solar UV resistant' },
  { sku: 'CBL-DC-BLK', name: 'DC Cable (BLACK) 4 sqmm', category: 'DC Cables', totalQuantity: 2500, reservedQuantity: 0, unit: 'Meters', minimumStock: 500, maxStock: 5000, warehouseLocation: 'Zone D - Spool 2', notes: 'Solar UV resistant' },
  { sku: 'CBL-AC-RED', name: 'AC Cable (RED) 6 sqmm', category: 'AC Cables', totalQuantity: 1800, reservedQuantity: 0, unit: 'Meters', minimumStock: 300, maxStock: 3000, warehouseLocation: 'Zone D - Spool 3', notes: 'Copper multi-strand' },
  { sku: 'CBL-AC-BLK', name: 'AC Cable (BLACK) 6 sqmm', category: 'AC Cables', totalQuantity: 1800, reservedQuantity: 0, unit: 'Meters', minimumStock: 300, maxStock: 3000, warehouseLocation: 'Zone D - Spool 4', notes: 'Copper multi-strand' },
  { sku: 'CBL-GRN-EARTH', name: 'Green Earthing Wire', category: 'Earthing & Safety', totalQuantity: 2000, reservedQuantity: 0, unit: 'Meters', minimumStock: 400, maxStock: 3500, warehouseLocation: 'Zone D - Spool 5', notes: 'Pure copper grounding' },
  { sku: 'SAF-LA-STAND', name: 'Lightning Arrester & Iron Stand', category: 'Earthing & Safety', totalQuantity: 95, reservedQuantity: 0, unit: 'Sets', minimumStock: 20, maxStock: 150, warehouseLocation: 'Zone E - Bay 1', notes: 'Copper spike with stand' },
  { sku: 'INV-1PH-3KW', name: '3 kW Single Phase Inverter', category: 'Inverters', totalQuantity: 40, reservedQuantity: 0, unit: 'Units', minimumStock: 10, maxStock: 80, warehouseLocation: 'Zone F - High Security', notes: 'Grid-tied with WiFi' },
  { sku: 'INV-3PH-5KW', name: '5 kW Three Phase Inverter', category: 'Inverters', totalQuantity: 30, reservedQuantity: 0, unit: 'Units', minimumStock: 8, maxStock: 60, warehouseLocation: 'Zone F - High Security', notes: 'Dual MPPT' }
];

const StockContext = createContext<StockContextType | undefined>(undefined);

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [dealerStockList, setDealerStockList] = useState<DealerStockItem[]>([]);
  const [stockDispatches, setStockDispatches] = useState<StockDispatch[]>([]);
  const [materialConsumptions, setMaterialConsumptions] = useState<MaterialConsumptionRecord[]>([]);

  useEffect(() => {
    // 1. Central Inventory listener
    const unsubscribeItems = onSnapshot(collection(db, 'inventory'), async (snapshot) => {
      if (snapshot.empty) {
        // Seed default items if collection is empty
        for (const itm of DEFAULT_STOCK_ITEMS) {
          const newId = `ST_${itm.sku}`;
          const initialItem: StockItem = {
            ...itm,
            id: newId,
            status: calculateStatus(itm.totalQuantity, itm.minimumStock, itm.maxStock),
            updatedAt: 'Initialized',
            archived: false,
            history: [{
              id: generateId(),
              date: new Date().toLocaleDateString(),
              action: 'Initial Stock',
              quantityChange: itm.totalQuantity,
              before: 0,
              after: itm.totalQuantity,
              user: 'System Admin',
              reason: 'Central warehouse initialization'
            }]
          };
          try {
            await setDoc(doc(db, 'inventory', newId), initialItem);
          } catch {}
        }
      } else {
        const items: StockItem[] = [];
        snapshot.forEach(docSnap => {
          items.push({ id: docSnap.id, ...docSnap.data() } as StockItem);
        });
        setStockItems(items);
      }
    });

    // 2. Stock Requests listener
    const unsubscribeRequests = onSnapshot(collection(db, 'stockRequests'), (snapshot) => {
      const requests: StockRequest[] = [];
      snapshot.forEach(docSnap => {
        requests.push({ id: docSnap.id, ...docSnap.data() } as StockRequest);
      });
      setStockRequests(requests);
    });

    // 3. Dealer Stock listener
    const unsubscribeDealerStock = onSnapshot(collection(db, 'dealerStock'), (snapshot) => {
      const dItems: DealerStockItem[] = [];
      snapshot.forEach(docSnap => {
        dItems.push({ id: docSnap.id, ...docSnap.data() } as DealerStockItem);
      });
      setDealerStockList(dItems);
    });

    // 4. Stock Dispatches listener
    const unsubscribeDispatches = onSnapshot(collection(db, 'stockDispatches'), (snapshot) => {
      const dispatches: StockDispatch[] = [];
      snapshot.forEach(docSnap => {
        dispatches.push({ id: docSnap.id, ...docSnap.data() } as StockDispatch);
      });
      // Sort newest first
      dispatches.sort((a, b) => new Date(b.dispatchedAt || 0).getTime() - new Date(a.dispatchedAt || 0).getTime());
      setStockDispatches(dispatches);
    });

    // 5. Material Consumptions listener
    const unsubscribeConsumptions = onSnapshot(collection(db, 'materialConsumptions'), (snapshot) => {
      const records: MaterialConsumptionRecord[] = [];
      snapshot.forEach(docSnap => {
        records.push({ id: docSnap.id, ...docSnap.data() } as MaterialConsumptionRecord);
      });
      records.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setMaterialConsumptions(records);
    });

    return () => {
      unsubscribeItems();
      unsubscribeRequests();
      unsubscribeDealerStock();
      unsubscribeDispatches();
      unsubscribeConsumptions();
    };
  }, []);

  const addStockItem = async (item: Omit<StockItem, 'id' | 'status' | 'updatedAt' | 'history' | 'archived'>) => {
    if (stockItems.some(i => i.sku === item.sku && !i.archived)) {
      return { success: false, error: 'SKU already exists.' };
    }
    
    const available = item.totalQuantity - item.reservedQuantity;
    const newItemId = `ST_${item.sku || Date.now()}`;
    const newItem: StockItem = {
      ...item,
      id: newItemId,
      status: calculateStatus(available, item.minimumStock, item.maxStock),
      updatedAt: 'Just now',
      archived: false,
      history: [{
        id: generateId(),
        date: new Date().toLocaleDateString(),
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
         date: new Date().toLocaleDateString(),
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
        date: new Date().toLocaleDateString(),
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
        date: new Date().toLocaleDateString(),
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
      requestedDate: new Date().toLocaleDateString(),
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
           date: new Date().toLocaleDateString(),
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

  // --- 🚚 1. Admin Bulk Stock Dispatch to Dealer ---
  const dispatchStockToDealer = async (
    dealer: string, 
    items: StockDispatchItem[], 
    notes?: string, 
    waybill?: string, 
    user = 'Admin'
  ) => {
    if (!dealer || items.length === 0) {
      return { success: false, error: 'Please select a dealer and at least one item to dispatch.' };
    }

    // Verify warehouse stock availability
    for (const dItem of items) {
      const warehouseItem = stockItems.find(i => i.sku === dItem.sku && !i.archived);
      if (!warehouseItem) {
        return { success: false, error: `Item ${dItem.name} (${dItem.sku}) not found in warehouse.` };
      }
      const available = warehouseItem.totalQuantity - warehouseItem.reservedQuantity;
      if (dItem.quantity > available) {
        return { success: false, error: `Insufficient stock for ${dItem.name}. Available: ${available} ${dItem.unit}.` };
      }
    }

    // Deduct stock from central warehouse
    for (const dItem of items) {
      const warehouseItem = stockItems.find(i => i.sku === dItem.sku && !i.archived)!;
      const newTotal = warehouseItem.totalQuantity - dItem.quantity;
      const newAvailable = newTotal - warehouseItem.reservedQuantity;
      const updatedItem: StockItem = {
        ...warehouseItem,
        totalQuantity: newTotal,
        status: calculateStatus(newAvailable, warehouseItem.minimumStock, warehouseItem.maxStock),
        updatedAt: 'Just now',
        history: [{
          id: generateId(),
          date: new Date().toLocaleDateString(),
          action: 'Dispatched to Dealer',
          quantityChange: -dItem.quantity,
          before: warehouseItem.totalQuantity,
          after: newTotal,
          user,
          reason: `Dispatched to ${dealer} (Waybill: ${waybill || 'N/A'})`
        }, ...warehouseItem.history]
      };
      try {
        await updateDoc(doc(db, 'inventory', warehouseItem.id), updatedItem as any);
      } catch (err: any) {
        return { success: false, error: `Failed to deduct warehouse stock: ${err.message}` };
      }
    }

    // Create Dispatch Record with Pending Dealer Confirmation
    const dispatchId = `DSP-${Date.now().toString().slice(-6)}`;
    const newDispatch: StockDispatch = {
      id: dispatchId,
      dealer,
      dispatchedBy: user,
      dispatchedAt: new Date().toLocaleString(),
      waybillOrNote: waybill,
      items,
      status: 'Pending Dealer Confirmation',
      notes
    };

    try {
      await setDoc(doc(db, 'stockDispatches', dispatchId), newDispatch);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // --- 📦 2. Dealer Confirms / Accepts Stock Receipt ---
  const confirmDealerDispatch = async (dispatchId: string, dealerName: string, confirmedBy?: string) => {
    const dispatch = stockDispatches.find(d => d.id === dispatchId);
    if (!dispatch) {
      return { success: false, error: 'Dispatch record not found.' };
    }
    if (dispatch.status !== 'Pending Dealer Confirmation') {
      return { success: false, error: `This dispatch is already ${dispatch.status}.` };
    }

    // Add / increment each item in the dealer's stock ledger
    for (const item of dispatch.items) {
      const dealerDocId = `${dealerName}_${item.sku}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const existingDealerItem = dealerStockList.find(d => d.id === dealerDocId || (d.dealer === dealerName && d.itemSku === item.sku));
      
      const currentQty = existingDealerItem ? existingDealerItem.quantity : 0;
      const newQty = currentQty + item.quantity;

      const updatedDealerItem: DealerStockItem = {
        id: dealerDocId,
        dealer: dealerName,
        itemSku: item.sku,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        quantity: newQty,
        lastUpdatedAt: new Date().toLocaleString()
      };

      try {
        await setDoc(doc(db, 'dealerStock', dealerDocId), updatedDealerItem);
      } catch (err: any) {
        return { success: false, error: `Failed to update dealer inventory: ${err.message}` };
      }
    }

    // Mark dispatch as Confirmed / Delivered
    try {
      await updateDoc(doc(db, 'stockDispatches', dispatchId), {
        status: 'Confirmed / Delivered',
        acceptedAt: new Date().toLocaleString(),
        acceptedBy: confirmedBy || dealerName
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // --- ❌ 3. Dealer Rejects Dispatch ---
  const rejectDealerDispatch = async (dispatchId: string, dealerName: string, reason: string) => {
    const dispatch = stockDispatches.find(d => d.id === dispatchId);
    if (!dispatch) return { success: false, error: 'Dispatch record not found.' };

    // Return stock back to central warehouse
    for (const item of dispatch.items) {
      const warehouseItem = stockItems.find(i => i.sku === item.sku && !i.archived);
      if (warehouseItem) {
        const newTotal = warehouseItem.totalQuantity + item.quantity;
        const newAvailable = newTotal - warehouseItem.reservedQuantity;
        await updateDoc(doc(db, 'inventory', warehouseItem.id), {
          totalQuantity: newTotal,
          status: calculateStatus(newAvailable, warehouseItem.minimumStock, warehouseItem.maxStock),
          updatedAt: 'Just now',
          history: [{
            id: generateId(),
            date: new Date().toLocaleDateString(),
            action: 'Dispatch Rejected & Restored',
            quantityChange: item.quantity,
            before: warehouseItem.totalQuantity,
            after: newTotal,
            user: dealerName,
            reason: `Dispatch ${dispatchId} rejected: ${reason}`
          }, ...warehouseItem.history]
        });
      }
    }

    try {
      await updateDoc(doc(db, 'stockDispatches', dispatchId), {
        status: 'Rejected',
        rejectionReason: reason,
        acceptedAt: new Date().toLocaleString(),
        acceptedBy: dealerName
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // --- ⚡ 4. Automatic Stock Deduction when Lead Material / Installation is Approved ---
  const deductDealerStockForLeadMaterial = async (
    leadId: string, 
    customerName: string, 
    dealer: string, 
    specs: DealerProjectSpecifications, 
    approvedBy = 'Admin'
  ) => {
    if (!dealer) return { success: true };

    const itemsToDeduct: { itemSku: string; itemName: string; quantity: number; unit: string }[] = [];

    // 1. Panels deduction (determine SKU or fallback)
    const panelWpText = specs.panelWp || '';
    let panelSku = 'SP-540W';
    let panelName = '540 Wp Monocrystalline Panels';
    if (panelWpText.includes('550')) {
      panelSku = 'SP-550W';
      panelName = '550 Wp Monocrystalline Panels';
    } else if (panelWpText.includes('610') || panelWpText.includes('Bifacial') || panelWpText.includes('TopCon')) {
      panelSku = 'SP-610W';
      panelName = '610 Wp Bifacial TopCon Panels';
    }

    // Estimate panels count based on system capacity or default ~6-10 panels for 3kW-5kW
    const capacityKw = parseFloat(specs.systemCapacityKw || '3') || 3;
    const panelWatt = panelSku === 'SP-610W' ? 610 : panelSku === 'SP-550W' ? 550 : 540;
    const estimatedPanelsCount = Math.max(1, Math.round((capacityKw * 1000) / panelWatt));
    itemsToDeduct.push({ itemSku: panelSku, itemName: panelName, quantity: estimatedPanelsCount, unit: 'Units' });

    // 2. 10-Feet Structure Pipes
    const pipes = parseInt(specs.pipes10FeetCount || '0') || 0;
    if (pipes > 0) {
      itemsToDeduct.push({ itemSku: 'STR-PIPE-10FT', itemName: '10-Feet GI Structure Pipes', quantity: pipes, unit: 'Units' });
    }

    // 3. Long "L" Bends
    const longL = parseInt(specs.longLBendsCount || '0') || 0;
    if (longL > 0) {
      itemsToDeduct.push({ itemSku: 'BEND-LONG-L', itemName: 'Long "L" Bends', quantity: longL, unit: 'Pcs' });
    }

    // 4. Short "L" Bends
    const shortL = parseInt(specs.shortLBendsCount || '0') || 0;
    if (shortL > 0) {
      itemsToDeduct.push({ itemSku: 'BEND-SHORT-L', itemName: 'Short "L" Bends', quantity: shortL, unit: 'Pcs' });
    }

    // 5. "T" Bends
    const tBends = parseInt(specs.tBendsCount || '0') || 0;
    if (tBends > 0) {
      itemsToDeduct.push({ itemSku: 'BEND-T', itemName: '"T" Bends', quantity: tBends, unit: 'Pcs' });
    }

    // 6. Straight Joint Connectors
    const straightJoints = parseInt(specs.straightJointConnectorsCount || '0') || 0;
    if (straightJoints > 0) {
      itemsToDeduct.push({ itemSku: 'CONN-STR-JNT', itemName: 'Straight Joint Connectors', quantity: straightJoints, unit: 'Pcs' });
    }

    // 7. DC Red Wire (Meters)
    const dcRed = parseInt(specs.dcRedWireLength || '0') || 0;
    if (dcRed > 0) {
      itemsToDeduct.push({ itemSku: 'CBL-DC-RED', itemName: 'DC Cable (RED) 4 sqmm', quantity: dcRed, unit: 'Meters' });
    }

    // 8. DC Black Wire (Meters)
    const dcBlack = parseInt(specs.dcBlackWireLength || '0') || 0;
    if (dcBlack > 0) {
      itemsToDeduct.push({ itemSku: 'CBL-DC-BLK', itemName: 'DC Cable (BLACK) 4 sqmm', quantity: dcBlack, unit: 'Meters' });
    }

    // 9. AC Red Wire (Meters)
    const acRed = parseInt(specs.acRedWireLength || '0') || 0;
    if (acRed > 0) {
      itemsToDeduct.push({ itemSku: 'CBL-AC-RED', itemName: 'AC Cable (RED) 6 sqmm', quantity: acRed, unit: 'Meters' });
    }

    // 10. AC Black Wire (Meters)
    const acBlack = parseInt(specs.acBlackWireLength || '0') || 0;
    if (acBlack > 0) {
      itemsToDeduct.push({ itemSku: 'CBL-AC-BLK', itemName: 'AC Cable (BLACK) 6 sqmm', quantity: acBlack, unit: 'Meters' });
    }

    // 11. Green Earthing Wire (Meters)
    const greenWire = parseInt(specs.greenWireLength || '0') || 0;
    if (greenWire > 0) {
      itemsToDeduct.push({ itemSku: 'CBL-GRN-EARTH', itemName: 'Green Earthing Wire', quantity: greenWire, unit: 'Meters' });
    }

    // 12. Lightning Arrester
    if (specs.lightningArresterStand === 'Yes') {
      itemsToDeduct.push({ itemSku: 'SAF-LA-STAND', itemName: 'Lightning Arrester & Iron Stand', quantity: 1, unit: 'Sets' });
    }

    if (itemsToDeduct.length === 0) {
      return { success: true, deductedSummary: 'No material quantities specified' };
    }

    // Execute deduction from dealer stock
    for (const dItem of itemsToDeduct) {
      const dealerDocId = `${dealer}_${dItem.itemSku}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const existing = dealerStockList.find(d => d.id === dealerDocId || (d.dealer === dealer && d.itemSku === dItem.itemSku));
      const currentQty = existing ? existing.quantity : 0;
      const newQty = Math.max(0, currentQty - dItem.quantity);

      const updatedDealerItem: DealerStockItem = {
        id: dealerDocId,
        dealer,
        itemSku: dItem.itemSku,
        itemName: dItem.itemName,
        category: existing?.category || 'General Material',
        unit: dItem.unit,
        quantity: newQty,
        lastUpdatedAt: new Date().toLocaleString()
      };

      try {
        await setDoc(doc(db, 'dealerStock', dealerDocId), updatedDealerItem);
      } catch (err) {
        console.error('Failed to deduct item from dealer stock:', err);
      }
    }

    // Save Material Consumption Record
    const consumptionId = `MTR-${Date.now().toString().slice(-6)}`;
    const consumptionRecord: MaterialConsumptionRecord = {
      id: consumptionId,
      leadId,
      customerName,
      dealer,
      approvedBy,
      date: new Date().toLocaleString(),
      itemsDeducted: itemsToDeduct,
      notes: `Materials automatically deducted upon Material/Installation stage approval for ${customerName}`
    };

    try {
      await setDoc(doc(db, 'materialConsumptions', consumptionId), consumptionRecord);
    } catch (err) {
      console.error('Failed to log material consumption:', err);
    }

    const deductedSummary = itemsToDeduct.map(i => `${i.quantity} ${i.unit} ${i.itemName}`).join(', ');
    return { success: true, deductedSummary };
  };

  // Helper getters
  const getDealerStock = (dealerName: string) => {
    return dealerStockList.filter(d => d.dealer === dealerName);
  };

  const getDealerPendingDispatchesCount = (dealerName: string) => {
    return stockDispatches.filter(d => d.dealer === dealerName && d.status === 'Pending Dealer Confirmation').length;
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
      dealerStockList,
      stockDispatches,
      materialConsumptions,
      addStockItem,
      updateStockItem,
      adjustStock,
      reserveStock,
      releaseStock,
      archiveStock,
      addStockRequest,
      updateStockRequestStatus,
      dispatchStockToDealer,
      confirmDealerDispatch,
      rejectDealerDispatch,
      deductDealerStockForLeadMaterial,
      getDealerStock,
      getDealerPendingDispatchesCount,
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
