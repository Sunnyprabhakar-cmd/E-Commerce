import { useEffect, useMemo, useRef, useState } from 'react';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';
import {
  buildInvoiceAssets,
  createGroupInvoiceMarkup,
  createInvoiceMarkup,
  downloadPdfFromHtml,
  getDisplayRemaining,
  getInvoiceNumber,
  getInvoiceTitle,
  getOrderProductLabel,
  getPaymentStatus,
  openPreviewWindow,
} from '../utils/invoiceUtils';
import { fetchOrders as fetchOrdersService, fetchOrderActions as fetchOrderActionsService, adminOrderAction } from '../services/orderService';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import LoadingSpinner from './common/LoadingSpinner';
import EmptyState from './common/EmptyState';
import AppCard from './common/AppCard';
import ToolbarButton from './common/ToolbarButton';
import { HiOutlineArrowPath, HiOutlineDocumentText, HiOutlinePrinter, HiOutlineTrash, HiOutlineClock, HiOutlineEnvelope, HiOutlineShare } from 'react-icons/hi2';

const STATUS_OPTIONS = ['pending', 'accepted', 'preparing', 'packed', 'out for delivery', 'delivered', 'completed', 'cancelled', 'rejected', 'refunded', 'returned'];
const PAYMENT_STATUS_OPTIONS = ['pending', 'partial', 'paid', 'refunded', 'failed', 'cancelled'];
const PAYMENT_MODE_OPTIONS = ['cash', 'upi', 'card', 'net banking', 'wallet', 'cheque'];
const REJECT_REASONS = ['Out of Stock', 'Customer Cancelled', 'Payment Failed', 'Custom Reason'];

const getOrderKey = (order) => order.order_id || order.tracking_id || `${order.product_id}-${order.user_id}`;

const getViewParams = () => {
  if (typeof window === 'undefined') {
    return { groupId: null, orderId: null };
  }
  const searchParams = new URLSearchParams(window.location.search);
  return {
    groupId: searchParams.get('groupId'),
    orderId: searchParams.get('orderId'),
  };
};

const buildDraft = (order) => ({
  quantity: String(Number(order.quantity || 1)),
  discountMode: 'percent',
  discountValue: String(Number(order.discount_percentage || 0)),
  paymentAmount: String(Number(order.amount_paid || 0)),
  paymentMode: order.payment_mode || 'cash',
  status: order.status || 'pending',
  paymentStatus: order.payment_status || getPaymentStatus(order),
  adminNotes: order.admin_notes || '',
  operatorNotes: order.operator_notes || '',
  deliveryNotes: order.delivery_notes || '',
  customerNotes: order.customer_notes || '',
  internalNotes: order.internal_notes || '',
  rejectReason: 'Out of Stock',
});

export const OrderHeader = ({ group, onRefresh, onOpenList }) => (
  <div className="order-details-header">
    <div>
      <div className="text-uppercase small fw-bold text-muted">Order workspace</div>
      <h1 className="h3 mb-2">{group?.groupId || 'Order details'}</h1>
      <div className="text-muted">{group?.customerName || 'Customer'} · {group?.customerId || 'N/A'}</div>
    </div>
    <div className="d-flex flex-wrap gap-2 align-items-center">
      <ToolbarButton icon={<HiOutlineArrowPath />} onClick={onRefresh} label="Refresh order details">Refresh</ToolbarButton>
      <ToolbarButton icon={<HiOutlineDocumentText />} onClick={onOpenList} label="Back to order list">Back to list</ToolbarButton>
    </div>
  </div>
);

export const QuantityEditor = ({ value, onChange, onSave, onCancel, stockLimit }) => (
  <div className="order-quantity-editor">
    <ToolbarButton compact onClick={() => onChange(String(Math.max(1, Number(value || 1) - 1)))} label="Decrease quantity">-</ToolbarButton>
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={stockLimit ? String(stockLimit).length : undefined}
      className="form-control form-control-sm order-compact-input"
      value={value}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ''))}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSave();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onChange(String(Number(value || 1) + 1));
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onChange(String(Math.max(1, Number(value || 1) - 1)));
        }
      }}
    />
    <ToolbarButton compact onClick={() => onChange(String(Number(value || 1) + 1))} label="Increase quantity">+</ToolbarButton>
    <ToolbarButton compact variant="primary" onClick={onSave}>Save Changes</ToolbarButton>
    <ToolbarButton compact onClick={onCancel}>Cancel</ToolbarButton>
  </div>
);

