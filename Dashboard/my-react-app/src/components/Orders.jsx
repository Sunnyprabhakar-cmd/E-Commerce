import { Fragment, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import api from '../api/client';
import invoiceLogoSrc from '../assets/logo.png';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';

const companyProfile = {
  name: 'PEARRYS FOOD PRODUCTS',
  tagline: 'HAJIPUR, VAISHALI',
};

const bankDetails = {
  bankName: import.meta.env.VITE_PERRYS_BANK_NAME || 'Bank of India',
  accountName: import.meta.env.VITE_PERRYS_ACCOUNT_NAME || 'PEARRYS FOOD PRODUCTS PVT. LTD.',
  accountNumber: import.meta.env.VITE_PERRYS_ACCOUNT_NUMBER || '465430110000114',
  ifsc: import.meta.env.VITE_PERRYS_BANK_IFSC || 'BKID0004654',
  branch: import.meta.env.VITE_PERRYS_BANK_BRANCH || 'HAJIPUR',
  upiId: import.meta.env.VITE_PERRYS_UPI_ID || '',
};

const overdueBankDetails = {
  bankName: import.meta.env.VITE_PERRYS_OVERDUE_BANK_NAME || bankDetails.bankName,
  accountName: import.meta.env.VITE_PERRYS_OVERDUE_ACCOUNT_NAME || bankDetails.accountName,
  accountNumber: import.meta.env.VITE_PERRYS_OVERDUE_ACCOUNT_NUMBER || bankDetails.accountNumber,
  ifsc: import.meta.env.VITE_PERRYS_OVERDUE_BANK_IFSC || bankDetails.ifsc,
  branch: import.meta.env.VITE_PERRYS_OVERDUE_BANK_BRANCH || bankDetails.branch,
  upiId: import.meta.env.VITE_PERRYS_OVERDUE_UPI_ID || bankDetails.upiId,
};

const moneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));

const sanitizeFilePart = (value) => String(value || 'Invoice')
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9._-]/g, '')
  .replace(/_+/g, '_') || 'Invoice';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildInvoiceNumber = (orderId) => `PI-${String(orderId || 0).padStart(6, '0')}`;

const getInvoiceNumber = (order) => order?.invoice_number || buildInvoiceNumber(order?.order_id || order?.tracking_id || order?.groupId || 0);

const getInvoiceTitle = (entity) => `Pearry's Ice Cream Invoice ${entity?.orders?.[0]?.invoice_number || entity?.invoice_number || entity?.groupId || getInvoiceNumber(entity)}`;

const getOrderKey = (order) => order.order_id || order.tracking_id || `${order.product_id}-${order.user_id}`;

const getOrderProductLabel = (order) => order.product_name || order.product?.name || (order.product_id ? `Product ${order.product_id}` : 'N/A');

const getPaymentStatus = (order) => {
  if (order.status === 'cancelled') {
    return 'Cancelled';
  }
  const payable = Number(order.payable_amount ?? (order.total_cost || 0));
  const paid = Number(order.amount_paid || 0);
  if (paid <= 0) {
    return 'Unpaid';
  }
  if (paid >= payable) {
    return 'Paid';
  }
  return 'Partial Paid';
};

const getDisplayRemaining = (order) => {
  if (order.remaining_amount !== undefined) {
    return Number(order.remaining_amount);
  }
  const payable = Number(order.payable_amount ?? (order.total_cost || 0));
  const paid = Number(order.amount_paid || 0);
  return Math.max(payable - paid, 0);
};

const getPaymentDueDate = (entity) => entity?.payment_due_at || entity?.payment_deadline_at || entity?.due_date || entity?.dueDate || null;

const getPaymentRoute = (entity) => {
  const dueDateValue = getPaymentDueDate(entity);
  const dueDate = dueDateValue ? new Date(dueDateValue) : null;
  const isOverdue = dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
  const selectedBank = isOverdue ? overdueBankDetails : bankDetails;

  return {
    selectedBank,
    dueDate,
    isOverdue,
    routeLabel: isOverdue ? 'Overdue payment route' : dueDate ? 'Before due date' : 'Standard payment route',
  };
};

const createHiddenInvoiceFrame = async (html) => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    document.body.removeChild(iframe);
    throw new Error('Unable to prepare invoice preview');
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  await new Promise((resolve) => setTimeout(resolve, 300));

  return { iframe, frameWindow, frameDocument };
};

const downloadPdfFromHtml = async (html, fileName) => {
  const { iframe, frameDocument } = await createHiddenInvoiceFrame(html);
  try {
    const target = frameDocument.querySelector('[data-invoice-root]');
    if (!target) {
      throw new Error('Invoice preview element was not created');
    }

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 1240,
    });
    const imgData = canvas.toDataURL('image/png');
    const pageWidth = 210;
    const pageHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    pdf.save(fileName);
  } finally {
    iframe.remove();
  }
};

const openPreviewWindow = async (html, title, previewWindow = null) => {
  const targetWindow = previewWindow || window.open('', '_blank', 'width=1280,height=1600');
  if (!targetWindow) {
    throw new Error('Unable to open invoice window. Check popup settings.');
  }

  targetWindow.document.open();
  targetWindow.document.write(html);
  targetWindow.document.close();
  targetWindow.document.title = title;

  await new Promise((resolve) => setTimeout(resolve, 300));
  return targetWindow;
};

const splitAmount = (value) => {
  const normalized = Number(value || 0);
  const whole = Math.floor(normalized);
  const fraction = Math.round((normalized - whole) * 100);
  return { whole, fraction };
};

const convertHundredsToWords = (value) => {
  const ones = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (value === 0) return 'Zero';

  const parts = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) {
    parts.push(`${ones[hundreds]} Hundred`);
  }

  if (remainder >= 20) {
    parts.push(tens[Math.floor(remainder / 10)] + (remainder % 10 ? ` ${ones[remainder % 10].toLowerCase()}` : ''));
  } else if (remainder >= 10) {
    parts.push(teens[remainder - 10]);
  } else if (remainder > 0) {
    parts.push(ones[remainder]);
  }

  return parts.join(' ').trim();
};

