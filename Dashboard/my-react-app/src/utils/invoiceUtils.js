import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import invoiceLogoSrc from '../assets/logo.png';
import { formatINR } from './currency';

export const companyProfile = {
  name: 'PEARRYS FOOD PRODUCTS',
  tagline: 'HAJIPUR, VAISHALI',
};

export const bankDetails = {
  bankName: import.meta.env.VITE_PERRYS_BANK_NAME || 'Bank of India',
  accountName: import.meta.env.VITE_PERRYS_ACCOUNT_NAME || 'PEARRYS FOOD PRODUCTS PVT. LTD.',
  accountNumber: import.meta.env.VITE_PERRYS_ACCOUNT_NUMBER || '465430110000114',
  ifsc: import.meta.env.VITE_PERRYS_BANK_IFSC || 'BKID0004654',
  branch: import.meta.env.VITE_PERRYS_BANK_BRANCH || 'HAJIPUR',
  upiId: import.meta.env.VITE_PERRYS_UPI_ID || '',
};

export const overdueBankDetails = {
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

export const formatMoney = (value) => moneyFormatter.format(Number(value || 0));

export const sanitizeFilePart = (value) => String(value || 'Invoice')
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9._-]/g, '')
  .replace(/_+/g, '_') || 'Invoice';

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const buildInvoiceNumber = (orderId) => `PI-${String(orderId || 0).padStart(6, '0')}`;

export const getInvoiceNumber = (order) => order?.invoice_number || buildInvoiceNumber(order?.order_id || order?.tracking_id || order?.groupId || 0);

export const getInvoiceTitle = (entity) => `Pearry's Ice Cream Invoice ${entity?.orders?.[0]?.invoice_number || entity?.invoice_number || entity?.groupId || getInvoiceNumber(entity)}`;

export const getOrderProductLabel = (order) => order.product_name || order.product?.name || (order.product_id ? `Product ${order.product_id}` : 'N/A');

export const getPaymentStatus = (order) => {
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

export const getDisplayRemaining = (order) => {
  if (order.remaining_amount !== undefined) {
    return Number(order.remaining_amount);
  }
  const payable = Number(order.payable_amount ?? (order.total_cost || 0));
  const paid = Number(order.amount_paid || 0);
  return Math.max(payable - paid, 0);
};

const getPaymentDueDate = (entity) => entity?.payment_due_at || entity?.payment_deadline_at || entity?.due_date || entity?.dueDate || null;

export const getPaymentRoute = (entity) => {
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

export const createHiddenInvoiceFrame = async (html) => {
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

export const downloadPdfFromHtml = async (html, fileName) => {
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

export const openPreviewWindow = async (html, title, previewWindow = null) => {
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

export const splitAmount = (value) => {
  const normalized = Number(value || 0);
  const whole = Math.floor(normalized);
  const fraction = Math.round((normalized - whole) * 100);
  return { whole, fraction };
};

export const convertHundredsToWords = (value) => {
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

export const integerToWords = (value) => {
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

export const amountInWords = (value) => {
  const { whole, fraction } = splitAmount(value);
  const rupeeWord = whole === 1 ? 'Rupee' : 'Rupees';
  const paiseWord = fraction === 1 ? 'Paisa' : 'Paise';
  if (fraction > 0) {
    return `${integerToWords(whole)} ${rupeeWord} and ${convertHundredsToWords(fraction)} ${paiseWord} only`;
  }
  return `${integerToWords(whole)} ${rupeeWord} only`;
};

export const buildInvoicePdfFilename = (customerName, invoiceNumber) => `${sanitizeFilePart(customerName)}_${sanitizeFilePart(invoiceNumber)}.pdf`;

export const buildQrDataUrl = async (payload) => QRCode.toDataURL(payload, {
  errorCorrectionLevel: 'M',
  margin: 1,
  width: 220,
});

export const buildQrPayload = ({ invoiceNumber, customerName, amount, reference, route }) => {
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

export const formatInvoiceDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }
  return date.toLocaleDateString('en-GB');
};

export const getInvoiceIssueDate = (entity) => entity?.created_at || entity?.createdAt || entity?.order_date || entity?.issued_at || new Date().toISOString();

export const renderInvoiceHtml = ({
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
  <div class="invoice-shell" data-invoice-root>
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

export const createInvoiceMarkup = (order, qrCodeDataUrl, showActions = true) => {
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

export const createGroupInvoiceMarkup = (group, qrCodeDataUrl, showActions = true) => {
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

export const buildInvoiceAssets = async (order, isGroup = false) => {
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
