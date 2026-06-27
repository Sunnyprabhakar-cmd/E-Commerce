import { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineArrowRight,
  HiOutlineBanknotes,
  HiOutlineBellAlert,
  HiOutlineBuildingOffice2,
  HiOutlineChartBar,
  HiOutlineChartBarSquare,
  HiOutlineClipboardDocumentList,
  HiOutlineCreditCard,
  HiOutlineCubeTransparent,
  HiOutlineDocumentText,
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineFingerPrint,
  HiOutlineGlobeAlt,
  HiOutlineLockClosed,
  HiOutlinePhone,
  HiOutlineQrCode,
  HiOutlineReceiptPercent,
  HiOutlineShieldCheck,
  HiOutlineSquaresPlus,
  HiOutlineTruck,
  HiOutlineUser,
  HiOutlineUserCircle,
  HiOutlineUsers,
  HiOutlineClock,
} from 'react-icons/hi2';
import { login, register } from '../services/authService';
import { notify } from '../utils/notify';

const platformBadges = ['Finance', 'Inventory', 'Sales', 'Purchase', 'GST', 'Warehouse', 'CRM', 'Payroll', 'Analytics', 'Barcode', 'QR Invoice'];

const previewStats = [
  { label: 'Revenue', value: '₹48.2L', meta: '+12.4% MoM', icon: HiOutlineBanknotes, tone: 'blue' },
  { label: 'Orders', value: '128', meta: '18 pending', icon: HiOutlineClipboardDocumentList, tone: 'indigo' },
  { label: 'Inventory', value: '5,283 Items', meta: '412 low stock', icon: HiOutlineCubeTransparent, tone: 'cyan' },
  { label: 'Warehouse', value: '4 Active', meta: '2 dispatch ready', icon: HiOutlineBuildingOffice2, tone: 'emerald' },
  { label: 'Purchase Orders', value: '18', meta: '7 awaiting approval', icon: HiOutlineTruck, tone: 'amber' },
  { label: 'Customer Payments', value: '₹3.1L', meta: '4 pending', icon: HiOutlineCreditCard, tone: 'violet' },
  { label: 'Employee Attendance', value: '36 Online', meta: '2 late check-ins', icon: HiOutlineUsers, tone: 'rose' },
  { label: 'Production', value: 'Running', meta: '3 line tasks active', icon: HiOutlineClock, tone: 'sky' },
  { label: 'Profit', value: '₹12.8L', meta: '+9.2% margin', icon: HiOutlineChartBar, tone: 'green' },
  { label: 'Cash Flow', value: '₹8.4L', meta: 'Projected 21 days', icon: HiOutlineChartBarSquare, tone: 'teal' },
  { label: 'Pending Payments', value: '₹3.1L', meta: '14 due', icon: HiOutlineBellAlert, tone: 'orange' },
  { label: 'Stock Alerts', value: '12', meta: '3 critical', icon: HiOutlineSquaresPlus, tone: 'red' },
];

const monthlyRevenue = [54, 58, 61, 63, 69, 72, 77, 80, 83, 88, 92, 98];
const weeklySales = [42, 51, 47, 66, 74, 79, 88];
const inventoryTrend = [86, 80, 75, 78, 70, 66, 61, 58];

const recentInvoices = [
  { id: 'INV-2048', client: 'Kohli Textiles', status: 'Paid', amount: '₹48,200' },
  { id: 'INV-2051', client: 'Northstar Traders', status: 'Due Today', amount: '₹1.3L' },
  { id: 'INV-2054', client: 'Silverline Retail', status: 'Partial', amount: '₹82,750' },
  { id: 'INV-2058', client: 'Prime Foods', status: 'Sent', amount: '₹64,900' },
];

const recentActivity = [
  { label: 'Invoice #INV-2048 approved', meta: 'Accounts • 3 min ago', badge: 'Approved' },
  { label: 'Purchase order #PO-882 received', meta: 'Warehouse • 12 min ago', badge: 'Received' },
  { label: 'Salary batch scheduled', meta: 'HR • Today 4:00 PM', badge: 'Queued' },
  { label: 'Customer reminder sent', meta: 'CRM • 1 hour ago', badge: 'Sent' },
];

const topProducts = [
  { name: 'Premium paper', volume: '1,240 units', share: '24%', tone: 'blue' },
  { name: 'Barcode labels', volume: '980 units', share: '19%', tone: 'violet' },
  { name: 'Industrial bolts', volume: '760 units', share: '15%', tone: 'emerald' },
];

const dashboardSignals = [
  { icon: HiOutlineShieldCheck, label: 'Secure Authentication' },
  { icon: HiOutlineFingerPrint, label: 'Role Based Access' },
  { icon: HiOutlineGlobeAlt, label: 'Cloud Backup' },
  { icon: HiOutlineReceiptPercent, label: 'GST Ready' },
  { icon: HiOutlineUsers, label: 'Multi User' },
  { icon: HiOutlineLockClosed, label: 'Enterprise Security' },
];

