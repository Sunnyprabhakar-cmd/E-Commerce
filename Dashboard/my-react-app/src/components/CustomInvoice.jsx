import { useEffect, useMemo, useState } from 'react';
import AppCard from './common/AppCard';
import EmptyState from './common/EmptyState';
import LoadingSpinner from './common/LoadingSpinner';
import PageHeader from './common/PageHeader';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';
import {
  buildInvoiceAssets,
  createGroupInvoiceMarkup,
  downloadPdfFromHtml,
  openPreviewWindow,
} from '../utils/invoiceUtils';
import { fetchProducts, searchProducts } from '../services/productService';
import { activateInvoiceTemplate, deleteInvoiceTemplate, fetchInvoiceTemplates, saveInvoiceTemplate } from '../services/systemService';

const createItem = (overrides = {}) => ({
  id: crypto.randomUUID(),
  productSearch: '',
  productId: '',
  productName: '',
  description: '',
  hsnCode: '',
  quantity: 1,
  unit: 'PCS',
  rate: '',
  discountPercent: 0,
  gstPercent: 18,
  cgst: 0,
  sgst: 0,
  igst: 0,
  taxAmount: 0,
  subtotal: 0,
  ...overrides,
});

const createEmptyMeta = () => ({
  invoiceNumber: `INV-${Date.now()}`,
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  referenceNumber: '',
  salesPerson: '',
  customerName: '',
  customerPhone: '',
  customerGST: '',
  customerAddress: '',
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  invoiceType: 'Tax Invoice',
  gstType: 'GST',
  currency: 'INR',
  terms: 'Goods once sold will not be taken back or exchanged.',
  notes: '',
  shippingCharges: 0,
  packingCharges: 0,
  previousBalance: 0,
  paidAmount: 0,
});

const defaultTemplate = {
  template_key: 'professional',
  template_name: 'Professional',
  template_category: 'invoice',
  sections: ['header', 'customer', 'items', 'summary', 'terms'],
};