const integerToWords = (value) => {
  const scales = [
    { value: 1000000000, label: 'Billion' },
    { value: 1000000, label: 'Million' },
    { value: 1000, label: 'Thousand' },
    { value: 100, label: 'Hundred' },
  ];

  if (value === 0) return 'Zero';

  const chunks = [];
  let remaining = value;

  for (const scale of scales) {
    if (remaining >= scale.value) {
      const chunk = Math.floor(remaining / scale.value);
      remaining %= scale.value;
      chunks.push(`${convertHundredsToWords(chunk)} ${scale.label}`);
    }
  }

  if (remaining > 0) {
    chunks.push(convertHundredsToWords(remaining));
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
};

const amountInWords = (value) => {
  const { whole, fraction } = splitAmount(value);
  const rupeeWord = whole === 1 ? 'Rupee' : 'Rupees';
  const paiseWord = fraction === 1 ? 'Paisa' : 'Paise';
  if (fraction > 0) {
    return `${integerToWords(whole)} ${rupeeWord} and ${convertHundredsToWords(fraction)} ${paiseWord} only`;
  }
  return `${integerToWords(whole)} ${rupeeWord} only`;
};

const buildInvoicePdfFilename = (customerName, invoiceNumber) => `${sanitizeFilePart(customerName)}_${sanitizeFilePart(invoiceNumber)}.pdf`;

const buildQrDataUrl = async (payload) => QRCode.toDataURL(payload, {
  errorCorrectionLevel: 'M',
  margin: 1,
  width: 220,
});

const buildQrPayload = ({ invoiceNumber, customerName, amount, reference, route }) => {
  const bank = route.selectedBank;
  if (bank.upiId) {
    const params = new URLSearchParams({
      pa: bank.upiId,
      pn: bank.accountName || companyProfile.name,
      am: Number(amount || 0).toFixed(2),
      tn: `${companyProfile.name} ${invoiceNumber}`,
    });
    return `upi://pay?${params.toString()}`;
  }

  return [
    companyProfile.name,
    `Invoice: ${invoiceNumber}`,
    `Customer: ${customerName}`,
    `Amount: ${formatMoney(amount)}`,
    `Reference: ${reference}`,
    `Bank: ${bank.bankName}`,
    `Account: ${bank.accountName}`,
    `A/C No: ${bank.accountNumber}`,
    `IFSC: ${bank.ifsc}`,
    route.dueDate ? `Due date: ${route.dueDate.toLocaleString()}` : null,
    route.isOverdue ? 'Route: overdue payment bank' : 'Route: standard payment bank',
  ].filter(Boolean).join('\n');
};

const formatInvoiceDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }
  return date.toLocaleDateString('en-GB');
};

const getInvoiceIssueDate = (entity) => entity?.created_at || entity?.createdAt || entity?.order_date || entity?.issued_at || new Date().toISOString();