export const StatusDropdown = ({ value, onChange }) => (
  <select className="form-select form-select-sm order-compact-select" value={value} onChange={(event) => onChange(event.target.value)}>
    {STATUS_OPTIONS.map((status) => (
      <option key={status} value={status}>{status}</option>
    ))}
  </select>
);

export const PaymentEditor = ({ draft, onDraftChange, onSave }) => (
  <div className="order-payment-editor">
    <select className="form-select form-select-sm order-compact-select" value={draft.paymentStatus} onChange={(event) => onDraftChange('paymentStatus', event.target.value)}>
      {PAYMENT_STATUS_OPTIONS.map((status) => (
        <option key={status} value={status}>{status}</option>
      ))}
    </select>
    <div className="d-flex gap-2 align-items-center flex-wrap">
      <input
        type="number"
        min="0"
        step="0.01"
        className="form-control form-control-sm order-compact-input"
        value={draft.paymentAmount}
        onChange={(event) => onDraftChange('paymentAmount', event.target.value.replace(/[^0-9.]/g, ''))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSave();
          }
        }}
        placeholder="Amount Paid"
      />
      <select className="form-select form-select-sm order-compact-select" value={draft.paymentMode} onChange={(event) => onDraftChange('paymentMode', event.target.value)}>
        {PAYMENT_MODE_OPTIONS.map((mode) => (
          <option key={mode} value={mode}>{mode}</option>
        ))}
      </select>
      <ToolbarButton compact variant="primary" onClick={onSave}>Save</ToolbarButton>
    </div>
  </div>
);

export const NotesPanel = ({ draft, onDraftChange, onSave }) => (
  <div className="order-notes-grid">
    {[
      ['adminNotes', 'Admin Notes'],
      ['operatorNotes', 'Operator Notes'],
      ['deliveryNotes', 'Delivery Notes'],
      ['customerNotes', 'Customer Notes'],
      ['internalNotes', 'Internal Notes'],
    ].map(([field, label]) => (
      <label key={field} className="order-note-field">
        <span>{label}</span>
        <textarea
          className="form-control order-note-input"
          rows="3"
          value={draft[field]}
          onChange={(event) => onDraftChange(field, event.target.value)}
          placeholder={label}
        />
      </label>
    ))}
    <div className="order-notes-actions">
      <ToolbarButton compact variant="primary" onClick={onSave}>Save Notes</ToolbarButton>
    </div>
  </div>
);

export const Timeline = ({ actions }) => (
  <div className="order-timeline-list">
    {actions.length === 0 ? <div className="text-muted small">No timeline entries yet.</div> : actions.map((action) => (
      <div key={action.action_id} className="order-timeline-item">
        <div className="order-timeline-top">
          <strong>{action.action_type}</strong>
          <span>{new Date(action.created_at).toLocaleString()}</span>
        </div>
        <div>{action.action_note || 'No note'}</div>
        <div className="text-muted small">{action.action_by_user_name || 'Unknown user'}</div>
      </div>
    ))}
  </div>
);

export const AuditLog = ({ actions }) => (
  <div className="order-audit-list">
    {actions.length === 0 ? <div className="text-muted small">No audit records.</div> : actions.map((action) => (
      <div key={action.action_id} className="order-audit-item">
        <div className="order-timeline-top">
          <strong>{action.action_type}</strong>
          <span>{new Date(action.created_at).toLocaleString()}</span>
        </div>
        <div className="small text-muted">By: {action.action_by_user_name || 'Unknown'} · Role: {action.action_by_role || 'N/A'}</div>
        <div className="small">{action.action_metadata || 'No metadata'}</div>
      </div>
    ))}
  </div>
);

