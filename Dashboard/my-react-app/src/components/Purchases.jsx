import { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineArrowDownTray,
  HiOutlineCalendarDays,
  HiOutlineDocumentText,
  HiOutlinePencilSquare,
  HiOutlinePrinter,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineUserCircle,
} from 'react-icons/hi2';
import AppCard from './common/AppCard';
import EmptyState from './common/EmptyState';
import LoadingSpinner from './common/LoadingSpinner';
import PageHeader from './common/PageHeader';
import PageContainer from './common/PageContainer';
import ExportMenu from './common/ExportMenu';
import ToolbarButton from './common/ToolbarButton';
import StatCard from './common/StatCard';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';
import { fetchProducts } from '../services/productService';
import { downloadPdfFromHtml, escapeHtml } from '../utils/invoiceUtils';
import {
  buildEmptyPurchaseForm,
  buildEmptyPurchaseLine,
  buildPurchaseStats,
  clearPurchaseRecords,
  createPurchaseRecord,
  deletePurchaseRecord,
  filterPurchaseRecords,
  loadPurchaseRecords,
} from '../services/purchaseService';

const Purchases = ({ userRole, session }) => {
  const [purchases, setPurchases] = useState(() => loadPurchaseRecords());
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(buildEmptyPurchaseForm);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activePurchaseId, setActivePurchaseId] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const currentUserName = session?.name || 'Unknown User';

  const toggleSection = (section) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  const resolveDisplayName = (value) => {
    const text = String(value || '').trim();
    if (!text || /^\d+$/.test(text)) {
      return 'Unknown User';
    }
    return text;
  };

  const downloadFile = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setLoading(true);
      try {
        const response = await fetchProducts(1, 100);
        if (!cancelled) {
          const payload = response.data?.data || response.data?.products || response.data || [];
          setProducts(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => buildPurchaseStats(purchases), [purchases]);

  const filteredPurchases = useMemo(() => filterPurchaseRecords(purchases, {
    searchTerm,
    sellerFilter,
    dateFilter,
    statusFilter,
  }), [dateFilter, purchases, searchTerm, sellerFilter, statusFilter]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const updateLine = (index, patch) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  };

  const addLine = () => setForm((current) => ({ ...current, lines: [...current.lines, buildEmptyPurchaseLine()] }));
  const removeLine = (index) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.length === 1 ? current.lines : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const applyProductChoice = (index, productId) => {
    const selected = products.find((product) => String(product.id) === String(productId));
    updateLine(index, {
      productId,
      productName: selected?.name || '',
      purchasePrice: selected?.price || '',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.sellerName.trim()) {
      notify('Seller name is required.', 'danger');
      return;
    }

    try {
      const record = await createPurchaseRecord({ form, userRole });
      record.handledByName = currentUserName;
      setPurchases((current) => [record, ...current]);
      setActivePurchaseId(String(record.id));
      setForm(buildEmptyPurchaseForm());
      notify('Purchase saved and stock updated.', 'success');
    } catch (error) {
      notify(error.response?.data?.message || 'Unable to save purchase.', 'danger');
    }
  };

  const handleDelete = (purchaseId) => {
    setPurchases(deletePurchaseRecord(purchaseId));
    notify('Purchase deleted.', 'success');
  };

  const handleClearAll = () => {
    clearPurchaseRecords();
    setPurchases([]);
    notify('Purchase history cleared.', 'success');
  };

  const handleExportCsv = () => {
    const headers = ['Seller', 'Invoice', 'Date', 'Total Amount', 'Payment Status', 'Payment Method', 'Notes', 'Handled By'];
    const rows = filteredPurchases.map((item) => [
      item.sellerName,
      item.invoiceNumber,
      item.purchaseDate,
      Number(item.totalAmount || 0).toFixed(2),
      item.paymentStatus,
      item.paymentMethod,
      item.notes || '',
      resolveDisplayName(item.handledByName || item.createdByName || item.createdBy),
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile('purchases.csv', csvContent, 'text/csv;charset=utf-8;');
  };

  const handleExportPdf = async () => {
    const rows = filteredPurchases.map((item) => `
      <tr>
        <td>${escapeHtml(item.sellerName)}</td>
        <td>${escapeHtml(item.invoiceNumber)}</td>
        <td>${escapeHtml(item.purchaseDate)}</td>
        <td>${formatINR(item.totalAmount)}</td>
        <td>${escapeHtml(item.paymentStatus)}</td>
        <td>${escapeHtml(item.paymentMethod)}</td>
        <td>${escapeHtml(resolveDisplayName(item.handledByName || item.createdByName || item.createdBy))}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Purchases</title><style>body{font-family:Arial,sans-serif;padding:24px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;}</style></head><body><div data-invoice-root><h2>Purchases Export</h2><table><thead><tr><th>Seller</th><th>Invoice</th><th>Date</th><th>Total</th><th>Status</th><th>Method</th><th>Handled By</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
    await downloadPdfFromHtml(html, 'purchases.pdf');
  };

  const handlePrintPurchase = (purchase) => {
    const win = window.open('', '_blank', 'width=1200,height=1600');
    if (!win) return;
    const items = (purchase.lines || []).map((line) => `<li>${escapeHtml(line.productName)} x ${escapeHtml(line.quantity)} = ${formatINR(Number(line.quantity || 0) * Number(line.purchasePrice || 0))}</li>`).join('');
    win.document.write(`<!doctype html><html><head><title>Purchase ${escapeHtml(purchase.invoiceNumber || purchase.id)}</title><style>body{font-family:Arial,sans-serif;padding:24px;} .card{border:1px solid #cbd5e1;border-radius:16px;padding:20px;max-width:820px;margin:0 auto;} ul{padding-left:20px;}</style></head><body><div class="card"><h2>Purchase ${escapeHtml(purchase.invoiceNumber || purchase.id)}</h2><p><strong>Seller:</strong> ${escapeHtml(purchase.sellerName)}</p><p><strong>Date:</strong> ${escapeHtml(purchase.purchaseDate)}</p><p><strong>Total:</strong> ${formatINR(purchase.totalAmount)}</p><ul>${items}</ul></div></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const exportMenuItems = [
    {
      label: 'CSV',
      icon: <HiOutlineArrowDownTray />,
      onClick: () => {
        setShowExportMenu(false);
        handleExportCsv();
      },
    },
    {
      label: 'PDF',
      icon: <HiOutlineDocumentText />,
      onClick: () => {
        setShowExportMenu(false);
        handleExportPdf();
      },
    },
    {
      label: 'Clear history',
      icon: <HiOutlineTrash />,
      variant: 'danger',
      onClick: () => {
        setShowExportMenu(false);
        handleClearAll();
      },
    },
  ];

  return (
    <PageContainer className="mt-4 purchase-page-shell">
      <PageHeader
        kicker="Purchases"
        title="Purchase management"
        description="Record inventory buys, update stock automatically, and keep supplier spending in one mobile-first workspace."
        actions={(
          <div className="purchase-header-actions">
            <ExportMenu
              open={showExportMenu}
              onToggle={setShowExportMenu}
              label="Export purchases"
              items={exportMenuItems}
              className="purchase-export-menu"
            />
          </div>
        )}
      />

      <AppCard
        className="mt-4 purchase-reports-card"
        title="Reports"
        subtitle="Today's spending, this month, pending purchases, and total supplier cost."
        collapsible
        open={openSection === 'reports'}
        onToggle={() => toggleSection('reports')}
        defaultOpen={false}
      >
        <div className="purchase-stats-grid">
          {[
            ['Today', stats.todayPurchases],
            ['This Month', stats.monthPurchases],
            ['Pending', stats.pendingCount],
            ['Total Cost', formatINR(stats.totalCost)],
          ].map(([label, value]) => (
            <StatCard key={label} label={label} value={value} className="purchase-stat-card" />
          ))}
        </div>
      </AppCard>

      <AppCard
        className="mt-4 purchase-toolbar-card"
        title="Controls"
        subtitle="Search, filter, and export purchase records."
        collapsible
        open={openSection === 'controls'}
        onToggle={() => toggleSection('controls')}
        defaultOpen={false}
      >
        <div className="toolbar-actions toolbar-actions-main purchase-toolbar-grid">
          <input
            className="form-control toolbar-input purchase-search-input"
            placeholder="Search purchases..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <input className="form-control toolbar-input" placeholder="Filter by seller" value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)} />
          <select className="form-select toolbar-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
          </select>
          <input className="form-control toolbar-input" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          <ToolbarButton icon={<HiOutlinePlus />} variant="secondary" onClick={() => setForm(buildEmptyPurchaseForm())} label="New Purchase">New Purchase</ToolbarButton>
          <ToolbarButton icon={<HiOutlineArrowDownTray />} onClick={() => setPurchases(loadPurchaseRecords())} label="Refresh purchases">Refresh</ToolbarButton>
        </div>
      </AppCard>

      <div className="row g-4 mt-4">
        <div className="col-12 col-xl-5">
          <AppCard title="New Purchase" subtitle="Record incoming stock, supplier payment details, and invoice data." className="purchase-form-card" collapsible>
            <form className="d-grid gap-3 purchase-form" onSubmit={handleSubmit}>
              <div className="purchase-form-grid">
                <label>
                  <span>Seller Name</span>
                  <input className="form-control" value={form.sellerName} onChange={(event) => updateForm({ sellerName: event.target.value })} />
                </label>
                <label>
                  <span>GST Number</span>
                  <input className="form-control" value={form.gstNumber} onChange={(event) => updateForm({ gstNumber: event.target.value })} placeholder="Optional" />
                </label>
                <label>
                  <span>Phone</span>
                  <input className="form-control" value={form.phone} onChange={(event) => updateForm({ phone: event.target.value })} />
                </label>
                <label>
                  <span>Invoice Number</span>
                  <input className="form-control" value={form.invoiceNumber} onChange={(event) => updateForm({ invoiceNumber: event.target.value })} />
                </label>
                <label>
                  <span>Purchase Date</span>
                  <input className="form-control" type="date" value={form.purchaseDate} onChange={(event) => updateForm({ purchaseDate: event.target.value })} />
                </label>
                <label>
                  <span>Payment Status</span>
                  <select className="form-select" value={form.paymentStatus} onChange={(event) => updateForm({ paymentStatus: event.target.value })}>
                    <option>Paid</option>
                    <option>Pending</option>
                    <option>Partial</option>
                  </select>
                </label>
                <label>
                  <span>Payment Method</span>
                  <select className="form-select" value={form.paymentMethod} onChange={(event) => updateForm({ paymentMethod: event.target.value })}>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>UPI</option>
                    <option>Card</option>
                  </select>
                </label>
                <label>
                  <span>Invoice Upload Name</span>
                  <input className="form-control" value={form.invoiceFileName} onChange={(event) => updateForm({ invoiceFileName: event.target.value })} placeholder="Optional" />
                </label>
              </div>

              <div className="purchase-lines">
                {form.lines.map((line, index) => (
                  <div key={`line-${index}`} className="purchase-line-card">
                    <div className="purchase-line-head">
                      <strong>Item {index + 1}</strong>
                      <ToolbarButton icon={<HiOutlineTrash />} iconOnly onClick={() => removeLine(index)} label="Remove purchase line" />
                    </div>
                    <div className="purchase-line-grid">
                      <label>
                        <span>Product</span>
                        <select className="form-select" value={line.productId} onChange={(event) => applyProductChoice(index, event.target.value)}>
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>{product.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Quantity</span>
                        <input className="form-control" type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                      </label>
                      <label>
                        <span>Purchase Price</span>
                        <input className="form-control" type="number" min="0" step="0.01" value={line.purchasePrice} onChange={(event) => updateLine(index, { purchasePrice: event.target.value })} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="purchase-line-footer">
                <ToolbarButton icon={<HiOutlinePlus />} variant="secondary" onClick={addLine} label="Add Item">Add Item</ToolbarButton>
                <div className="purchase-total-pill">Total {formatINR(form.lines.reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.purchasePrice || 0)), 0))}</div>
              </div>

              <label>
                <span>Notes</span>
                <textarea className="form-control" rows="3" value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} />
              </label>

              <button type="submit" className="btn btn-primary purchase-save-btn"><HiOutlinePlus /> Save Purchase</button>
            </form>
          </AppCard>
        </div>

        <div className="col-12 col-xl-7">
          <AppCard
            title="Purchase history"
            subtitle="View supplier spend, print purchase slips, and inspect outstanding records."
            className="purchase-history-card"
            collapsible
            open={openSection === 'history'}
            onToggle={() => toggleSection('history')}
            defaultOpen={false}
          >
            {loading ? (
              <LoadingSpinner className="mt-4" label="Loading purchases..." />
            ) : filteredPurchases.length === 0 ? (
              <EmptyState title="No purchases yet" description="Create the first purchase record to begin tracking supplier stock." />
            ) : (
              <div className="purchase-history-grid">
                {filteredPurchases.map((purchase) => (
                  <article key={purchase.id} className="purchase-history-item">
                    <div className="purchase-history-head">
                      <div>
                        <div className="purchase-history-kicker">{purchase.invoiceNumber || `#${purchase.id}`}</div>
                        <h3>{purchase.sellerName}</h3>
                        <p>{purchase.purchaseDate} · {purchase.paymentStatus}</p>
                      </div>
                      <div className="purchase-history-total">{formatINR(purchase.totalAmount)}</div>
                    </div>
                    <div className="purchase-history-meta">
                      <span><HiOutlineUserCircle /> {purchase.phone || 'No phone'}</span>
                      <span><HiOutlineCalendarDays /> {purchase.paymentMethod}</span>
                      <span><HiOutlineDocumentText /> {purchase.lines.length} items</span>
                      <span><HiOutlineUserCircle /> Handled by {resolveDisplayName(purchase.handledByName || purchase.createdByName || purchase.createdBy)}</span>
                    </div>
                    <div className="purchase-history-lines">
                      {purchase.lines.map((line) => (
                        <div key={`${purchase.id}-${line.productId}`} className="purchase-history-line">
                          <strong>{line.productName || 'Product'}</strong>
                          <span>{line.quantity} x {formatINR(line.purchasePrice)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="purchase-history-actions">
                      <ToolbarButton icon={<HiOutlinePrinter />} variant="secondary" compact onClick={() => handlePrintPurchase(purchase)} label="Print purchase">Print</ToolbarButton>
                      <ToolbarButton icon={<HiOutlinePencilSquare />} variant="secondary" compact onClick={() => setActivePurchaseId(String(purchase.id))} label="Edit purchase">Edit</ToolbarButton>
                      <ToolbarButton icon={<HiOutlineTrash />} variant="danger" compact onClick={() => handleDelete(purchase.id)} label="Delete purchase">Delete</ToolbarButton>
                    </div>
                    {activePurchaseId === String(purchase.id) && (
                      <div className="purchase-history-note">Outstanding payments and seller history can be connected to backend records when the purchase API is added.</div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </AppCard>

          <div className="purchase-dashboard-grid mt-4">
            <AppCard title="Top suppliers" subtitle="Most valuable suppliers in this session." collapsible>
              <div className="purchase-mini-list">
                {stats.topSuppliers.map(([name, total]) => (
                  <div key={name} className="purchase-mini-row"><span>{name}</span><strong>{formatINR(total)}</strong></div>
                ))}
                {!stats.topSuppliers.length && <EmptyState title="No supplier data" description="Save a purchase to populate supplier insights." />}
              </div>
            </AppCard>
            <AppCard title="Most purchased product" subtitle="Highest quantity item across purchases." collapsible>
              <div className="purchase-mini-summary">
                <strong>{stats.mostPurchasedProduct?.[0] || 'N/A'}</strong>
                <span>{stats.mostPurchasedProduct?.[1] || 0} units</span>
              </div>
            </AppCard>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default Purchases;