const renderInvoiceHtml = ({
  title,
  invoiceNumber,
  invoiceDate,
  customerName,
  customerId,
  paymentStatus,
  paymentMode,
  handledBy,
  items,
  subtotal,
  discountTotal,
  payableTotal,
  amountPaid,
  remainingAmount,
  invoiceTypeLabel,
  qrCodeDataUrl,
  selectedBank,
  routeLabel,
  notes,
  paidStatusText,
  dueDateText,
}) => {
  const bank = selectedBank || bankDetails;
  const rowHtml = items.map((item) => `
      <tr>
        <td class="item-name">${escapeHtml(item.productName)}</td>
        <td class="qty-cell">${escapeHtml(item.quantityLabel || `${item.quantity || 0} PCS`)}</td>
        <td class="rate-cell">${formatINR(item.unitPrice)}</td>
        <td class="disc-cell">${formatINR(item.discountAmount)}<span>${escapeHtml(item.discountPercentageText || '')}</span></td>
        <td class="amount-cell">${formatINR(item.payableAmount)}</td>
      </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1b1b1b;
      --muted: #666;
      --line: #6a8c2a;
      --panel: #fff;
      --accent: #6a8c2a;
      --accent-soft: #eef4de;
    }
    @page {
      size: A4;
      margin: 4mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #fff;
      color: var(--ink);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: Arial, Helvetica, sans-serif;
    }
    .invoice-shell {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      padding: 6mm 10mm 8mm;
      position: relative;
    }
    .no-print {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-bottom: 12px;
    }
    .action-btn {
      border: 0;
      border-radius: 999px;
      padding: 10px 16px;
      color: #fff;
      background: var(--accent);
      font-weight: 700;
      cursor: pointer;
    }
    .action-btn.secondary { background: #666; }
    .sheet {
      border: 1px solid #8a8a8a;
      padding: 0;
      min-height: 285mm;
    }
    .topline {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 6px 8px 2px;
      font-size: 12px;
      font-weight: 700;
    }
    .pill {
      border: 1px solid #b5b5b5;
      color: #666;
      padding: 1px 8px;
      font-size: 10px;
      background: #fff;
    }
    .brand-row {
      display: grid;
      grid-template-columns: 68px 1fr;
      align-items: center;
      gap: 12px;
      padding: 2px 8px 8px;
    }
    .brand-logo {
      width: 66px;
      height: 46px;
      object-fit: contain;
    }
    .brand-title {
      margin: 0;
      color: #5b8a13;
      font-size: 25px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    .brand-tagline {
      margin: 4px 0 0;
      color: #111;
      font-size: 11px;
      font-weight: 700;
    }
    .green-rule {
      height: 8px;
      background: #5b8a13;
      margin: 2px 8px 0;
    }
    .invoice-strip {
      display: flex;
      justify-content: space-between;
      padding: 8px 8px 6px;
      margin: 0 8px;
      font-size: 12px;
      font-weight: 700;
      border-bottom: 1px solid #7d9a35;
    }
    .billto {
      padding: 10px 8px 2px;
      font-size: 12px;
      font-weight: 700;
    }
    .customer-name {
      padding: 0 8px 8px;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
    }
    table {
      width: calc(100% - 16px);
      margin: 0 8px;
      border-collapse: collapse;
    }
    thead th {
      border-top: 1px solid #7d9a35;
      border-bottom: 1px solid #7d9a35;
      padding: 7px 5px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
    }
    tbody td {
      padding: 7px 5px;
      border-bottom: 1px solid #d0d0d0;
      font-size: 11px;
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: 0; }
    .item-name { width: 46%; }
    .qty-cell, .rate-cell, .disc-cell, .amount-cell { white-space: nowrap; }
    .disc-cell span { display: block; font-size: 9px; color: #666; }
    .summary-row {
      display: grid;
      grid-template-columns: 1fr 90px 120px;
      align-items: center;
      margin: 4px 8px 0;
      border-top: 2px solid #5b8a13;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 0;
    }
    .summary-row > div { padding: 0 4px; }
    .summary-row .center { text-align: center; }
    .summary-row .right { text-align: right; }
    .lower-grid {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 10px;
      padding: 6px 8px 0;
    }
    .lower-left, .lower-right {
      font-size: 11px;
      line-height: 1.35;
    }
    .bank-title, .terms h3, .words-title {
      margin: 0 0 4px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .terms {
      margin-top: 10px;
    }
    .terms ol {
      margin: 0;
      padding-left: 16px;
    }
    .lower-right .amount-line {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px solid #bcbcbc;
    }
    .lower-right .amount-line:last-child { border-bottom: 0; }
    .words-block {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: start;
      margin-top: 8px;
    }
    .words-value {
      text-align: right;
      font-size: 11px;
      line-height: 1.35;
      padding-top: 12px;
    }
    .qr-box {
      display: flex;
      justify-content: flex-end;
      padding-top: 8px;
    }
    .qr-box img {
      width: 78px;
      height: 78px;
      object-fit: contain;
    }
    .signature {
      text-align: right;
      font-size: 10px;
      font-weight: 700;
      padding: 4px 8px 6px;
      margin-top: 4px;
    }
    @media print {
      html, body {
        background: #fff;
      }
      @page {
        size: A4 portrait;
        margin: 3mm;
      }
      .invoice-shell {
        box-shadow: none;
        margin: 0;
        width: 210mm;
        min-height: auto;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .sheet {
        min-height: auto;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .topline,
      .brand-row,
      .invoice-strip,
      .billto,
      .customer-name,
      thead th,
      tbody td,
      .summary-row,
      .lower-grid,
      .signature {
        font-size: 90%;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-shell">
    <div class="no-print">
      <button class="action-btn secondary" onclick="window.print()">Print</button>
    </div>
    <div class="sheet">
      <div class="topline">
        <div>BILL OF SUPPLY</div>
        <div class="pill">ORIGINAL FOR RECIPIENT</div>
      </div>
      <div class="brand-row">
        <img class="brand-logo" src="${escapeHtml(invoiceLogoSrc)}" alt="Pearry's logo" />
        <div>
          <h1 class="brand-title">${escapeHtml(companyProfile.name)}</h1>
          <div class="brand-tagline">${escapeHtml(companyProfile.tagline)}</div>
        </div>
      </div>
      <div class="green-rule"></div>
      <div class="invoice-strip">
        <div><strong>Invoice No.:</strong> ${escapeHtml(invoiceNumber)}</div>
        <div><strong>Invoice Date:</strong> ${escapeHtml(formatInvoiceDate(invoiceDate))}</div>
      </div>
      <div class="billto">BILL TO</div>
      <div class="customer-name">${escapeHtml(customerName || 'Customer')}</div>
      <table>
        <thead>
          <tr>
            <th>ITEMS</th>
            <th>QTY.</th>
            <th>RATE</th>
            <th>DISC.</th>
            <th>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${rowHtml}
        </tbody>
      </table>
      <div class="summary-row">
        <div>SUBTOTAL</div>
        <div class="center">${escapeHtml(String(items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)))}</div>
        <div class="right">₹ ${formatMoney(subtotal)}</div>
      </div>
      <div class="lower-grid">
        <div class="lower-left">
          <div class="bank-title">BANK DETAILS</div>
          <div><strong>Name:</strong> ${escapeHtml(bank.accountName)}</div>
          <div><strong>IFSC Code:</strong> ${escapeHtml(bank.ifsc)}</div>
          <div><strong>Account No:</strong> ${escapeHtml(bank.accountNumber)}</div>
          <div><strong>Bank:</strong> ${escapeHtml(bank.bankName)}</div>
          <div><strong>Branch:</strong> ${escapeHtml(bank.branch)}</div>
          <div class="terms">
            <h3>TERMS AND CONDITIONS</h3>
            <ol>
              <li>Goods once sold will not be taken back or exchanged.</li>
              <li>All disputes are subject to ${escapeHtml(import.meta.env.VITE_PERRYS_JURISDICTION || 'HAJIPUR')} jurisdiction only.</li>
            </ol>
          </div>
        </div>
        <div class="lower-right">
          <div class="amount-line"><span>Total Amount</span><strong>₹ ${formatMoney(payableTotal)}</strong></div>
          <div class="amount-line"><span>Received Amount</span><strong>${escapeHtml(formatINR(amountPaid))}</strong></div>
          <div class="amount-line"><span>Previous Balance</span><strong>${escapeHtml(formatINR(Math.max(payableTotal - remainingAmount, 0)))}</strong></div>
          <div class="amount-line"><span>Current Balance</span><strong>${escapeHtml(formatINR(remainingAmount))}</strong></div>
          <div class="words-block">
            <div class="words-title">Total Amount (in words)</div>
            <div class="words-value">${escapeHtml(amountInWords(payableTotal))}</div>
          </div>
          <div class="qr-box">
            <img src="${escapeHtml(qrCodeDataUrl)}" alt="Invoice QR code" />
          </div>
        </div>
      </div>
      <div class="signature">AUTHORISED SIGNATORY FOR<br />${escapeHtml(companyProfile.name)}</div>
    </div>
  </div>
</body>
</html>`;
};

const createInvoiceMarkup = (order, qrCodeDataUrl, showActions = true) => {
  const invoiceNumber = getInvoiceNumber(order);
  const payableTotal = Number(order.payable_amount ?? order.total_cost ?? 0);
  const subtotal = Number(order.total_cost || 0);
  const discountTotal = Number(order.discount_amount || 0);
  const amountPaid = Number(order.amount_paid || 0);
  const remainingAmount = Number(order.remaining_amount ?? Math.max(payableTotal - amountPaid, 0));
  const route = getPaymentRoute(order);

  return renderInvoiceHtml({
    title: `Invoice ${invoiceNumber}`,
    invoiceNumber,
    invoiceDate: formatInvoiceDate(getInvoiceIssueDate(order)),
    customerName: order.customer_name || order.customer_email || 'Customer',
    customerId: order.user_id || order.customer_id || 'N/A',
    paymentStatus: getPaymentStatus(order),
    paymentMode: order.payment_mode || 'N/A',
    handledBy: order.last_action_by_user_name || order.last_action_by_user_phone || order.last_action_by_user_id || 'N/A',
    items: [
      {
        productName: getOrderProductLabel(order),
        productId: order.product_id || 'N/A',
        quantity: order.quantity || 0,
        quantityLabel: `${Number(order.quantity || 0)} PCS`,
        unitPrice: order.product_price || 0,
        totalCost: subtotal,
        discountAmount: discountTotal,
        discountPercentageText: Number(order.discount_percentage || 0) ? `(${Number(order.discount_percentage || 0)}%)` : '',
        payableAmount: payableTotal,
        amountPaid,
        remainingAmount,
      },
    ],
    subtotal,
    discountTotal,
    payableTotal,
    amountPaid,
    remainingAmount,
    invoiceTypeLabel: 'Order',
    qrCodeDataUrl,
    selectedBank: route.selectedBank,
    routeLabel: route.routeLabel,
    notes: order.payment_notes || 'Payment recorded for the selected order.',
    paidStatusText: getPaymentStatus(order),
    dueDateText: route.dueDate ? route.dueDate.toLocaleDateString() : '',
    showActions,
  });
};

const createGroupInvoiceMarkup = (group, qrCodeDataUrl, showActions = true) => {
  const invoiceNumber = group.orders?.[0]?.invoice_number || group.groupId;
  const subtotal = group.orders.reduce((sum, order) => sum + Number(order.total_cost || 0), 0);
  const discountTotal = group.orders.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0);
  const payableTotal = group.orders.reduce((sum, order) => sum + Number(order.payable_amount ?? (order.total_cost || 0)), 0);
  const amountPaid = Number(group.totalPaid || 0);
  const remainingAmount = Number(group.totalRemaining || 0);
  const route = getPaymentRoute(group.orders?.[0] || group);

  return renderInvoiceHtml({
    title: `Invoice ${invoiceNumber}`,
    invoiceNumber,
    invoiceDate: formatInvoiceDate(getInvoiceIssueDate(group.orders?.[0] || group)),
    customerName: group.customerName || 'Customer',
    customerId: group.customerId || 'N/A',
    paymentStatus: group.paymentStatus,
    paymentMode: group.paymentMode || 'N/A',
    handledBy: group.lastActionBy || 'N/A',
    items: group.orders.map((order) => ({
      productName: getOrderProductLabel(order),
      productId: order.product_id || 'N/A',
      quantity: order.quantity || 0,
      quantityLabel: `${Number(order.quantity || 0)} PCS`,
      unitPrice: order.product_price || 0,
      totalCost: Number(order.total_cost || 0),
      discountAmount: Number(order.discount_amount || 0),
      discountPercentageText: Number(order.discount_percentage || 0) ? `(${Number(order.discount_percentage || 0)}%)` : '',
      payableAmount: Number(order.payable_amount ?? (order.total_cost || 0)),
      amountPaid: Number(order.amount_paid || 0),
      remainingAmount: Number(order.remaining_amount ?? Math.max(Number(order.payable_amount ?? (order.total_cost || 0)) - Number(order.amount_paid || 0), 0)),
    })),
    subtotal,
    discountTotal,
    payableTotal,
    amountPaid,
    remainingAmount,
    invoiceTypeLabel: 'Group',
    qrCodeDataUrl,
    selectedBank: route.selectedBank,
    routeLabel: route.routeLabel,
    notes: 'Grouped order invoice.',
    paidStatusText: group.paymentStatus,
    dueDateText: route.dueDate ? route.dueDate.toLocaleDateString() : '',
    showActions,
  });
};

