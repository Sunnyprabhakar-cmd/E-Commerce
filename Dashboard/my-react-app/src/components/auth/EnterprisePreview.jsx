import { memo } from 'react';
import {
  HiOutlineBanknotes,
  HiOutlineClipboardDocumentList,
  HiOutlineCubeTransparent,
  HiOutlineUsers,
} from 'react-icons/hi2';

const desktopStats = [
  { label: 'Revenue', value: '₹48.2L', meta: '+12.4% MoM', icon: HiOutlineBanknotes, tone: 'blue' },
  { label: 'Orders', value: '128', meta: '18 pending', icon: HiOutlineClipboardDocumentList, tone: 'indigo' },
  { label: 'Inventory', value: '5,283 Items', meta: '412 low stock', icon: HiOutlineCubeTransparent, tone: 'cyan' },
  { label: 'Employees', value: '36 Online', meta: '2 approvals pending', icon: HiOutlineUsers, tone: 'emerald' },
];

const tabletStats = [desktopStats[0], desktopStats[1], desktopStats[2], desktopStats[3]];

const revenueSeries = [56, 62, 68, 64, 73, 79, 84, 90];
const activityRows = [
  { title: 'Invoice #INV-2048 approved', meta: 'Accounts • 3 min ago', status: 'Approved' },
  { title: 'Purchase order #PO-882 received', meta: 'Warehouse • 12 min ago', status: 'Received' },
  { title: 'Attendance synced', meta: 'HR • 18 min ago', status: 'Synced' },
];

const invoiceRows = [
  { id: 'INV-2048', client: 'Kohli Textiles', amount: '₹48,200' },
  { id: 'INV-2051', client: 'Northstar Traders', amount: '₹1.3L' },
  { id: 'INV-2054', client: 'Silverline Retail', amount: '₹82,750' },
];

const chartPath = revenueSeries
  .map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * 14 + 8} ${120 - value}`)
  .join(' ');

const areaPath = `${chartPath} L 106 120 L 8 120 Z`;

const MetricCard = memo(({ item }) => {
  const Icon = item.icon;

  return (
    <article className={`auth-metric-card tone-${item.tone}`}>
      <div className="auth-metric-icon" aria-hidden="true">
        <Icon />
      </div>
      <div>
        <span>{item.label}</span>
        <strong>{item.value}</strong>
        <small>{item.meta}</small>
      </div>
    </article>
  );
});

const EnterprisePreview = memo(({ mode }) => {
  const stats = mode === 'tablet' ? tabletStats : desktopStats;
  const isDesktop = mode === 'desktop';

  return (
    <div className={`auth-dashboard-mockup auth-dashboard-${mode}`}>
      <div className="auth-dashboard-topbar">
        <div>
          <div className="auth-preview-label">Live operations center</div>
          <strong>Commercial ERP dashboard preview</strong>
        </div>
        <div className="auth-dashboard-status">
          <span className="auth-live-dot" aria-hidden="true" />
          <span>Live</span>
        </div>
      </div>

      <div className="auth-metric-grid auth-metric-grid-four">
        {stats.map((item) => (
          <MetricCard key={item.label} item={item} />
        ))}
      </div>

      {isDesktop && (
        <div className="auth-dashboard-grid">
          <section className="auth-panel auth-chart-panel">
            <div className="auth-section-title">
              <span>Monthly Revenue</span>
              <strong>₹48.2L rolling trend</strong>
            </div>
            <svg className="auth-svg-chart" viewBox="0 0 120 132" role="img" aria-label="Monthly revenue chart">
              <defs>
                <linearGradient id="authRevenueArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(96, 165, 250, 0.7)" />
                  <stop offset="100%" stopColor="rgba(124, 58, 237, 0.08)" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#authRevenueArea)" />
              <path d={chartPath} fill="none" stroke="#60a5fa" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              {revenueSeries.map((value, index) => (
                <circle key={`${value}-${index}`} cx={index * 14 + 8} cy={120 - value} r="2.8" fill="#fff" stroke="#60a5fa" strokeWidth="2" />
              ))}
            </svg>
          </section>

          <section className="auth-panel auth-activity-panel">
            <div className="auth-section-title">
              <span>Recent Activity</span>
              <strong>Live operations feed</strong>
            </div>
            <div className="auth-timeline auth-timeline-compact">
              {activityRows.map((item) => (
                <div key={item.title} className="auth-timeline-row">
                  <div className="auth-timeline-marker" aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                  <div className="auth-status-chip status-live">{item.status}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="auth-panel auth-table-panel auth-table-panel-wide">
            <div className="auth-section-title">
              <span>Recent Invoices</span>
              <strong>Active billing queue</strong>
            </div>
            <div className="auth-table">
              {invoiceRows.map((invoice) => (
                <div key={invoice.id} className="auth-table-row">
                  <div>
                    <strong>{invoice.id}</strong>
                    <span>{invoice.client}</span>
                  </div>
                  <strong>{invoice.amount}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {!isDesktop && (
        <section className="auth-panel auth-table-panel-tablet">
          <div className="auth-section-title">
            <span>Recent Activity</span>
            <strong>Live operations feed</strong>
          </div>
          <div className="auth-timeline auth-timeline-compact">
            {activityRows.slice(0, 2).map((item) => (
              <div key={item.title} className="auth-timeline-row">
                <div className="auth-timeline-marker" aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
                <div className="auth-status-chip status-live">{item.status}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});

EnterprisePreview.displayName = 'EnterprisePreview';
MetricCard.displayName = 'MetricCard';

export default EnterprisePreview;
