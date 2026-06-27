import { useCallback, useEffect, useMemo, useState } from 'react';
import { addProductToCart as addOrderProductToCart, adminOrderAction, cancelOrder as cancelOrderService, fetchOrderActions as fetchOrderActionsService, fetchOrders as fetchOrdersService } from '../services/orderService';
import { getDisplayRemaining, getPaymentStatus } from '../utils/invoiceUtils';

const getOrderKey = (order) => order.order_id || order.tracking_id || `${order.product_id}-${order.user_id}`;

const useOrders = ({ userRole, onNavigate } = {}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortField, setSortField] = useState('order_id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [orderScope, setOrderScope] = useState('active');
  const [paymentInputs, setPaymentInputs] = useState({});
  const [actionSelections, setActionSelections] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [orderActions, setOrderActions] = useState({});

  const adminView = userRole === 'admin';
  const fetchEndpoint = adminView ? '/orders' : '/orderDetail';

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchOrdersService(fetchEndpoint);
      const items = Array.isArray(response.data?.orders) ? response.data.orders : [];
      setOrders(items);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [fetchEndpoint]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const resetOrderFilters = useCallback(() => {
    setStatusFilter('all');
    setCustomerFilter('');
    setSortField('order_id');
    setSortDirection('desc');
    setOrderDateFilter('');
    setOrderScope('active');
  }, []);

  const setPaymentInput = useCallback((orderId, field, value) => {
    setPaymentInputs((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  }, []);

  const setActionSelection = useCallback((orderId, value) => {
    setActionSelections((prev) => ({ ...prev, [orderId]: value }));
  }, []);

  const fetchOrderActionHistory = useCallback(async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    if (!orderId) return;
    try {
      const response = await fetchOrderActionsService(orderId);
      setOrderActions((prev) => ({ ...prev, [orderId]: response.data?.actions || [] }));
    } catch {
      setOrderActions((prev) => ({ ...prev, [orderId]: [] }));
    }
  }, []);

  const toggleOrderHistory = useCallback(async (order) => {
    const orderId = order.order_id || order.tracking_id;
    if (!orderId) return;
    if (!orderActions[orderId]) {
      await fetchOrderActionHistory(order);
    }
    setOrderActions((prev) => ({ ...prev, [orderId]: prev[orderId] || [] }));
  }, [fetchOrderActionHistory, orderActions]);

  const handleCancelOrder = useCallback(async (order) => {
    await cancelOrderService({
      product_id: order.product_id,
      order_id: order.order_id || order.tracking_id || null,
    });
    await fetchOrders();
  }, [fetchOrders]);

  const handleReorderOrder = useCallback(async (order) => {
    await addOrderProductToCart({ product_id: order.product_id, quantity: order.quantity || 1 });
    onNavigate && onNavigate('cart');
  }, [onNavigate]);

  const handleReorderGroup = useCallback(async (group) => {
    for (const order of group.orders.filter((item) => item.status === 'cancelled')) {
      await addOrderProductToCart({ product_id: order.product_id, quantity: order.quantity || 1 });
    }
    onNavigate && onNavigate('cart');
  }, [onNavigate]);

  const handleAdminOrderAction = useCallback(async (order, action) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    return adminOrderAction({ order_id: orderId, action });
  }, []);

  const handleApplyAction = useCallback(async (order) => {
    const key = getOrderKey(order);
    const selection = actionSelections[key];
    if (!selection) return null;
    return handleAdminOrderAction(order, selection);
  }, [actionSelections, handleAdminOrderAction]);

  const handleCollectPayment = useCallback(async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    const key = getOrderKey(order);
    const inputs = paymentInputs[key] || {};
    const amount = Number(inputs.amount || 0);
    return adminOrderAction({
      order_id: orderId,
      action: 'collect_payment',
      amount_received: amount,
      payment_mode: inputs.mode || 'cash',
      payment_reference: inputs.reference || null,
      payment_notes: inputs.notes || `Partial payment for order ${order.order_id || order.tracking_id}`,
    });
  }, [paymentInputs]);

  const handleAdjustQuantity = useCallback(async (order, delta) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    return adminOrderAction({
      order_id: orderId,
      action: delta > 0 ? 'increase_qty' : 'decrease_qty',
    });
  }, []);

  const handleApplyOrderDiscount = useCallback(async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    const key = getOrderKey(order);
    const inputs = paymentInputs[key] || {};
    const discount = Number(inputs.discount || 0);
    return adminOrderAction({
      order_id: orderId,
      action: 'apply_discount',
      discount_percentage: discount,
    });
  }, [paymentInputs]);

  const filteredOrders = useMemo(() => {
    const normalizedCustomerFilter = customerFilter.trim().toLowerCase();
    const normalizedDateFilter = orderDateFilter.trim();

    return [...orders]
      .filter((order) => {
        const orderStatus = String(order.status || '').toLowerCase();
        const isCancelled = orderStatus === 'cancelled';

        if (orderScope === 'active' && isCancelled) return false;
        if (orderScope === 'cancelled' && !isCancelled) return false;

        if (statusFilter !== 'all') {
          const paymentStatus = getPaymentStatus(order).toLowerCase().replace(' ', '_');
          if (statusFilter === 'paid' && paymentStatus !== 'paid') return false;
          if (statusFilter === 'unpaid' && paymentStatus !== 'unpaid') return false;
          if (statusFilter === 'partial' && paymentStatus !== 'partial_paid') return false;
          if (statusFilter === 'cancelled' && paymentStatus !== 'cancelled') return false;
        }

        if (normalizedDateFilter) {
          const createdDate = order.created_at ? String(order.created_at).slice(0, 10) : '';
          if (createdDate !== normalizedDateFilter) return false;
        }

        if (!normalizedCustomerFilter) return true;

        const candidate = [order.customer_name, order.customer_email, order.user_id, order.product_id, order.product_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return candidate.includes(normalizedCustomerFilter);
      })
      .sort((a, b) => {
        let left = '';
        let right = '';

        if (sortField === 'customer_name') {
          left = String(a.customer_name || a.customer_email || '');
          right = String(b.customer_name || b.customer_email || '');
        } else if (sortField === 'customer_id') {
          left = String(a.user_id || a.customer_id || '');
          right = String(b.user_id || b.customer_id || '');
        } else {
          left = String(a.order_id || a.tracking_id || '0');
          right = String(b.order_id || b.tracking_id || '0');
        }

        const compare = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? compare : -compare;
      });
  }, [customerFilter, orderDateFilter, orderScope, orders, sortDirection, sortField, statusFilter]);

  const orderGroups = useMemo(() => {
    const groups = {};
    filteredOrders.forEach((order) => {
      const groupId = order.order_group_id || String(order.order_id || order.tracking_id || `single-${Math.random()}`);
      if (!groups[groupId]) {
        groups[groupId] = {
          groupId,
          orders: [],
          originalCost: 0,
          totalCost: 0,
          totalPaid: 0,
          totalRemaining: 0,
          totalQuantity: 0,
          paymentModes: new Set(),
          customerName: order.customer_name || order.customer_email || 'N/A',
          customerId: order.user_id || order.customer_id || 'N/A',
          lastActionBy: order.last_action_by_user_name || order.last_action_by_user_phone || 'N/A',
        };
      }

      groups[groupId].orders.push(order);
      groups[groupId].originalCost += Number(order.total_cost || 0);
      groups[groupId].totalCost += Number(order.payable_amount ?? (order.total_cost || 0));
      groups[groupId].totalPaid += Number(order.amount_paid || 0);
      groups[groupId].totalRemaining += getDisplayRemaining(order);
      groups[groupId].totalQuantity += Number(order.quantity || 0);
      if (order.payment_mode) {
        groups[groupId].paymentModes.add(order.payment_mode);
      }
    });

    return Object.values(groups).map((group) => {
      const allPaid = group.orders.every((order) => Number(order.amount_paid || 0) >= Number(order.payable_amount ?? (order.total_cost || 0)) && order.status !== 'cancelled');
      const anyPaid = group.orders.some((order) => Number(order.amount_paid || 0) > 0);
      const allCancelled = group.orders.every((order) => order.status === 'cancelled');
      const paymentStatus = allCancelled ? 'Cancelled' : allPaid ? 'Paid' : anyPaid ? 'Partial Paid' : 'Unpaid';
      return {
        ...group,
        paymentStatus,
        paymentMode: group.paymentModes.size === 1 ? [...group.paymentModes][0] : (group.paymentModes.size > 1 ? 'Multiple' : 'N/A'),
      };
    });
  }, [filteredOrders]);

  const setGroupExpansion = useCallback((groupId, nextExpanded) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: nextExpanded }));
  }, []);

  useEffect(() => {
    const nextExpanded = {};
    orderGroups.forEach((group) => {
      if (group.orders.length > 1) {
        nextExpanded[group.groupId] = expandedGroups[group.groupId] ?? true;
      }
    });
    if (Object.keys(nextExpanded).length > 0) {
      setExpandedGroups((prev) => ({ ...nextExpanded, ...prev }));
    }
  }, [expandedGroups, orderGroups]);

  return {
    adminView,
    orders,
    loading,
    filteredOrders,
    orderGroups,
    statusFilter,
    setStatusFilter,
    customerFilter,
    setCustomerFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    orderDateFilter,
    setOrderDateFilter,
    orderScope,
    setOrderScope,
    paymentInputs,
    actionSelections,
    expandedGroups,
    orderActions,
    setPaymentInput,
    setActionSelection,
    setGroupExpansion,
    resetOrderFilters,
    fetchOrders,
    handleCancelOrder,
    handleReorderOrder,
    handleReorderGroup,
    handleAdminOrderAction,
    handleApplyAction,
    handleCollectPayment,
    handleAdjustQuantity,
    handleApplyOrderDiscount,
    fetchOrderActionHistory,
    toggleOrderHistory,
  };
};

export default useOrders;