const buildInvoiceAssets = async (order, isGroup = false) => {
  const invoiceNumber = isGroup ? (order.orders?.[0]?.invoice_number || order.groupId) : getInvoiceNumber(order);
  const customerName = isGroup ? (order.customerName || 'Customer') : (order.customer_name || order.customer_email || 'Customer');
  const amount = isGroup ? Number(order.totalCost || 0) : Number(order.payable_amount ?? order.total_cost ?? 0);
  const route = getPaymentRoute(isGroup ? (order.orders?.[0] || order) : order);
  const payload = buildQrPayload({
    invoiceNumber,
    customerName,
    amount,
    reference: isGroup ? order.groupId : (order.order_id || order.tracking_id || ''),
    route,
  });

  return {
    invoiceNumber,
    qrCodeDataUrl: await buildQrDataUrl(payload),
    fileName: buildInvoicePdfFilename(customerName, invoiceNumber),
    route,
  };
};

const Orders = ({ onNavigate, userRole }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setMessageState] = useState('');
  const setMessage = (text) => {
    setMessageState(text);
    if (text) {
      notify(text);
    }
  };
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortField, setSortField] = useState('order_id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [orderScope, setOrderScope] = useState('active');
  const [paymentInputs, setPaymentInputs] = useState({});
  const [actionSelections, setActionSelections] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showCustomInvoice, setShowCustomInvoice] = useState(false);
  const [customInvoice, setCustomInvoice] = useState({
    customerName: '',
    invoiceTitle: 'Custom Invoice',
    details: '',
    amount: '',
    paymentMode: 'cash',
    reference: '',
    notes: '',
  });

  const adminView = userRole === 'admin';
  const fetchEndpoint = adminView ? '/orders' : '/orderDetail';

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get(fetchEndpoint);
      const items = Array.isArray(response.data?.orders) ? response.data.orders : [];
      setOrders(items);
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error loading orders';
      setMessage(errorMsg);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (order) => {
    try {
      await api.post('/cancelOrder', {
        product_id: order.product_id,
        order_id: order.order_id || order.tracking_id || null
      });
      setMessage('Order cancelled and wallet refunded successfully');
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error cancelling order';
      setMessage(errorMsg);
    }
  };

  const handleReorderOrder = async (order) => {
    try {
      await api.post('/addProductInCart', {
        product_id: order.product_id,
        quantity: order.quantity || 1,
      });
      setMessage('Cancelled order added to cart for reorder');
      onNavigate && onNavigate('cart');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error reordering cancelled item';
      setMessage(errorMsg);
    }
  };

  const handleReorderGroup = async (group) => {
    try {
      for (const order of group.orders.filter((o) => o.status === 'cancelled')) {
        await api.post('/addProductInCart', {
          product_id: order.product_id,
          quantity: order.quantity || 1,
        });
      }
      setMessage('Cancelled group items added to cart for reorder');
      onNavigate && onNavigate('cart');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error reordering cancelled group';
      setMessage(errorMsg);
    }
  };

  const handleAdminOrderAction = async (order, action) => {
    try {
      const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
      const response = await api.post('/admin/orderAction', {
        order_id: orderId,
        action,
      });
      setMessage(response.data?.message || `Order ${action}d successfully`);
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || `Error ${action}ing order`;
      setMessage(errorMsg);
    }
  };

  const setPaymentInput = (orderId, field, value) => {
    setPaymentInputs((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  const setActionSelection = (orderId, value) => {
    setActionSelections((prev) => ({
      ...prev,
      [orderId]: value,
    }));
  };

  const handleApplyAction = async (order) => {
    const key = getOrderKey(order);
    const selection = actionSelections[key];
    if (!selection) {
      setMessage('Select an admin action first');
      return;
    }
    await handleAdminOrderAction(order, selection);
  };

  const [orderActions, setOrderActions] = useState({});

  const handleCollectPayment = async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    const key = getOrderKey(order);
    const inputs = paymentInputs[key] || {};
    const amount = Number(inputs.amount || 0);
    if (!amount || amount <= 0) {
      setMessage('Enter a valid payment amount');
      return;
    }
    try {
      const response = await api.post('/admin/orderAction', {
        order_id: orderId,
        action: 'collect_payment',
        amount_received: amount,
        payment_mode: inputs.mode || 'cash',
        payment_reference: inputs.reference || null,
        payment_notes: inputs.notes || `Partial payment for order ${order.order_id || order.tracking_id}`,
      });
      setMessage(response.data?.message || 'Payment updated successfully');
      setPaymentInputs((prev) => ({ ...prev, [key]: {} }));
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error recording payment';
      setMessage(errorMsg);
    }
  };

  const handleAdjustQuantity = async (order, delta) => {
    try {
      const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
      const response = await api.post('/admin/orderAction', {
        order_id: orderId,
        action: delta > 0 ? 'increase_qty' : 'decrease_qty',
      });
      setMessage(response.data?.message || 'Quantity updated successfully');
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error updating quantity';
      setMessage(errorMsg);
    }
  };

  const handleApplyOrderDiscount = async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    const key = getOrderKey(order);
    const inputs = paymentInputs[key] || {};
    const discount = Number(inputs.discount || 0);
    if (Number.isNaN(discount) || discount < 0 || discount > 100) {
      setMessage('Enter a valid discount percentage between 0 and 100');
      return;
    }
    try {
      const response = await api.post('/admin/orderAction', {
        order_id: orderId,
        action: 'apply_discount',
        discount_percentage: discount,
      });
      setMessage(response.data?.message || 'Discount applied successfully');
      setPaymentInputs((prev) => ({ ...prev, [key]: { ...prev[key], discount: '' } }));
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error applying discount';
      setMessage(errorMsg);
    }
  };

  const fetchOrderActionHistory = async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    if (!orderId) {
      return;
    }
    try {
      const response = await api.get(`/admin/orderActions/${orderId}`);
      setOrderActions((prev) => ({ ...prev, [orderId]: response.data?.actions || [] }));
    } catch (err) {
      console.warn('Unable to fetch order action history', err);
    }
  };

  const toggleOrderHistory = async (order) => {
    const orderId = order.order_id || order.tracking_id;
    if (!orderId) return;
    if (!orderActions[orderId]) {
      await fetchOrderActionHistory(order);
    }
    setOrderActions((prev) => ({ ...prev, [orderId]: prev[orderId] || [] }));
  };

  const handleGenerateGroupInvoice = async (group) => {
    const previewWindow = window.open('', '_blank', 'width=1280,height=1600');
    if (!previewWindow) {
      setMessage('Unable to open invoice window. Check popup settings.');
      return;
    }
    previewWindow.document.write('<!doctype html><html><head><title>Loading invoice...</title><style>body{font-family:Arial,sans-serif;padding:24px;text-align:center;}</style></head><body>Preparing invoice...</body></html>');
    try {
      const assets = await buildInvoiceAssets(group, true);
      const html = createGroupInvoiceMarkup(group, assets.qrCodeDataUrl, true);
      await openPreviewWindow(html, getInvoiceTitle(group), previewWindow);
    } catch (error) {
      previewWindow.close();
      setMessage(error.message || 'Unable to open invoice window. Check popup settings.');
    }
  };

  const handleDownloadGroupInvoice = async (group) => {
    try {
      const assets = await buildInvoiceAssets(group, true);
      const html = createGroupInvoiceMarkup(group, assets.qrCodeDataUrl, false);
      await downloadPdfFromHtml(html, assets.fileName);
    } catch (error) {
      setMessage(error.message || 'Unable to download invoice PDF');
    }
  };

  const handleOpenGroupDetails = async (group) => {
    await handleGenerateGroupInvoice(group);
  };

  const handleCancelGroup = async (group) => {
    try {
      await api.post('/cancelOrder', {
        order_id: group.groupId,
      });
      setMessage('Group order cancelled successfully');
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error cancelling group order';
      setMessage(errorMsg);
    }
  };

  const handleCollectPaymentGroup = async (group) => {
    const key = group.groupId;
    const inputs = paymentInputs[key] || {};
    const amount = Number(inputs.amount || 0);
    if (!amount || amount <= 0) {
      setMessage('Enter a valid group payment amount');
      return;
    }
    try {
      const response = await api.post('/admin/orderAction', {
        order_id: group.groupId,
        action: 'collect_payment',
        amount_received: amount,
        payment_mode: inputs.mode || 'cash',
        payment_reference: inputs.reference || null,
        payment_notes: inputs.notes || `Partial payment for group ${group.groupId}`,
      });
      setMessage(response.data?.message || 'Group payment updated successfully');
      setPaymentInputs((prev) => ({ ...prev, [key]: {} }));
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error recording group payment';
      setMessage(errorMsg);
    }
  };

  const handleGenerateInvoice = async (order) => {
    const previewWindow = window.open('', '_blank', 'width=1280,height=1600');
    if (!previewWindow) {
      setMessage('Unable to open invoice window. Check popup settings.');
      return;
    }
    previewWindow.document.write('<!doctype html><html><head><title>Loading invoice...</title><style>body{font-family:Arial,sans-serif;padding:24px;text-align:center;}</style></head><body>Preparing invoice...</body></html>');
    try {
      const assets = await buildInvoiceAssets(order, false);
      const html = createInvoiceMarkup(order, assets.qrCodeDataUrl, true);
      await openPreviewWindow(html, getInvoiceTitle(order), previewWindow);
    } catch (error) {
      previewWindow.close();
      setMessage(error.message || 'Unable to open invoice window. Check popup settings.');
    }
  };

  const handleDownloadInvoice = async (order) => {
    try {
      const assets = await buildInvoiceAssets(order, false);
      const html = createInvoiceMarkup(order, assets.qrCodeDataUrl, false);
      await downloadPdfFromHtml(html, assets.fileName);
    } catch (error) {
      setMessage(error.message || 'Unable to download invoice PDF');
    }
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

  const exportOrdersToCSV = () => {
    const headers = [
      'Order Group ID',
      'Invoice Number',
      'Order ID',
      'Product Name',
      'Product ID',
      'Customer',
      'Customer ID',
      'Quantity',
      'Unit Price',
      'Total Cost',
      'Status',
      'Payment Status',
      'Amount Paid',
      'Remaining',
      'Payment Mode',
      'Handled By',
    ];
    const rows = filteredOrders.map((order) => {
      const displayRemaining = getDisplayRemaining(order);
      return [ 
        order.order_group_id || order.order_id || order.tracking_id || '',
        getInvoiceNumber(order),
        order.order_id || order.tracking_id || '',
        getOrderProductLabel(order),
        order.product_id || '',
        order.customer_name || order.customer_email || '',
        order.user_id || '',
        order.quantity || 0,
        Number(order.product_price || 0).toFixed(2),
        Number(order.total_cost || 0).toFixed(2),
        order.status || '',
        getPaymentStatus(order),
        Number(order.amount_paid || 0).toFixed(2),
        displayRemaining.toFixed(2),
        order.payment_mode || '',
        order.last_action_by_user_name || order.last_action_by_user_phone || '',
      ];
    });
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile('orders.csv', csvContent, 'text/csv;charset=utf-8;');
  };

  const exportOrdersToDoc = () => {
    const rows = filteredOrders.map((order) => {
      const displayRemaining = getDisplayRemaining(order);
      return `
        <tr>
          <td>${order.order_group_id || order.order_id || order.tracking_id || ''}</td>
          <td>${getInvoiceNumber(order)}</td>
          <td>${order.order_id || order.tracking_id || ''}</td>
          <td>${getOrderProductLabel(order)}</td>
          <td>${order.product_id || ''}</td>
          <td>${order.customer_name || order.customer_email || ''}</td>
          <td>${order.user_id || ''}</td>
          <td>${order.quantity || 0}</td>
          <td>${Number(order.product_price || 0).toFixed(2)}</td>
          <td>${Number(order.total_cost || 0).toFixed(2)}</td>
          <td>${order.status || ''}</td>
          <td>${getPaymentStatus(order)}</td>
          <td>${Number(order.amount_paid || 0).toFixed(2)}</td>
          <td>${displayRemaining.toFixed(2)}</td>
          <td>${order.payment_mode || ''}</td>
          <td>${order.last_action_by_user_name || order.last_action_by_user_phone || ''}</td>
        </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Export</title></head><body><table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Order Group ID</th><th>Invoice Number</th><th>Order ID</th><th>Product Name</th><th>Product ID</th><th>Customer</th><th>Customer ID</th><th>Quantity</th><th>Unit Price</th><th>Total Cost</th><th>Status</th><th>Payment Status</th><th>Amount Paid</th><th>Remaining</th><th>Payment Mode</th><th>Handled By</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    downloadFile('orders.doc', html, 'application/msword');
  };

  const printOrders = () => {
    window.print();
  };

  useEffect(() => {
    fetchOrders();
  }, [userRole]);

  const filteredOrders = useMemo(() => {
    const normalizedCustomerFilter = customerFilter.trim().toLowerCase();
    const normalizedDateFilter = orderDateFilter.trim();

    return [...orders]
      .filter((order) => {
        const orderStatus = String(order.status || '').toLowerCase();
        const isCancelled = orderStatus === 'cancelled';

        if (orderScope === 'active' && isCancelled) {
          return false;
        }
        if (orderScope === 'cancelled' && !isCancelled) {
          return false;
        }

        if (statusFilter !== 'all') {
          const paymentStatus = getPaymentStatus(order).toLowerCase().replace(' ', '_');
          if (statusFilter === 'paid' && paymentStatus !== 'paid') return false;
          if (statusFilter === 'unpaid' && paymentStatus !== 'unpaid') return false;
          if (statusFilter === 'partial' && paymentStatus !== 'partial_paid') return false;
          if (statusFilter === 'cancelled' && paymentStatus !== 'cancelled') return false;
        }

        if (normalizedDateFilter) {
          const createdDate = order.created_at ? String(order.created_at).slice(0, 10) : '';
          if (createdDate !== normalizedDateFilter) {
            return false;
          }
        }

        if (!normalizedCustomerFilter) {
          return true;
        }

        const candidate = [
          order.customer_name,
          order.customer_email,
          order.user_id,
          order.product_id,
          order.product_name,
        ]
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
  }, [orders, statusFilter, customerFilter, sortField, sortDirection, orderDateFilter, orderScope]);

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
      const paymentStatus = allCancelled
        ? 'Cancelled'
        : allPaid
          ? 'Paid'
          : anyPaid
            ? 'Partial Paid'
            : 'Unpaid';
      return {
        ...group,
        paymentStatus,
        paymentMode: group.paymentModes.size === 1 ? [...group.paymentModes][0] : (group.paymentModes.size > 1 ? 'Multiple' : 'N/A'),
      };
    });
  }, [filteredOrders]);

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

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
  }, [orderGroups]);

  if (loading) {
    return <div className="text-center mt-5">Loading orders...</div>;
  }

  return (
    <div className="container mt-5">
      <div className="mb-3 d-flex flex-wrap gap-2">
        <button className="btn btn-secondary" onClick={() => onNavigate && onNavigate('list')}>
          Back to Products
        </button>
        <button className="btn btn-outline-primary" onClick={fetchOrders}>
          Refresh
        </button>
        {adminView && (
          <>
            <button className="btn btn-outline-success" onClick={exportOrdersToCSV}>
              Export Excel
            </button>
            <button className="btn btn-outline-info" onClick={exportOrdersToDoc}>
              Export Word
            </button>
            <button className="btn btn-outline-secondary" onClick={printOrders}>
              Print / PDF
            </button>
                    <select
              className="form-select"
              style={{ maxWidth: '180px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All payments</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              className="form-select"
              style={{ maxWidth: '220px' }}
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
            >
              <option value="order_id">Order ID</option>
              <option value="customer_id">Customer ID</option>
              <option value="customer_name">Customer name</option>
            </select>
            <button
              className="btn btn-outline-secondary"
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            >
              Sort {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
            <input
              type="text"
              className="form-control"
              style={{ minWidth: '220px' }}
              placeholder="Filter by customer id or name"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            />
            <input
              type="date"
              className="form-control"
              style={{ minWidth: '180px' }}
              value={orderDateFilter}
              onChange={(e) => setOrderDateFilter(e.target.value)}
            />
            <div className="btn-group" role="group" aria-label="Order scope switch">
              <button className={`btn btn-sm ${orderScope === 'active' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setOrderScope('active')}>
                Active
              </button>
              <button className={`btn btn-sm ${orderScope === 'cancelled' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setOrderScope('cancelled')}>
                Cancelled
              </button>
            </div>
          </>
        )}
      </div>

      <h2>{adminView ? 'All Orders' : 'My Orders'}</h2>
      {adminView && orderScope === 'cancelled' && (
        <div className="alert alert-warning">You are viewing cancelled orders only.</div>
      )}

      {adminView && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h3 className="h5 mb-1">Custom invoice</h3>
              <p className="text-muted mb-0">Create a one-off invoice with a manual name, details, and amount.</p>
            </div>
            <button className="btn btn-outline-primary" type="button" onClick={() => setShowCustomInvoice((prev) => !prev)}>
              {showCustomInvoice ? 'Hide custom invoice' : 'Create custom invoice'}
            </button>
          </div>
          {showCustomInvoice && (
            <div className="card-body border-top">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Customer name</label>
                  <input className="form-control" value={customInvoice.customerName} onChange={(e) => setCustomInvoice((prev) => ({ ...prev, customerName: e.target.value }))} placeholder="Enter customer name" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Invoice title</label>
                  <input className="form-control" value={customInvoice.invoiceTitle} onChange={(e) => setCustomInvoice((prev) => ({ ...prev, invoiceTitle: e.target.value }))} placeholder="Custom Invoice" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Amount</label>
                  <input className="form-control" type="number" min="0" step="0.01" value={customInvoice.amount} onChange={(e) => setCustomInvoice((prev) => ({ ...prev, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Invoice details</label>
                  <textarea className="form-control" rows="3" value={customInvoice.details} onChange={(e) => setCustomInvoice((prev) => ({ ...prev, details: e.target.value }))} placeholder="Write the invoice description or note" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Additional notes</label>
                  <textarea className="form-control" rows="3" value={customInvoice.notes} onChange={(e) => setCustomInvoice((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional notes" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Payment mode</label>
                  <select className="form-select" value={customInvoice.paymentMode} onChange={(e) => setCustomInvoice((prev) => ({ ...prev, paymentMode: e.target.value }))}>
                    <option value="cash">Cash</option>
                    <option value="wallet">Wallet</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Reference</label>
                  <input className="form-control" value={customInvoice.reference} onChange={(e) => setCustomInvoice((prev) => ({ ...prev, reference: e.target.value }))} placeholder="Invoice reference" />
                </div>
                <div className="col-md-4 d-flex align-items-end gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      const amount = Number(customInvoice.amount || 0);
                      if (!customInvoice.customerName.trim() || !amount || amount <= 0) {
                        setMessage('Enter customer name and a valid amount');
                        return;
                      }
                      const customOrder = {
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
                      };
                      const assets = await buildInvoiceAssets(customOrder, false);
                      const html = createInvoiceMarkup({ ...customOrder, payment_notes: customInvoice.notes || customInvoice.details }, assets.qrCodeDataUrl, false);
                      await openPreviewWindow(html, `Invoice ${customOrder.invoice_number}`);
                    }}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-success"
                    onClick={async () => {
                      const amount = Number(customInvoice.amount || 0);
                      if (!customInvoice.customerName.trim() || !amount || amount <= 0) {
                        setMessage('Enter customer name and a valid amount');
                        return;
                      }
                      const customOrder = {
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
                      };
                      const assets = await buildInvoiceAssets(customOrder, false);
                      const html = createInvoiceMarkup({ ...customOrder, payment_notes: customInvoice.notes || customInvoice.details }, assets.qrCodeDataUrl, false);
                      await downloadPdfFromHtml(html, assets.fileName);
                    }}
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="alert alert-warning">No orders found</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Order ID</th>
                {adminView && <th>Customer</th>}
                {adminView && <th>Customer ID</th>}
                <th>Product Name</th>
                <th>Product ID</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Cost</th>
                {adminView && <th>Discount</th>}
                {adminView && <th>Payable</th>}
                <th>Status</th>
                {adminView && <th>Payment Status</th>}
                {adminView && <th>Amount Paid</th>}
                {adminView && <th>Remaining</th>}
                {adminView && <th>Payment Mode</th>}
                {adminView && <th>Handled By</th>}
                {adminView && <th>Action</th>}
                {!adminView && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {orderGroups.map((group) => {
                const groupStatus = group.orders.length > 1 ? 'Grouped' : group.orders[0]?.status || 'N/A';

                return (
                  <Fragment key={group.groupId}>
                    <tr className="table-active">
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => {
                            const willExpand = !expandedGroups[group.groupId];
                            toggleGroupExpansion(group.groupId);
                            if (willExpand) {
                              handleOpenGroupDetails(group);
                            }
                          }}
                        >
                          {expandedGroups[group.groupId] ? 'Hide items' : 'Show items'}
                        </button>
                        <div className="mt-1 small text-muted">{group.groupId}</div>
                      </td>
                      {adminView && <td>{group.customerName}</td>}
                      {adminView && <td>{group.customerId}</td>}
                      <td>{group.orders.length} item{group.orders.length > 1 ? 's' : ''}</td>
                      <td>—</td>
                      <td>{group.totalQuantity}</td>
                      <td>—</td>
                      <td>{formatINR(group.originalCost)}</td>
                      {adminView && <td>—</td>}
                      {adminView && <td>{formatINR(group.totalCost)}</td>}
                      <td>{groupStatus}</td>
                      {adminView && <td>{group.paymentStatus}</td>}
                      {adminView && <td>{formatINR(group.totalPaid)}</td>}
                      {adminView && <td>{formatINR(group.totalRemaining)}</td>}
                      {adminView && <td>{group.paymentMode}</td>}
                      {adminView && <td>{group.lastActionBy}</td>}
                      <td>
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleGenerateGroupInvoice(group)}
                          >
                            Invoice
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleDownloadGroupInvoice(group)}
                          >
                            PDF
                          </button>
                          {adminView ? (
                            <>
                              {group.totalRemaining > 0 && (
                                <div className="d-flex gap-1 align-items-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control form-control-sm"
                                    style={{ width: '100px' }}
                                    placeholder="Amount"
                                    value={paymentInputs[group.groupId]?.amount || ''}
                                    onChange={(e) => setPaymentInput(group.groupId, 'amount', e.target.value)}
                                  />
                                  <select
                                    className="form-select form-select-sm"
                                    style={{ width: '110px' }}
                                    value={paymentInputs[group.groupId]?.mode || 'cash'}
                                    onChange={(e) => setPaymentInput(group.groupId, 'mode', e.target.value)}
                                  >
                                    <option value="cash">Cash</option>
                                    <option value="wallet">Wallet</option>
                                    <option value="upi">UPI</option>
                                    <option value="card">Card</option>
                                  </select>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleCollectPaymentGroup(group)}
                                  >
                                    Pay
                                  </button>
                                </div>
                              )}
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleCancelGroup(group)}
                              >
                                Cancel Group
                              </button>
                            </>
                          ) : group.orders.every((o) => o.status === 'cancelled') ? (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleReorderGroup(group)}
                            >
                              Reorder Group
                            </button>
                          ) : (
                            group.orders.some((o) => o.status !== 'cancelled') && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleCancelGroup(group)}
                              >
                                Cancel
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedGroups[group.groupId] && group.orders.map((order) => {
                      const rowKey = getOrderKey(order);
                      const displayRemaining = getDisplayRemaining(order);
                      const displayPaid = Number(order.amount_paid || 0);
                      const orderPaymentStatus = getPaymentStatus(order);

                      return (
                        <tr key={`${order.groupId || order.order_id}-${order.product_id || 'no-product'}`}>
                          <td>{order.order_id || order.tracking_id || 'N/A'}</td>
                          {adminView && <td>{order.customer_name || order.customer_email || 'N/A'}</td>}
                          {adminView && <td>{order.user_id || order.customer_id || 'N/A'}</td>}
                          <td>{getOrderProductLabel(order)}</td>
                          <td>{order.product_id}</td>
                          <td>{order.quantity}</td>
                          <td>{formatINR(Number(order.product_price || 0))}</td>
                          {adminView && <td>{Number(order.discount_amount || 0).toFixed(2)} ({Number(order.discount_percentage || 0).toFixed(0)}%)</td>}
                          {adminView && <td>{formatINR(Number(order.payable_amount ?? (order.total_cost || 0)))}</td>}
                          <td>{formatINR(Number(order.total_cost || 0))}</td>
                          <td>{order.status || 'N/A'}</td>
                          {adminView && <td>{orderPaymentStatus}</td>}
                            {adminView && <td>{formatINR(displayPaid)}</td>}
                            {adminView && <td>{formatINR(displayRemaining)}</td>}
                            {adminView && <td>{order.payment_mode || (displayRemaining > 0 ? 'unpaid' : 'N/A')}</td>}
                            {adminView && <td>{order.last_action_by_user_name || order.last_action_by_user_phone || order.last_action_by_user_id || 'N/A'}</td>}
                          {adminView && (
                            <td>
                              <div className="d-flex flex-column gap-2">
                                <div className="d-flex gap-1 flex-wrap">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => handleAdjustQuantity(order, -1)}
                                  >
                                    - Qty
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => handleAdjustQuantity(order, 1)}
                                  >
                                    + Qty
                                  </button>
                                </div>
                                <div className="d-flex gap-1 align-items-center flex-wrap">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    className="form-control form-control-sm"
                                    style={{ width: '90px' }}
                                    placeholder="Discount %"
                                    value={paymentInputs[rowKey]?.discount || ''}
                                    onChange={(e) => setPaymentInput(rowKey, 'discount', e.target.value)}
                                  />
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleApplyOrderDiscount(order)}
                                  >
                                    Apply
                                  </button>
                                </div>
                                {displayRemaining > 0 && order.status !== 'cancelled' && (
                                  <div className="d-flex gap-1 align-items-center flex-wrap">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="form-control form-control-sm"
                                      style={{ width: '90px' }}
                                      placeholder="Paid"
                                      value={paymentInputs[rowKey]?.amount || ''}
                                      onChange={(e) => setPaymentInput(rowKey, 'amount', e.target.value)}
                                    />
                                    <select
                                      className="form-select form-select-sm"
                                      style={{ width: '110px' }}
                                      value={paymentInputs[rowKey]?.mode || 'cash'}
                                      onChange={(e) => setPaymentInput(rowKey, 'mode', e.target.value)}
                                    >
                                      <option value="cash">Cash</option>
                                      <option value="wallet">Wallet</option>
                                      <option value="upi">UPI</option>
                                      <option value="card">Card</option>
                                    </select>
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleCollectPayment(order)}
                                    >
                                      Record
                                    </button>
                                  </div>
                                )}
                                <div className="d-flex gap-1 flex-wrap">
                                  <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => handleGenerateInvoice(order)}
                                  >
                                    Invoice
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => handleDownloadInvoice(order)}
                                  >
                                    PDF
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-info"
                                    onClick={() => fetchOrderActionHistory(order)}
                                  >
                                    History
                                  </button>
                                </div>
                                {orderActions[rowKey]?.length > 0 && (
                                  <div className="border rounded p-2 bg-light" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                    <div className="fw-bold mb-1">Recent actions</div>
                                    {orderActions[rowKey].slice(0, 4).map((action) => (
                                      <div key={action.action_id} className="small mb-1">
                                        <div><strong>{action.action_type}</strong> by {action.action_by_user_name || action.action_by_user_id || 'Unknown'}</div>
                                        <div>{action.action_note || action.action_metadata || ''}</div>
                                        <div className="text-muted">{new Date(action.created_at).toLocaleString()}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                          {!adminView && (
                            <td>
                              <div className="d-flex flex-wrap gap-2 align-items-center">
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => handleGenerateInvoice(order)}
                                >
                                  Invoice
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => handleDownloadInvoice(order)}
                                >
                                  PDF
                                </button>
                                {order.status === 'cancelled' ? (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleReorderOrder(order)}
                                  >
                                    Reorder
                                  </button>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleCancelOrder(order)}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Orders;
