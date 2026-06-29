import { createStockEntry } from './stockService';

const storageKey = 'erp-purchase-ledger';

const readLedger = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  const serialized = window.localStorage.getItem(storageKey);
  if (!serialized) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLedger = (records) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(records));
};

export const loadPurchaseRecords = () => readLedger();

export const savePurchaseRecords = (records) => {
  writeLedger(records);
  return records;
};

export const clearPurchaseRecords = () => savePurchaseRecords([]);

export const buildEmptyPurchaseLine = () => ({
  productId: '',
  productName: '',
  quantity: 1,
  purchasePrice: '',
});

export const buildEmptyPurchaseForm = () => ({
  sellerName: '',
  gstNumber: '',
  phone: '',
  invoiceNumber: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  paymentStatus: 'Pending',
  paymentMethod: 'Cash',
  notes: '',
  invoiceFileName: '',
  lines: [buildEmptyPurchaseLine()],
});

export const calculatePurchaseTotal = (lines = []) => lines.reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.purchasePrice || 0)), 0);

export const buildPurchaseStats = (records = []) => {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const todayPurchases = records.filter((item) => String(item.purchaseDate || '').slice(0, 10) === today);
  const monthPurchases = records.filter((item) => String(item.purchaseDate || '').slice(0, 7) === thisMonth);
  const pending = records.filter((item) => item.paymentStatus !== 'Paid');
  const totalCost = records.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

  const supplierTotals = records.reduce((acc, item) => {
    const key = item.sellerName || 'Unknown';
    acc[key] = (acc[key] || 0) + Number(item.totalAmount || 0);
    return acc;
  }, {});

  const productTotals = records.flatMap((item) => item.lines || []).reduce((acc, line) => {
    const key = line.productName || line.productId || 'Product';
    acc[key] = (acc[key] || 0) + Number(line.quantity || 0);
    return acc;
  }, {});

  return {
    todayPurchases: todayPurchases.length,
    monthPurchases: monthPurchases.length,
    pendingCount: pending.length,
    totalCost,
    topSuppliers: Object.entries(supplierTotals).sort((left, right) => right[1] - left[1]).slice(0, 3),
    mostPurchasedProduct: Object.entries(productTotals).sort((left, right) => right[1] - left[1])[0],
  };
};

export const filterPurchaseRecords = (records = [], { searchTerm = '', sellerFilter = '', dateFilter = '', statusFilter = 'all' } = {}) => {
  return records.filter((item) => {
    const candidate = [item.sellerName, item.gstNumber, item.phone, item.invoiceNumber, item.notes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (searchTerm.trim() && !candidate.includes(searchTerm.trim().toLowerCase())) {
      return false;
    }

    if (sellerFilter.trim() && !String(item.sellerName || '').toLowerCase().includes(sellerFilter.trim().toLowerCase())) {
      return false;
    }

    if (dateFilter && String(item.purchaseDate || '').slice(0, 10) !== dateFilter) {
      return false;
    }

    if (statusFilter !== 'all' && String(item.paymentStatus || '').toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }

    return true;
  });
};

export const createPurchaseRecord = async ({ form, userRole = 'staff', stockUpdater = createStockEntry }) => {
  const validLines = (form.lines || []).filter((line) => line.productId && Number(line.quantity) > 0);
  if (validLines.length === 0) {
    throw new Error('Add at least one purchase item.');
  }

  const totalAmount = calculatePurchaseTotal(validLines);
  const record = {
    id: Date.now(),
    ...form,
    lines: validLines,
    totalAmount,
    createdBy: userRole === 'admin' ? 'Admin' : 'Staff',
    createdAt: new Date().toISOString(),
  };

  await Promise.all(validLines.map((line) => stockUpdater({
    product_id: String(line.productId),
    units: Number(line.quantity),
    notes: `Purchase ${record.invoiceNumber || record.id} from ${record.sellerName}`,
  })));

  const nextRecords = [record, ...readLedger()];
  writeLedger(nextRecords);
  return record;
};

export const deletePurchaseRecord = (purchaseId) => {
  const nextRecords = readLedger().filter((item) => String(item.id) !== String(purchaseId));
  writeLedger(nextRecords);
  return nextRecords;
};