const authChannels = [
  { icon: HiOutlineEnvelope, label: 'Email login' },
  { icon: HiOutlinePhone, label: 'Phone login' },
  { icon: HiOutlineUserCircle, label: 'Invite-ready onboarding' },
];

const authFieldIds = {
  name: 'auth-name',
  emailOrPhone: 'auth-email-or-phone',
  phone: 'auth-phone',
  password: 'auth-password',
};

const Auth = ({ onLogin }) => {
  const rememberedEmail = typeof window !== 'undefined' ? localStorage.getItem('rememberedEmail') || '' : '';
  const [isLogin, setIsLogin] = useState(true);
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    emailOrPhone: rememberedEmail,
    phone: '',
    password: '',
  });

  const businessLine = useMemo(
    () => (isLogin
      ? 'Secure access for finance, operations, and control teams.'
      : 'Provision enterprise users with structured onboarding and access controls.'),
    [isLogin],
  );

  const validation = useMemo(() => {
    const nextErrors = {};
    if (!isLogin && formData.name.trim().length < 3) {
      nextErrors.name = 'Enter the full employee or administrator name.';
    }
    if (!formData.emailOrPhone.trim()) {
      nextErrors.emailOrPhone = 'Email or phone is required.';
    }
    if (!isLogin && !/^\+?[0-9][0-9\s()-]{7,}$/.test(formData.phone.trim())) {
      nextErrors.phone = 'Enter a valid mobile number with 8+ digits.';
    }
    if (formData.password.trim().length < 3) {
      nextErrors.password = 'Password must contain at least 8 characters.';
    }
    return nextErrors;
  }, [formData, isLogin]);

  const setMessage = (text, type = 'info') => {
    setStatusMessage(text);
    if (text) {
      notify(text, type);
    }
  };

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedEmail');
    if (remembered) {
      setFormData((current) => ({ ...current, emailOrPhone: remembered }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleBlur = (event) => {
    const { name } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
  };

  const handlePasswordKey = (event) => {
    setCapsLockOn(event.getModifierState('CapsLock'));
  };

  const isFieldInvalid = (fieldName) => Boolean((submitAttempted || touched[fieldName]) && validation[fieldName]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitAttempted(true);

    if (Object.keys(validation).length > 0) {
      setMessage('Please review the highlighted fields before continuing.', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = isLogin
        ? { email: formData.emailOrPhone, password: formData.password }
        : { name: formData.name, email: formData.emailOrPhone, phone: formData.phone, password: formData.password };

      const response = isLogin ? await login(payload) : await register(payload);
      setMessage(response.data.message || 'Success', 'success');

      if (isLogin && response.data.token) {
        localStorage.setItem('token', response.data.token);
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', formData.emailOrPhone);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
        onLogin();
      } else if (!isLogin) {
        setIsLogin(true);
        setFormData({ name: '', emailOrPhone: formData.emailOrPhone, phone: '', password: '' });
        setTouched({});
        setSubmitAttempted(false);
        setShowPassword(false);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Authentication failed. Please try again.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-art-panel" aria-label="ERP platform preview">
        <div className="auth-ambient auth-ambient-a" aria-hidden="true" />
        <div className="auth-ambient auth-ambient-b" aria-hidden="true" />
        <div className="auth-grid-overlay" aria-hidden="true" />

        <div className="auth-brand-block">
          <div className="auth-brand-badge" aria-hidden="true">
            <HiOutlineBuildingOffice2 />
          </div>

          <div className="auth-brand-copy">
            <div className="auth-kicker">Pearry ERP Enterprise Edition v4.2</div>
            <h1>Run finance, inventory, sales, purchases and HR from one unified ERP platform.</h1>
            <p>{businessLine}</p>
            <div className="auth-channel-row" aria-label="Supported access channels">
              {authChannels.map((channel) => {
                const Icon = channel.icon;
                return (
                  <span key={channel.label} className="auth-channel-chip">
                    <Icon aria-hidden="true" />
                    {channel.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="auth-badge-row" role="list" aria-label="Platform features">
          {platformBadges.map((badge) => (
            <span key={badge} className="auth-badge-pill" role="listitem">
              {badge}
            </span>
          ))}
        </div>

        <div className="auth-dashboard-mockup">
          <div className="auth-dashboard-topbar">
            <div>
              <div className="auth-preview-label">Live operations center</div>
              <strong>Commercial ERP dashboard preview</strong>
            </div>
            <div className="auth-dashboard-status">
              <span className="auth-live-dot" aria-hidden="true" />
              <span>12 live alerts</span>
            </div>
          </div>

          <div className="auth-metric-grid">
            {previewStats.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className={`auth-metric-card tone-${item.tone}`}>
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
            })}
          </div>

          <div className="auth-analytics-grid">
            <section className="auth-panel auth-chart-panel auth-chart-panel-wide">
              <div className="auth-section-title">
                <span>Monthly Revenue</span>
                <strong>₹48.2L rolling trend</strong>
              </div>
              <div className="auth-chart">
                {monthlyRevenue.map((bar, index) => (
                  <div key={`rev-${bar}-${index}`} className="auth-chart-column" style={{ '--column-index': index }}>
                    <div className="auth-chart-bar revenue" style={{ height: `${bar}%` }} />
                    <span>{index + 1}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="auth-panel auth-chart-panel">
              <div className="auth-section-title">
                <span>Weekly Sales</span>
                <strong>128 orders closed</strong>
              </div>
              <div className="auth-mini-bars">
                {weeklySales.map((value, index) => (
                  <div key={`sales-${index}`} className="auth-mini-bar-row">
                    <span>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</span>
                    <div className="auth-mini-bar-track">
                      <div className="auth-mini-bar-fill sales" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="auth-panel auth-trend-panel">
              <div className="auth-section-title">
                <span>Inventory Trend</span>
                <strong>Warehouse stability in motion</strong>
              </div>
              <div className="auth-spark-grid">
                {inventoryTrend.map((value, index) => (
                  <div key={`stock-${index}`} className="auth-spark-column">
                    <div className="auth-spark-track">
                      <div className="auth-spark-fill" style={{ height: `${value}%` }} />
                    </div>
                    <span>{index + 1}</span>
                  </div>
                ))}
              </div>
              <div className="auth-alert-stack">
                <div>
                  <strong>Low Stock Alerts</strong>
                  <span>12 items require replenishment today.</span>
                </div>
                <div className="auth-alert-pill">3 critical</div>
              </div>
            </section>
          </div>

          <div className="auth-bottom-grid">
            <section className="auth-panel auth-table-panel">
              <div className="auth-section-title">
                <span>Recent Invoices</span>
                <strong>Active billing queue</strong>
              </div>
              <div className="auth-table">
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="auth-table-row">
                    <div>
                      <strong>{invoice.id}</strong>
                      <span>{invoice.client}</span>
                    </div>
                    <div className={`auth-status-chip status-${invoice.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {invoice.status}
                    </div>
                    <strong>{invoice.amount}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="auth-panel auth-timeline-panel">
              <div className="auth-section-title">
                <span>Recent Activities</span>
                <strong>Live operations feed</strong>
              </div>
              <div className="auth-timeline">
                {recentActivity.map((item) => (
                  <div key={item.label} className="auth-timeline-row">
                    <div className="auth-timeline-marker" aria-hidden="true" />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.meta}</span>
                    </div>
                    <div className="auth-status-chip status-live">{item.badge}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="auth-panel auth-products-panel">
              <div className="auth-section-title">
                <span>Top Selling Products</span>
                <strong>Fast movers this month</strong>
              </div>
              <div className="auth-product-list">
                {topProducts.map((product) => (
                  <div key={product.name} className="auth-product-row">
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.volume}</span>
                    </div>
                    <div className="auth-product-share">
                      <span>{product.share}</span>
                      <div className="auth-product-track">
                        <div className={`auth-product-fill tone-${product.tone}`} style={{ width: product.share }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <aside className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-brand-line">
            <div className="auth-brand-mark" aria-hidden="true">
              PE
            </div>
            <div>
              <div className="auth-company-name">Pearry ERP Enterprise</div>
              <div className="auth-company-subtitle">Commercial Operations Platform</div>
            </div>
            <div className="auth-version-chip">Enterprise Edition v4.2</div>
          </div>

          <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <button type="button" className={`auth-mode-btn ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)} aria-pressed={isLogin}>
              Login
            </button>
            <button type="button" className={`auth-mode-btn ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)} aria-pressed={!isLogin}>
              Register
            </button>
          </div>

          <div className="auth-card-header">
            <div className="auth-card-kicker">{isLogin ? 'Secure enterprise access' : 'Provision a business user'}</div>
            <h2>{isLogin ? 'Sign in to the ERP control plane' : 'Register a commercial workspace user'}</h2>
            <p>{isLogin ? 'Use your email or phone number to access the operational suite.' : 'Create a user that can be assigned to finance, inventory, HR, or operations.'}</p>
          </div>

          {statusMessage && (
            <div className="auth-status-banner" role="status" aria-live="polite">
              {statusMessage}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {!isLogin && (
              <div className="auth-field-group">
                <label className="auth-label" htmlFor={authFieldIds.name}>
                  Full name
                </label>
                <div className={`auth-field ${isFieldInvalid('name') ? 'invalid' : ''} ${!validation.name && touched.name ? 'valid' : ''}`}>
                  <span className="auth-field-icon" aria-hidden="true">
                    <HiOutlineUser />
                  </span>
                  <input
                    id={authFieldIds.name}
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Aarav Mehta"
                    aria-invalid={isFieldInvalid('name')}
                    aria-describedby={isFieldInvalid('name') ? 'auth-name-error' : undefined}
                    required
                  />
                </div>
                {isFieldInvalid('name') && (
                  <div className="auth-field-feedback" id="auth-name-error">
                    {validation.name}
                  </div>
                )}
              </div>
            )}

            <div className="auth-field-group">
              <label className="auth-label" htmlFor={authFieldIds.emailOrPhone}>
                Email / Phone
              </label>
              <div className={`auth-field ${isFieldInvalid('emailOrPhone') ? 'invalid' : ''} ${!validation.emailOrPhone && touched.emailOrPhone ? 'valid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true">
                  <HiOutlineEnvelope />
                </span>
                <input
                  id={authFieldIds.emailOrPhone}
                  type="text"
                  name="emailOrPhone"
                  autoComplete="username"
                  value={formData.emailOrPhone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="name@company.com or +91 98765 43210"
                  aria-invalid={isFieldInvalid('emailOrPhone')}
                  aria-describedby={isFieldInvalid('emailOrPhone') ? 'auth-login-error' : undefined}
                  required
                />
              </div>
              {isFieldInvalid('emailOrPhone') && (
                <div className="auth-field-feedback" id="auth-login-error">
                  {validation.emailOrPhone}
                </div>
              )}
            </div>

            {!isLogin && (
              <div className="auth-field-group">
                <label className="auth-label" htmlFor={authFieldIds.phone}>
                  Phone
                </label>
                <div className={`auth-field ${isFieldInvalid('phone') ? 'invalid' : ''} ${!validation.phone && touched.phone ? 'valid' : ''}`}>
                  <span className="auth-field-icon" aria-hidden="true">
                    <HiOutlinePhone />
                  </span>
                  <input
                    id={authFieldIds.phone}
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="+91 90000 12345"
                    aria-invalid={isFieldInvalid('phone')}
                    aria-describedby={isFieldInvalid('phone') ? 'auth-phone-error' : undefined}
                    required
                  />
                </div>
                {isFieldInvalid('phone') && (
                  <div className="auth-field-feedback" id="auth-phone-error">
                    {validation.phone}
                  </div>
                )}
              </div>
            )}

            <div className="auth-field-group">
              <label className="auth-label" htmlFor={authFieldIds.password}>
                Password
              </label>
              <div className={`auth-field auth-field-password ${isFieldInvalid('password') ? 'invalid' : ''} ${!validation.password && touched.password ? 'valid' : ''}`}>
                <span className="auth-field-icon" aria-hidden="true">
                  <HiOutlineLockClosed />
                </span>
                <input
                  id={authFieldIds.password}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  onKeyUp={handlePasswordKey}
                  onKeyDown={handlePasswordKey}
                  onFocus={handlePasswordKey}
                  placeholder={isLogin ? 'Enter your secure password' : 'Create a strong password'}
                  aria-invalid={isFieldInvalid('password')}
                  aria-describedby={isFieldInvalid('password') ? 'auth-password-error' : capsLockOn ? 'auth-password-caps' : undefined}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <HiOutlineEyeSlash aria-hidden="true" /> : <HiOutlineEye aria-hidden="true" />}
                </button>
              </div>
              {capsLockOn && (
                <div className="auth-field-hint" id="auth-password-caps">
                  Caps Lock is on.
                </div>
              )}
              {isFieldInvalid('password') && (
                <div className="auth-field-feedback" id="auth-password-error">
                  {validation.password}
                </div>
              )}
            </div>

            <div className="auth-form-row">
              {isLogin ? (
                <label className="auth-remember">
                  <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                  <span>Remember me</span>
                </label>
              ) : (
                <div className="auth-form-note">
                  New users will receive role-based access and invite tracking.
                </div>
              )}

              <button
                type="button"
                className="auth-link-button"
                onClick={() => notify('Ask an administrator to resend your account invite if you cannot sign in.', 'info')}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
              <span className="auth-submit-label">{isLogin ? 'Login to ERP' : 'Register user'}</span>
              {isSubmitting ? (
                <span className="auth-spinner" aria-hidden="true" />
              ) : (
                <HiOutlineArrowRight aria-hidden="true" />
              )}
            </button>

            <div className="auth-future-ready">
              <span>SSO-ready for Google Workspace, Microsoft Entra, and future enterprise identity providers.</span>
            </div>
          </form>

          <div className="auth-assurance-grid" aria-label="Security and compliance highlights">
            {dashboardSignals.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="auth-assurance-card">
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </article>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Auth;