const CustomInvoice = () => {
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [activeTemplateKey, setActiveTemplateKey] = useState(defaultTemplate.template_key);
  const [templateDraft, setTemplateDraft] = useState(defaultTemplate);
  const [meta, setMeta] = useState(createEmptyMeta());
  const [items, setItems] = useState([createItem()]);
  const [preview, setPreview] = useState(null);
  const [productMatches, setProductMatches] = useState({});

  const loadTemplates = async () => {
    try {
      const response = await fetchInvoiceTemplates();
      const loadedTemplates = Array.isArray(response.data?.templates) ? response.data.templates : [];
      setTemplates(loadedTemplates);

      const defaultTemplateFromDb = loadedTemplates.find((template) => template.is_default) || loadedTemplates[0];
      if (defaultTemplateFromDb) {
        setActiveTemplateKey(defaultTemplateFromDb.template_key);
        setTemplateDraft({
          template_key: defaultTemplateFromDb.template_key,
          template_name: defaultTemplateFromDb.template_name,
          template_category: defaultTemplateFromDb.template_category || 'invoice',
          sections: defaultTemplateFromDb.template_value?.sections || defaultTemplate.sections,
        });
      }
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const updateMeta = (field, value) => setMeta((prev) => ({ ...prev, [field]: value }));

  const updateItem = (itemId, field, value) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...item, [field]: value };
      if (field === 'rate' || field === 'quantity' || field === 'discountPercent' || field === 'gstPercent') {
        const quantity = Number(next.quantity || 0);
        const rate = Number(next.rate || 0);
        const discountPercent = Number(next.discountPercent || 0);
        const gstPercent = Number(next.gstPercent || 0);
        const lineAmount = quantity * rate;
        const discountAmount = lineAmount * (discountPercent / 100);
        const taxable = Math.max(lineAmount - discountAmount, 0);
        const taxAmount = taxable * (gstPercent / 100);
        next.taxAmount = Number(taxAmount.toFixed(2));
        next.subtotal = Number((taxable + taxAmount).toFixed(2));
        next.cgst = Number((taxAmount / 2).toFixed(2));
        next.sgst = Number((taxAmount / 2).toFixed(2));
        next.igst = 0;
      }
      return next;
    }));
  };

  const addItem = () => setItems((prev) => [...prev, createItem()]);

  const removeItem = (itemId) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== itemId)));
  };

  const moveItem = (itemId, direction) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === itemId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }
      const copy = [...prev];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  };

  const handleProductSearch = async (itemId, query) => {
    updateItem(itemId, 'productSearch', query);
    if (!query.trim()) {
      setProductMatches((prev) => ({ ...prev, [itemId]: [] }));
      return;
    }

    try {
      const response = await searchProducts(query.trim(), 1, 8);
      const matches = Array.isArray(response.data?.data) ? response.data.data : [];
      setProductMatches((prev) => ({ ...prev, [itemId]: matches }));
    } catch {
      setProductMatches((prev) => ({ ...prev, [itemId]: [] }));
    }
  };

  const chooseProduct = (itemId, product) => {
    updateItem(itemId, 'productId', product.id);
    updateItem(itemId, 'productSearch', product.name || product.id || '');
    updateItem(itemId, 'productName', product.name || '');
    updateItem(itemId, 'description', product.category || '');
    updateItem(itemId, 'rate', Number(product.price || 0));
    updateItem(itemId, 'quantity', 1);
    setProductMatches((prev) => ({ ...prev, [itemId]: [] }));
  };

  const buildInvoiceGroup = () => {
    const customerName = meta.customerName || 'Customer';
    const orders = items.map((item, index) => {
      const quantity = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const subtotal = Number(item.subtotal || 0);
      const discountAmount = Math.max(quantity * rate - (subtotal - Number(item.taxAmount || 0)), 0);
      return {
        order_id: index + 1,
        invoice_number: meta.invoiceNumber,
        customer_name: customerName,
        customer_email: meta.customerPhone || '',
        product_id: item.productId || `ROW-${index + 1}`,
        product_name: item.productName || item.productSearch || `Item ${index + 1}`,
        product_price: rate,
        quantity,
        total_cost: quantity * rate,
        discount_amount: discountAmount,
        discount_percentage: Number(item.discountPercent || 0),
        payable_amount: subtotal,
        amount_paid: Number(meta.paidAmount || 0),
        remaining_amount: Math.max(subtotal - Number(meta.paidAmount || 0), 0),
        payment_mode: meta.paymentMethod,
        payment_notes: meta.notes || meta.terms,
        status: meta.paymentStatus === 'paid' ? 'paid' : 'partial',
        created_at: meta.invoiceDate,
      };
    });

    const totalSubtotal = orders.reduce((sum, order) => sum + Number(order.payable_amount || 0), 0);
    const totalPaid = Number(meta.paidAmount || 0);
    const remainingAmount = Math.max(totalSubtotal + Number(meta.shippingCharges || 0) + Number(meta.packingCharges || 0) + Number(meta.previousBalance || 0) - totalPaid, 0);

    return {
      groupId: meta.invoiceNumber,
      customerName,
      customerId: meta.referenceNumber || customerName,
      paymentStatus: meta.paymentStatus,
      paymentMode: meta.paymentMethod,
      totalPaid,
      totalRemaining: remainingAmount,
      totalCost: totalSubtotal,
      orders,
      notes: meta.notes,
    };
  };

  const renderPreviewHtml = async () => {
    const group = buildInvoiceGroup();
    const assets = await buildInvoiceAssets(group, true);
    return createGroupInvoiceMarkup(group, assets.qrCodeDataUrl, true);
  };

  const handlePreview = async () => {
    setBusy(true);
    try {
      const html = await renderPreviewHtml();
      await openPreviewWindow(html, `Invoice ${meta.invoiceNumber}`);
      setPreview(html);
    } catch (error) {
      notify(error.message || 'Unable to preview invoice', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const group = buildInvoiceGroup();
      const assets = await buildInvoiceAssets(group, true);
      const html = createGroupInvoiceMarkup(group, assets.qrCodeDataUrl, false);
      await downloadPdfFromHtml(html, assets.fileName);
      notify('Invoice PDF downloaded', 'success');
    } catch (error) {
      notify(error.message || 'Unable to download invoice', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const payload = {
        template_name: templateDraft.template_name,
        template_category: templateDraft.template_category,
        template_value: {
          ...templateDraft,
          invoice_meta: meta,
          sections: templateDraft.sections,
        },
        is_default: true,
      };
      const response = await saveInvoiceTemplate(templateDraft.template_key, payload);
      notify(response.data?.message || 'Template saved', 'success');
      await loadTemplates();
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to save template', 'danger');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDuplicateTemplate = async () => {
    const nextKey = `${templateDraft.template_key}-copy-${Date.now()}`;
    try {
      await saveInvoiceTemplate(nextKey, {
        template_name: `${templateDraft.template_name} Copy`,
        template_category: templateDraft.template_category,
        template_value: templateDraft,
        is_default: false,
      });
      notify('Template duplicated', 'success');
      await loadTemplates();
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to duplicate template', 'danger');
    }
  };

  const handleDeleteTemplate = async () => {
    try {
      await deleteInvoiceTemplate(templateDraft.template_key);
      notify('Template deleted', 'success');
      setTemplateDraft(defaultTemplate);
      await loadTemplates();
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to delete template', 'danger');
    }
  };

  const handleApplyTemplate = async (templateKey) => {
    const selected = templates.find((template) => template.template_key === templateKey);
    if (!selected) {
      return;
    }
    setTemplateDraft({
      template_key: selected.template_key,
      template_name: selected.template_name,
      template_category: selected.template_category || 'invoice',
      sections: selected.template_value?.sections || defaultTemplate.sections,
    });
    await activateInvoiceTemplate(templateKey);
    setActiveTemplateKey(templateKey);
    notify('Template applied', 'success');
  };

  const exportTemplate = () => {
    const blob = new Blob([JSON.stringify({ templateDraft, meta, items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${templateDraft.template_key}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (parsed.templateDraft) {
          setTemplateDraft(parsed.templateDraft);
        }
        if (parsed.meta) {
          setMeta(parsed.meta);
        }
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          setItems(parsed.items);
        }
        notify('Template imported', 'success');
      } catch {
        notify('Invalid template file', 'danger');
      }
    };
    reader.readAsText(file);
  };

  const invoicePreview = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const tax = items.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0);
    const total = subtotal + Number(meta.shippingCharges || 0) + Number(meta.packingCharges || 0) + Number(meta.previousBalance || 0) - Number(meta.paidAmount || 0);
    return { subtotal, tax, total: Math.max(total, 0) };
  }, [items, meta]);

  if (loading) {
    return <LoadingSpinner className="mt-5" label="Loading invoice designer..." />;
  }

  return (
    <div className="settings-center-shell invoice-designer-shell">
      <PageHeader
        kicker="Invoice"
        title="Professional Invoice Designer"
        description="Create, reorder, preview, export, and save invoice templates with live totals and backend persistence."
        actions={(
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <select className="form-select" value={activeTemplateKey} onChange={(e) => handleApplyTemplate(e.target.value)} style={{ width: '220px' }}>
              {templates.length === 0 && <option value={defaultTemplate.template_key}>Professional</option>}
              {templates.map((template) => (
                <option key={template.template_key} value={template.template_key}>{template.template_name}</option>
              ))}
            </select>
            <button type="button" className="toolbar-button primary" onClick={handleSaveTemplate} disabled={savingTemplate}>{savingTemplate ? 'Saving...' : 'Save Template'}</button>
          </div>
        )}
      />

      <div className="settings-layout-grid invoice-designer-grid">
        <div className="settings-content-shell">
          <AppCard title="Invoice Information" subtitle="Every field saves to the invoice payload and preview immediately updates.">
            <div className="row g-3">
              {[
                ['invoiceNumber', 'Invoice Number'], ['invoiceDate', 'Invoice Date', 'date'], ['dueDate', 'Due Date', 'date'], ['referenceNumber', 'Reference Number'],
                ['salesPerson', 'Sales Person'], ['customerName', 'Customer'], ['customerPhone', 'Customer Phone'], ['customerGST', 'Customer GST'],
                ['customerAddress', 'Customer Address'], ['paymentMethod', 'Payment Method'], ['paymentStatus', 'Payment Status'], ['invoiceType', 'Invoice Type'],
                ['gstType', 'GST Type'], ['currency', 'Currency'], ['terms', 'Terms'], ['notes', 'Notes'],
              ].map(([field, label, type = 'text']) => (
                <div className={field === 'customerAddress' || field === 'terms' || field === 'notes' ? 'col-md-12' : 'col-md-6'} key={field}>
                  <label className="form-label">{label}</label>
                  {field === 'customerAddress' || field === 'terms' || field === 'notes' ? (
                    <textarea className="form-control" rows="2" value={meta[field]} onChange={(e) => updateMeta(field, e.target.value)} />
                  ) : field === 'paymentMethod' ? (
                    <select className="form-select" value={meta[field]} onChange={(e) => updateMeta(field, e.target.value)}>
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank Transfer</option><option value="wallet">Wallet</option>
                    </select>
                  ) : field === 'paymentStatus' ? (
                    <select className="form-select" value={meta[field]} onChange={(e) => updateMeta(field, e.target.value)}>
                      <option value="paid">Paid</option><option value="partial">Partial</option><option value="pending">Pending</option><option value="draft">Draft</option>
                    </select>
                  ) : (
                    <input className="form-control" type={type} value={meta[field]} onChange={(e) => updateMeta(field, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard title="Invoice Product Table" subtitle="Unlimited line items with drag-friendly reordering, product search, and live calculations.">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div className="settings-section-note">Search products directly from inventory and auto-fill product price, then finish HSN, unit, and tax details here.</div>
              <button type="button" className="toolbar-button primary" onClick={addItem}>Add Item</button>
            </div>

            <div className="invoice-item-list">
              {items.map((item, index) => (
                <div key={item.id} className="invoice-item-card">
                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                    <strong>Item {index + 1}</strong>
                    <div className="d-flex gap-2">
                      <button type="button" className="toolbar-button compact secondary" onClick={() => moveItem(item.id, -1)}>Move Up</button>
                      <button type="button" className="toolbar-button compact secondary" onClick={() => moveItem(item.id, 1)}>Move Down</button>
                      <button type="button" className="toolbar-button compact danger" onClick={() => removeItem(item.id)}>Delete Row</button>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-5 position-relative">
                      <label className="form-label">Product Search</label>
                      <input className="form-control" value={item.productSearch} onChange={(e) => handleProductSearch(item.id, e.target.value)} placeholder="Search inventory products" />
                      {productMatches[item.id]?.length > 0 && (
                        <div className="invoice-search-results">
                          {productMatches[item.id].map((product) => (
                            <button key={product.id} type="button" className="invoice-search-result" onClick={() => chooseProduct(item.id, product)}>
                              <strong>{product.name}</strong>
                              <span>{product.category} • {formatINR(product.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-md-7"><label className="form-label">Description</label><input className="form-control" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} /></div>
                    <div className="col-md-3"><label className="form-label">HSN Code</label><input className="form-control" value={item.hsnCode} onChange={(e) => updateItem(item.id, 'hsnCode', e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">Quantity</label><input className="form-control" type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">Unit</label><input className="form-control" value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">Rate</label><input className="form-control" type="number" value={item.rate} onChange={(e) => updateItem(item.id, 'rate', e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">Discount %</label><input className="form-control" type="number" value={item.discountPercent} onChange={(e) => updateItem(item.id, 'discountPercent', e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">GST %</label><input className="form-control" type="number" value={item.gstPercent} onChange={(e) => updateItem(item.id, 'gstPercent', e.target.value)} /></div>
                    <div className="col-md-1"><label className="form-label">CGST</label><input className="form-control" type="number" value={item.cgst} readOnly /></div>
                    <div className="col-md-1"><label className="form-label">SGST</label><input className="form-control" type="number" value={item.sgst} readOnly /></div>
                    <div className="col-md-1"><label className="form-label">IGST</label><input className="form-control" type="number" value={item.igst} readOnly /></div>
                    <div className="col-md-2"><label className="form-label">Tax Amount</label><input className="form-control" type="number" value={item.taxAmount} readOnly /></div>
                    <div className="col-md-2"><label className="form-label">Subtotal</label><input className="form-control" type="number" value={item.subtotal} readOnly /></div>
                  </div>
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard title="Invoice Summary" subtitle="Calculated instantly from the item rows and payment state.">
            <div className="row g-3">
              {[
                ['Subtotal', invoicePreview.subtotal],
                ['Discount', 0],
                ['Shipping Charges', Number(meta.shippingCharges || 0)],
                ['Packing Charges', Number(meta.packingCharges || 0)],
                ['Previous Balance', Number(meta.previousBalance || 0)],
                ['Paid Amount', Number(meta.paidAmount || 0)],
                ['Tax', invoicePreview.tax],
                ['Grand Total', invoicePreview.total],
              ].map(([label, value]) => (
                <div key={label} className="col-md-3">
                  <div className="settings-stat">
                    <span>{label}</span>
                    <strong>{formatINR(value)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard title="Template Actions" subtitle="Save template, duplicate it, activate it, export/import JSON, or delete it.">
            <div className="d-flex gap-2 flex-wrap">
              <button type="button" className="toolbar-button primary" onClick={handlePreview} disabled={busy}>{busy ? 'Rendering...' : 'Preview'}</button>
              <button type="button" className="toolbar-button secondary" onClick={handleDownload} disabled={busy}>Export PDF</button>
              <button type="button" className="toolbar-button secondary" onClick={handleDuplicateTemplate}>Duplicate Template</button>
              <button type="button" className="toolbar-button secondary" onClick={exportTemplate}>Export Template</button>
              <label className="toolbar-button secondary" style={{ cursor: 'pointer' }}>
                Import Template
                <input type="file" accept="application/json" className="d-none" onChange={importTemplate} />
              </label>
              <button type="button" className="toolbar-button danger" onClick={handleDeleteTemplate}>Delete Template</button>
            </div>
          </AppCard>
        </div>

        <div className="settings-content-shell">
          <AppCard title="Live Preview" subtitle="A live commercial-style invoice preview built from actual line items.">
            {items.length === 0 ? (
              <EmptyState title="Add items to preview" description="The invoice preview will render once you add at least one line item." />
            ) : (
              <div className="invoice-live-preview">
                <div className="invoice-live-header">
                  <div>
                    <div className="toolbar-kicker">{meta.invoiceType}</div>
                    <h2 className="h4 mb-1">{meta.invoiceNumber}</h2>
                    <div className="text-muted">{meta.invoiceDate} • Due {meta.dueDate}</div>
                  </div>
                  <div className="text-end">
                    <div className="fw-semibold">{meta.customerName || 'Customer'}</div>
                    <div className="text-muted">{meta.customerPhone || 'No phone'}</div>
                  </div>
                </div>

                <div className="invoice-live-customer">
                  <div><span>GST</span><strong>{meta.customerGST || 'N/A'}</strong></div>
                  <div><span>Reference</span><strong>{meta.referenceNumber || 'N/A'}</strong></div>
                  <div><span>Payment</span><strong>{meta.paymentMethod}</strong></div>
                  <div><span>Status</span><strong>{meta.paymentStatus}</strong></div>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm align-middle invoice-preview-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>HSN</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>GST</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.productName || item.productSearch || 'Item'}</strong>
                            <div className="text-muted small">{item.description || 'Description'}</div>
                          </td>
                          <td>{item.hsnCode || 'N/A'}</td>
                          <td>{item.quantity} {item.unit}</td>
                          <td>{formatINR(item.rate)}</td>
                          <td>{item.gstPercent}%</td>
                          <td>{formatINR(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="invoice-live-summary">
                  <div><span>Subtotal</span><strong>{formatINR(invoicePreview.subtotal)}</strong></div>
                  <div><span>Shipping</span><strong>{formatINR(meta.shippingCharges)}</strong></div>
                  <div><span>Packing</span><strong>{formatINR(meta.packingCharges)}</strong></div>
                  <div><span>Previous Balance</span><strong>{formatINR(meta.previousBalance)}</strong></div>
                  <div><span>Paid Amount</span><strong>{formatINR(meta.paidAmount)}</strong></div>
                  <div><span>Grand Total</span><strong>{formatINR(invoicePreview.total)}</strong></div>
                </div>

                <div className="invoice-live-notes">
                  <div><strong>Terms:</strong> {meta.terms}</div>
                  <div><strong>Notes:</strong> {meta.notes || 'No additional notes'}</div>
                </div>
              </div>
            )}
          </AppCard>

          <AppCard title="Saved Templates" subtitle="Activate any saved template and keep one active throughout the application.">
            <div className="d-grid gap-2">
              {templates.length === 0 && <EmptyState title="No templates yet" description="Save the first template to begin building invoice styles." />}
              {templates.map((template) => (
                <div key={template.template_key} className={`invoice-template-row ${template.is_default ? 'active' : ''}`}>
                  <div>
                    <strong>{template.template_name}</strong>
                    <div className="text-muted small">{template.template_category}</div>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button type="button" className="toolbar-button compact" onClick={() => handleApplyTemplate(template.template_key)}>Apply</button>
                    <button type="button" className="toolbar-button compact secondary" onClick={async () => { await activateInvoiceTemplate(template.template_key); notify('Template activated', 'success'); await loadTemplates(); }}>Activate</button>
                  </div>
                </div>
              ))}
            </div>
          </AppCard>
        </div>
      </div>
    </div>
  );
};

export default CustomInvoice;