export const ProductCard = ({ order, draft, onDraftChange, onCommitQuantity, onSaveDiscount, onRemoveDiscount, onSavePayment, onSaveStatus, onCancelProduct, onOpenInvoice, onOpenHistory, onApplyReject, onSaveAll }) => {
  const stockLimit = Number(order.stock_quantity ?? order.available_stock ?? order.stock ?? order.product_stock ?? 0);
  const displayRemaining = getDisplayRemaining(order);
  const displayPaid = Number(order.amount_paid || 0);
  const paymentStatus = order.payment_status || getPaymentStatus(order);

  return (
    <AppCard className="order-product-card order-item-row">
      <div className="order-product-card-head order-item-row-head">
        <div className="order-item-title-block">
          <div className="order-item-eyebrow">Product item</div>
          <h3 className="h5 mb-1">{getOrderProductLabel(order)}</h3>
          <div className="text-muted small">Order #{order.order_id || order.tracking_id || 'N/A'} · Product ID {order.product_id}</div>
        </div>
        <div className="order-product-badges">
          <span className={`order-status-chip ${String(order.status || '').toLowerCase()}`}>{order.status || 'pending'}</span>
          <span className={`order-status-chip ${String(paymentStatus || '').toLowerCase()}`}>{paymentStatus}</span>
        </div>
      </div>

      <div className="order-item-summary-grid">
        <div className="order-product-stat"><span>Unit Price</span><strong>{formatINR(Number(order.product_price || 0))}</strong></div>
        <div className="order-product-stat"><span>Total Cost</span><strong>{formatINR(Number(order.total_cost || 0))}</strong></div>
        <div className="order-product-stat"><span>Amount Paid</span><strong>{formatINR(displayPaid)}</strong></div>
        <div className="order-product-stat"><span>Remaining</span><strong>{formatINR(displayRemaining)}</strong></div>
      </div>

      <div className="order-item-controls-grid">
        <div className="order-item-control-block">
          <span className="order-item-control-label">Quantity</span>
          <QuantityEditor value={draft.quantity} onChange={(next) => onDraftChange('quantity', next)} onSave={onCommitQuantity} onCancel={() => onDraftChange('quantity', String(Number(order.quantity || 1)))} stockLimit={stockLimit} />
        </div>
        <div className="order-item-control-block">
          <span className="order-item-control-label">Discount</span>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <select className="form-select form-select-sm order-compact-select" value={draft.discountMode} onChange={(event) => onDraftChange('discountMode', event.target.value)}>
              <option value="percent">%</option>
              <option value="fixed">₹</option>
            </select>
            <input className="form-control form-control-sm order-compact-input" type="number" min="0" step="0.01" value={draft.discountValue} onChange={(event) => onDraftChange('discountValue', event.target.value.replace(/[^0-9.]/g, ''))} />
            <ToolbarButton compact onClick={onSaveDiscount}>Apply</ToolbarButton>
            <ToolbarButton compact onClick={onRemoveDiscount}>Remove</ToolbarButton>
          </div>
        </div>
        <div className="order-item-control-block">
          <span className="order-item-control-label">Payment</span>
          <PaymentEditor draft={draft} onDraftChange={onDraftChange} onSave={onSavePayment} />
        </div>
        <div className="order-item-control-block">
          <span className="order-item-control-label">Status</span>
          <StatusDropdown value={draft.status} onChange={(next) => onDraftChange('status', next)} />
        </div>
      </div>

      <div className="order-item-footer-row">
        <div className="order-product-actions">
          <ToolbarButton compact variant="secondary" onClick={onSaveAll}>Save Changes</ToolbarButton>
          <ToolbarButton compact variant="secondary" icon={<HiOutlineDocumentText />} onClick={onOpenInvoice}>Generate Product Invoice</ToolbarButton>
          <ToolbarButton compact variant="secondary" icon={<HiOutlineClock />} onClick={onOpenHistory}>Product History</ToolbarButton>
          <ToolbarButton compact variant="outline-danger" icon={<HiOutlineTrash />} onClick={onCancelProduct}>Cancel Product</ToolbarButton>
        </div>

        <div className="order-reject-row">
          <select className="form-select form-select-sm order-compact-select" value={draft.rejectReason} onChange={(event) => onDraftChange('rejectReason', event.target.value)}>
            {REJECT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
          <ToolbarButton compact variant="outline-danger" onClick={() => onApplyReject(draft.rejectReason)}>Reject Product</ToolbarButton>
        </div>
      </div>
    </AppCard>
  );
};

const OrderDetailsPage = ({ onNavigate }) => {
  const { groupId, orderId } = getViewParams();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [actionsByOrder, setActionsByOrder] = useState({});
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState('');
  const timelineRef = useRef(null);
  const auditRef = useRef(null);
  const notesRef = useRef(null);

  const setStatusMessage = (text) => {
    setMessage(text);
    if (text) {
      notify(text);
    }
  };

  const selectedOrders = useMemo(() => {
    if (!orders.length) return [];
    if (groupId) {
      return orders.filter((order) => String(order.order_group_id || order.groupId || '') === String(groupId));
    }
    if (orderId) {
      return orders.filter((order) => String(order.order_id || order.tracking_id || '') === String(orderId));
    }
    return [];
  }, [groupId, orderId, orders]);

  const summary = useMemo(() => {
    const totalPaid = selectedOrders.reduce((sum, order) => sum + Number(order.amount_paid || 0), 0);
    const totalRemaining = selectedOrders.reduce((sum, order) => sum + Number(order.remaining_amount || 0), 0);
    const totalCost = selectedOrders.reduce((sum, order) => sum + Number(order.total_cost || 0), 0);
    return { totalPaid, totalRemaining, totalCost, items: selectedOrders.length };
  }, [selectedOrders]);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const response = await fetchOrdersService('/orders');
      const items = Array.isArray(response.data?.orders) ? response.data.orders : [];
      setOrders(items);
      const nextDrafts = {};
      items.forEach((order) => {
        nextDrafts[getOrderKey(order)] = buildDraft(order);
      });
      setDrafts(nextDrafts);
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Failed to load order details');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadActions = async (workspaceOrders) => {
    try {
      const pairs = await Promise.all(
        workspaceOrders.map(async (order) => {
          const actionsResponse = await fetchOrderActionsService(order.order_id || order.tracking_id);
          return [getOrderKey(order), Array.isArray(actionsResponse.data) ? actionsResponse.data : []];
        })
      );
      setActionsByOrder(Object.fromEntries(pairs));
    } catch {
      setActionsByOrder({});
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (selectedOrders.length > 0) {
      loadActions(selectedOrders);
    }
  }, [selectedOrders]);

  const updateDraft = (order, field, value) => {
    const key = getOrderKey(order);
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const runQuantityUpdate = async (order, desiredQuantity) => {
    const currentQuantity = Number(order.quantity || 1);
    const stockLimit = Number(order.stock_quantity ?? order.available_stock ?? order.stock ?? order.product_stock ?? 0);
    const target = Math.max(1, Number(desiredQuantity || 1));
    if (stockLimit > 0 && target > stockLimit) {
      setStatusMessage(`Quantity cannot exceed stock (${stockLimit})`);
      return;
    }
    const delta = target - currentQuantity;
    if (delta === 0) return;
    const steps = Math.abs(delta);
    const action = delta > 0 ? 'increase_qty' : 'decrease_qty';
    for (let index = 0; index < steps; index += 1) {
      await adminOrderAction({ order_id: order.order_id, action });
    }
    setStatusMessage('Quantity updated');
    loadWorkspace();
  };

  const saveDiscount = async (order) => {
    const draft = drafts[getOrderKey(order)] || buildDraft(order);
    const value = Number(draft.discountValue || 0);
    if (draft.discountMode === 'percent') {
      if (value < 0 || value > 100) {
        setStatusMessage('Enter a valid discount percentage between 0 and 100');
        return;
      }
      await adminOrderAction({ order_id: order.order_id, action: 'apply_discount', discount_percentage: value });
      setStatusMessage('Discount applied');
      loadWorkspace();
      return;
    }

    const currentTotal = Number(order.total_cost || 0);
    const percentage = currentTotal > 0 ? Math.min(100, Number(((value / currentTotal) * 100).toFixed(2))) : 0;
    await adminOrderAction({ order_id: order.order_id, action: 'apply_discount', discount_percentage: percentage });
    setStatusMessage('Discount applied');
    loadWorkspace();
  };

  const removeDiscount = async (order) => {
    await adminOrderAction({ order_id: order.order_id, action: 'apply_discount', discount_percentage: 0 });
    setStatusMessage('Discount removed');
    loadWorkspace();
  };

  const savePayment = async (order) => {
    const draft = drafts[getOrderKey(order)] || buildDraft(order);
    const amount = Number(draft.paymentAmount || 0);
    const currentPaid = Number(order.amount_paid || 0);
    if (amount < currentPaid) {
      setStatusMessage('Reducing amount paid is not supported yet');
      return;
    }
    const delta = amount - currentPaid;
    if (delta > 0) {
      await adminOrderAction({
        order_id: order.order_id,
        action: 'collect_payment',
        amount_received: delta,
        payment_mode: draft.paymentMode,
        payment_notes: `Payment updated from order workspace`,
      });
    }
    await adminOrderAction({ order_id: order.order_id, action: 'update_payment_status', payment_status: draft.paymentStatus });
    setStatusMessage('Payment updated');
    loadWorkspace();
  };

  const saveStatus = async (order) => {
    const draft = drafts[getOrderKey(order)] || buildDraft(order);
    await adminOrderAction({ order_id: order.order_id, action: 'update_status', status: draft.status });
    setStatusMessage('Status updated');
    loadWorkspace();
  };

  const saveNotes = async () => {
    const targetOrder = selectedOrders[0];
    if (!targetOrder) return;
    const draft = drafts[getOrderKey(targetOrder)] || buildDraft(targetOrder);
    await adminOrderAction({
      order_id: targetOrder.order_id,
      action: 'update_notes',
      notes: {
        admin_notes: draft.adminNotes,
        operator_notes: draft.operatorNotes,
        delivery_notes: draft.deliveryNotes,
        customer_notes: draft.customerNotes,
        internal_notes: draft.internalNotes,
      },
    });
    setStatusMessage('Notes saved');
    loadWorkspace();
  };

  const cancelProduct = async (order) => {
    if (!window.confirm('Cancel this product only?')) return;
    await adminOrderAction({ order_id: order.order_id, action: 'cancel' });
    setStatusMessage('Product cancelled');
    loadWorkspace();
  };

  const rejectProduct = async (order, reason) => {
    await adminOrderAction({ order_id: order.order_id, action: 'reject', reason });
    setStatusMessage('Product rejected');
    loadWorkspace();
  };

  const generateInvoice = async (order) => {
    try {
      const isGroupInvoice = selectedOrders.length > 1;
      const invoiceOrder = isGroupInvoice ? { ...groupInvoiceOrder, orders: selectedOrders } : order;
      const assets = await buildInvoiceAssets(invoiceOrder, isGroupInvoice);
      const html = isGroupInvoice
        ? createGroupInvoiceMarkup(invoiceOrder, assets.qrCodeDataUrl, true)
        : createInvoiceMarkup(order, assets.qrCodeDataUrl, true);
      await openPreviewWindow(html, getInvoiceTitle(invoiceOrder));
    } catch (error) {
      setStatusMessage(error.message || 'Unable to open invoice window. Check popup settings.');
    }
  };

  const downloadInvoice = async (order) => {
    try {
      const isGroupInvoice = selectedOrders.length > 1;
      const invoiceOrder = isGroupInvoice ? { ...groupInvoiceOrder, orders: selectedOrders } : order;
      const assets = await buildInvoiceAssets(invoiceOrder, isGroupInvoice);
      const html = isGroupInvoice
        ? createGroupInvoiceMarkup(invoiceOrder, assets.qrCodeDataUrl, false)
        : createInvoiceMarkup(order, assets.qrCodeDataUrl, false);
      await downloadPdfFromHtml(html, assets.fileName);
    } catch (error) {
      setStatusMessage(error.message || 'Unable to download invoice PDF');
    }
  };

  const printInvoice = async (order) => {
    try {
      const isGroupInvoice = selectedOrders.length > 1;
      const invoiceOrder = isGroupInvoice ? { ...groupInvoiceOrder, orders: selectedOrders } : order;
      const assets = await buildInvoiceAssets(invoiceOrder, isGroupInvoice);
      const html = isGroupInvoice
        ? createGroupInvoiceMarkup(invoiceOrder, assets.qrCodeDataUrl, true)
        : createInvoiceMarkup(order, assets.qrCodeDataUrl, true);
      const preview = await openPreviewWindow(html, getInvoiceTitle(invoiceOrder));
      preview.focus();
      preview.print();
    } catch (error) {
      setStatusMessage(error.message || 'Unable to print invoice');
    }
  };

  const openHistory = async (order) => {
    const actions = actionsByOrder[getOrderKey(order)] || [];
    if (!actions.length) {
      setStatusMessage('No history entries for this product');
      return;
    }
    timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    notify(`History loaded for order ${order.order_id}`);
  };

  const exportWorkspace = () => {
    const payload = {
      groupId: groupId || primaryOrder.order_group_id || primaryOrder.groupId,
      orders: selectedOrders,
      summary,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `order-workspace-${groupId || primaryOrder.order_group_id || primaryOrder.order_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openMail = () => {
    if (!selectedOrders[0]) return;
    const subject = encodeURIComponent(`Invoice ${getInvoiceNumber(selectedOrders[0])}`);
    const body = encodeURIComponent(`Order total: ${formatINR(summary.totalCost)}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareInvoice = async () => {
    const order = selectedOrders[0];
    if (!order) return;
    const shareData = {
      title: getInvoiceTitle(order),
      text: `Invoice ${getInvoiceNumber(order)} for ${formatINR(summary.totalCost)}`,
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(`${shareData.title} - ${shareData.text}`);
    setStatusMessage('Invoice details copied to clipboard');
  };

  const reopenOrder = async () => {
    const order = selectedOrders[0];
    if (!order) return;
    await adminOrderAction({ order_id: order.order_id, action: 'update_status', status: 'pending' });
    await adminOrderAction({ order_id: order.order_id, action: 'update_payment_status', payment_status: 'pending' });
    setStatusMessage('Order reopened');
    loadWorkspace();
  };

  const saveAll = async (order) => {
    await saveStatus(order);
    await savePayment(order);
    await saveDiscount(order);
  };

  const goBackToList = () => {
    if (onNavigate) {
      onNavigate('orders');
      return;
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'orders');
      window.location.href = url.toString();
    }
  };

  if (loading) {
    return <LoadingSpinner className="mt-5" label="Loading order workspace..." />;
  }

  if (selectedOrders.length === 0) {
    return <EmptyState title="Order not found" description="Open an order from the list to manage its workspace." />;
  }

  const primaryOrder = selectedOrders[0];
  const primaryDraftKey = getOrderKey(primaryOrder);
  const primaryActions = actionsByOrder[primaryDraftKey] || [];

  const groupInvoiceOrder = { ...primaryOrder, groupId: groupId || primaryOrder.order_group_id || primaryOrder.groupId };

  return (
    <PageContainer className="mt-4 order-details-page">
      <PageHeader kicker="Orders" title="Order details workspace" description="Edit products, status, payment, notes, invoices, timeline, and audit data in one place." />
      <OrderHeader group={{ groupId: groupId || primaryOrder.order_group_id || primaryOrder.groupId, customerName: primaryOrder.customer_name, customerId: primaryOrder.customer_id || primaryOrder.user_id }} onRefresh={loadWorkspace} onOpenList={goBackToList} />

      <div className="order-summary-grid">
        <AppCard title="Summary" subtitle="Current workspace totals">
          <div className="order-summary-stats">
            <div><span>Products</span><strong>{summary.items}</strong></div>
            <div><span>Total Cost</span><strong>{formatINR(summary.totalCost)}</strong></div>
            <div><span>Paid</span><strong>{formatINR(summary.totalPaid)}</strong></div>
            <div><span>Remaining</span><strong>{formatINR(summary.totalRemaining)}</strong></div>
          </div>
        </AppCard>
        <AppCard title="Order-level actions" subtitle="Workspace controls">
          <div className="order-workspace-actions">
            <ToolbarButton icon={<HiOutlineDocumentText />} onClick={() => generateInvoice(groupInvoiceOrder)}>Generate Invoice</ToolbarButton>
            <ToolbarButton icon={<HiOutlineDocumentText />} onClick={() => downloadInvoice(groupInvoiceOrder)}>Download PDF</ToolbarButton>
            <ToolbarButton icon={<HiOutlinePrinter />} onClick={() => printInvoice(groupInvoiceOrder)}>Print Invoice</ToolbarButton>
            <ToolbarButton icon={<HiOutlineEnvelope />} onClick={openMail}>Send Email</ToolbarButton>
            <ToolbarButton icon={<HiOutlineShare />} onClick={shareInvoice}>Share Invoice</ToolbarButton>
            <ToolbarButton icon={<HiOutlineArrowPath />} onClick={exportWorkspace}>Export</ToolbarButton>
            <ToolbarButton icon={<HiOutlineClock />} onClick={() => timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Timeline</ToolbarButton>
            <ToolbarButton icon={<HiOutlineDocumentText />} onClick={() => notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Notes</ToolbarButton>
            <ToolbarButton icon={<HiOutlineClock />} onClick={() => auditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Audit Logs</ToolbarButton>
            <ToolbarButton icon={<HiOutlineTrash />} variant="outline-danger" onClick={() => adminOrderAction({ order_id: primaryOrder.order_id, action: 'cancel' }).then(() => { setStatusMessage('Order cancelled'); loadWorkspace(); })}>Cancel Entire Order</ToolbarButton>
            <ToolbarButton icon={<HiOutlineArrowPath />} onClick={reopenOrder}>Reopen Order</ToolbarButton>
          </div>
        </AppCard>
      </div>

      <div className="order-workspace-grid order-item-list">
        {selectedOrders.map((order) => {
          const key = getOrderKey(order);
          const draft = drafts[key] || buildDraft(order);
          const actions = actionsByOrder[key] || [];
          return (
            <ProductCard
              key={key}
              order={order}
              draft={draft}
              onDraftChange={(field, value) => updateDraft(order, field, value)}
              onCommitQuantity={() => runQuantityUpdate(order, draft.quantity)}
              onSaveDiscount={() => saveDiscount(order)}
              onRemoveDiscount={() => removeDiscount(order)}
              onSavePayment={() => savePayment(order)}
              onSaveStatus={() => saveStatus(order)}
              onCancelProduct={() => cancelProduct(order)}
              onOpenInvoice={() => generateInvoice(order)}
              onOpenHistory={() => openHistory(order)}
              onApplyReject={(reason) => rejectProduct(order, reason)}
              onSaveAll={() => saveAll(order)}
            />
          );
        })}
      </div>

      <div className="order-bottom-panels">
        <AppCard title="Timeline" subtitle="Recent actions across the workspace" className="order-panel" actions={<span ref={timelineRef} />}>
          <Timeline actions={primaryActions.slice(0, 30)} />
        </AppCard>
        <AppCard title="Audit Log" subtitle="Who changed what and when" className="order-panel" actions={<span ref={auditRef} />}>
          <AuditLog actions={primaryActions.slice(0, 30)} />
        </AppCard>
        <AppCard title="Notes" subtitle="Workspace notes" className="order-panel" actions={<span ref={notesRef} />}>
          <NotesPanel draft={drafts[primaryDraftKey] || buildDraft(primaryOrder)} onDraftChange={(field, value) => updateDraft(primaryOrder, field, value)} onSave={saveNotes} />
        </AppCard>
      </div>

      {message && <div className="visually-hidden">{message}</div>}
    </PageContainer>
  );
};

export default OrderDetailsPage;
