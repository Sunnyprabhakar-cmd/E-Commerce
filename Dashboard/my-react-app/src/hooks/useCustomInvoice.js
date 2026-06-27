import { useCallback, useState } from 'react';
import {
  buildInvoiceAssets,
  createInvoiceMarkup,
  downloadPdfFromHtml,
  openPreviewWindow,
} from '../utils/invoiceUtils';

const initialInvoice = {
  customerName: '',
  invoiceTitle: 'Custom Invoice',
  details: '',
  amount: '',
  paymentMode: 'cash',
  reference: '',
  notes: '',
};

const useCustomInvoice = () => {
  const [showCustomInvoice, setShowCustomInvoice] = useState(true);
  const [customInvoice, setCustomInvoice] = useState(initialInvoice);
  const [busy, setBusy] = useState(false);

  const setField = useCallback((field, value) => {
    setCustomInvoice((prev) => ({ ...prev, [field]: value }));
  }, []);

  const buildCustomOrder = useCallback((amount) => ({
    invoice_number: `CUSTOM-${Date.now()}`,
    customer_name: customInvoice.customerName.trim(),
    customer_email: '',
    user_id: customInvoice.reference || 'CUSTOM',
    total_cost: amount,
    payable_amount: amount,
    amount_paid: amount,
    remaining_amount: 0,
    payment_mode: customInvoice.paymentMode,
    payment_notes: customInvoice.notes || customInvoice.details || 'Custom invoice',
    status: 'paid',
    product_name: customInvoice.invoiceTitle || 'Custom Invoice',
    product_id: 'CUSTOM',
    quantity: 1,
    product_price: amount,
    discount_amount: 0,
    discount_percentage: 0,
    created_at: new Date().toISOString(),
  }), [customInvoice]);

  const handleAction = useCallback(async (mode) => {
    const amount = Number(customInvoice.amount || 0);
    if (!customInvoice.customerName.trim() || !amount || amount <= 0) {
      return { error: 'Enter customer name and a valid amount' };
    }

    setBusy(true);
    try {
      const customOrder = buildCustomOrder(amount);
      const assets = await buildInvoiceAssets(customOrder, false);
      const html = createInvoiceMarkup({ ...customOrder, payment_notes: customInvoice.notes || customInvoice.details }, assets.qrCodeDataUrl, mode !== 'download');

      if (mode === 'preview') {
        await openPreviewWindow(html, `Invoice ${customOrder.invoice_number}`);
      } else {
        await downloadPdfFromHtml(html, assets.fileName);
      }
      return { ok: true };
    } catch (error) {
      return { error: error.message || 'Unable to process custom invoice' };
    } finally {
      setBusy(false);
    }
  }, [buildCustomOrder, customInvoice]);

  const reset = useCallback(() => setCustomInvoice(initialInvoice), []);

  return {
    showCustomInvoice,
    setShowCustomInvoice,
    customInvoice,
    setField,
    setCustomInvoice,
    busy,
    buildCustomOrder,
    handleAction,
    reset,
  };
};

export default useCustomInvoice;
