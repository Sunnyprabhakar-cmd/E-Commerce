import { useEffect, useRef, useState } from 'react';
import {
  HiOutlineArrowRight,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineBanknotes,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineBellAlert,
  HiOutlineBuildingOffice2,
  HiOutlineChartBarSquare,
  HiOutlineCheckBadge,
  HiOutlineClipboardDocumentList,
  HiOutlineClock,
  HiOutlineCloud,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineEnvelope,
  HiOutlineFingerPrint,
  HiOutlineGlobeAlt,
  HiOutlineHandRaised,
  HiOutlineHomeModern,
  HiOutlineLockClosed,
  HiOutlinePhone,
  HiOutlinePresentationChartLine,
  HiOutlineQrCode,
  HiOutlineReceiptPercent,
  HiOutlineShieldCheck,
  HiOutlineTruck,
  HiOutlineUserGroup,
  HiOutlineXMark,
} from 'react-icons/hi2';
import Auth from './Auth';
import { fetchSystemSettings } from '../services/systemService';
import { notify } from '../utils/notify';

const fallbackSupport = {
  contact_points: [
    { label: 'WhatsApp', value: '+91 90000 77777' },
    { label: 'Support Phone', value: '+91 90000 12345' },
    { label: 'Support Email', value: 'support@pearryerp.com' },
    { label: 'Sales Email', value: 'sales@pearryerp.com' },
  ],
  business_hours: 'Mon - Sat, 9:00 AM - 6:00 PM',
  support_notes: 'Editable from Settings > Help & support',
};

const featureItems = [
  ['Inventory Management', <HiOutlineCube />],
  ['Customer Management', <HiOutlineUserGroup />],
  ['Supplier Management', <HiOutlineTruck />],
  ['Purchase Management', <HiOutlineClipboardDocumentList />],
  ['Sales Management', <HiOutlineBanknotes />],
  ['Invoices', <HiOutlineDocumentText />],
  ['GST Billing', <HiOutlineReceiptPercent />],
  ['Employee Management', <HiOutlineBuildingOffice2 />],
  ['Attendance', <HiOutlineClock />],
  ['Payroll', <HiOutlineLockClosed />],
  ['Analytics', <HiOutlineChartBarSquare />],
  ['Reports', <HiOutlinePresentationChartLine />],
  ['Stock Alerts', <HiOutlineBellAlert />],
  ['Role Based Access', <HiOutlineFingerPrint />],
  ['Audit Logs', <HiOutlineShieldCheck />],
  ['Barcode Support', <HiOutlineQrCode />],
  ['QR Payments', <HiOutlineHandRaised />],
  ['Multi Branch', <HiOutlineHomeModern />],
];

const heroCards = [
  { title: 'Sales Today', value: '₹12.4L', detail: '+18% from yesterday' },
  { title: 'Inventory', value: '92%', detail: 'Healthy stock levels' },
  { title: 'Revenue', value: '₹48.2L', detail: 'Month to date' },
  { title: 'Purchase Orders', value: '31', detail: 'Pending approvals' },
  { title: 'Employees Online', value: '36', detail: 'Active on ERP' },
];

const screenshotTabs = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'billing', label: 'Billing' },
  { id: 'reports', label: 'Reports' },
  { id: 'employee', label: 'Employee' },
  { id: 'orders', label: 'Orders' },
  { id: 'customers', label: 'Customers' },
];

const screenshotPanels = {
  inventory: {
    title: 'Inventory command center',
    metrics: ['Fast stock search', 'Multi branch stock', 'Low stock alert'],
    rows: [
      ['Product A', '120 pcs', 'Available'],
      ['Product B', '42 pcs', 'Reorder soon'],
      ['Product C', '8 pcs', 'Critical'],
    ],
  },
  billing: {
    title: 'Billing and GST invoice desk',
    metrics: ['GST ready', 'Tax breakdown', 'Payment status'],
    rows: [
      ['Invoice #1042', '₹84,200', 'Paid'],
      ['Invoice #1043', '₹12,800', 'Pending'],
      ['Invoice #1044', '₹61,500', 'Partial'],
    ],
  },
  reports: {
    title: 'Executive reporting cockpit',
    metrics: ['Revenue trends', 'Cash flow', 'Collections'],
    rows: [
      ['Revenue', '▲ 18%', 'Strong'],
      ['Margin', '▲ 7%', 'Healthy'],
      ['Returns', '▼ 4%', 'Improving'],
    ],
  },
  employee: {
    title: 'Employee onboarding workspace',
    metrics: ['Roles', 'Approvals', 'Permissions'],
    rows: [
      ['Sales lead', 'Pending invite', 'Admin review'],
      ['Warehouse staff', 'Active', 'Stock access'],
      ['Finance associate', 'Active', 'Invoice access'],
    ],
  },
  orders: {
    title: 'Purchase and order board',
    metrics: ['Demand intake', 'Dispatch', 'Payment'],
    rows: [
      ['PO-4209', 'Warehouse', 'Processing'],
      ['SO-5211', 'Customer', 'Confirmed'],
      ['PO-4210', 'Supplier', 'Awaiting'],
    ],
  },
  customers: {
    title: 'Customer relationship console',
    metrics: ['Saved addresses', 'Invoices', 'Support'],
    rows: [
      ['Acme Retail', '12 orders', 'Active'],
      ['North Star', '5 invoices', 'At risk'],
      ['Vertex Mart', '27 orders', 'Healthy'],
    ],
  },
};

const workflowSteps = [
  { title: 'Purchase', icon: <HiOutlineClipboardDocumentList /> },
  { title: 'Warehouse', icon: <HiOutlineHomeModern /> },
  { title: 'Inventory', icon: <HiOutlineCube /> },
  { title: 'Sales', icon: <HiOutlineBanknotes /> },
  { title: 'Invoice', icon: <HiOutlineDocumentText /> },
  { title: 'Customer', icon: <HiOutlineUserGroup /> },
];

const whyItems = [
  { title: 'Fast', text: 'Responsive ERP workflows with quick search and direct navigation.', icon: <HiOutlineArrowRight /> },
  { title: 'Secure', text: 'Role-based access, audit logs, and token-backed sessions.', icon: <HiOutlineShieldCheck /> },
  { title: 'Cloud Based', text: 'Centralized access for teams, branches, and leadership.', icon: <HiOutlineCloud /> },
  { title: 'GST Ready', text: 'Billing and invoice flows prepared for tax-heavy operations.', icon: <HiOutlineReceiptPercent /> },
  { title: 'Responsive', text: 'Desktop, tablet, and mobile layouts with no horizontal scroll.', icon: <HiOutlineGlobeAlt /> },
  { title: 'Role Based', text: 'Permission-driven access for admin, employee, customer, and supplier users.', icon: <HiOutlineFingerPrint /> },
  { title: 'Easy to Use', text: 'Clear information architecture and practical onboarding.', icon: <HiOutlineCheckBadge /> },
];

const testimonials = [
  { name: 'Aarav Patel', role: 'Operations Director', quote: 'The interface finally feels like software our team can run daily without training people twice.' },
  { name: 'Meera Iyer', role: 'Finance Manager', quote: 'The billing and reporting flow is clean, and the ERP no longer feels like a student project.' },
  { name: 'Karan Shah', role: 'Branch Head', quote: 'Responsive navigation and faster onboarding make a real difference on mobile and laptop.' },
];

const pricing = [
  { name: 'Starter', price: '₹0', description: 'For demos and small teams.', features: ['Core ERP modules', 'Basic reports', 'Single branch'] },
  { name: 'Business', price: '₹3,999/mo', description: 'For growing teams.', features: ['Advanced inventory', 'GST billing', 'Employee roles'] },
  { name: 'Enterprise', price: 'Custom', description: 'For multi-branch businesses.', features: ['Audit logs', 'SSO planning', 'Priority support'] },
];

const faqItems = [
  'How do I sign in?',
  'Can I register from the landing page?',
  'Does the ERP support customer invites?',
  'Can employees be onboarded with invitations?',
  'Is mobile supported?',
  'Can I manage multiple branches?',
  'Is GST billing included?',
  'Can I track inventory in real time?',
  'Is there role-based access control?',
  'Where can I update support contacts?',
];

const LandingPage = ({ onLogin }) => {
  const [authMode, setAuthMode] = useState('login');
  const [authOpen, setAuthOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [support, setSupport] = useState(fallbackSupport);
  const [activeTab, setActiveTab] = useState('inventory');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [tabRailState, setTabRailState] = useState({ canLeft: false, canRight: false, scrolledOnce: false });
  const tabRailRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadSupport = async () => {
      try {
        const response = await fetchSystemSettings();
        if (cancelled) return;
        const settings = response.data?.settings || [];
        const supportSettings = settings.find((item) => item.setting_key === 'support')?.setting_value
          || settings.find((item) => item.setting_key === 'support_settings')?.setting_value
          || {};
        setSupport({
          ...fallbackSupport,
          ...supportSettings,
          contact_points: Array.isArray(supportSettings.contact_points) && supportSettings.contact_points.length
            ? supportSettings.contact_points
            : fallbackSupport.contact_points,
        });
      } catch {
        if (!cancelled) {
          setSupport(fallbackSupport);
        }
      }
    };

    loadSupport();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAuthOpen(false);
        setHelpOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('landing-modal-open', authOpen || helpOpen);
    return () => document.body.classList.remove('landing-modal-open');
  }, [authOpen, helpOpen]);

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 8);

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  useEffect(() => {
    const rail = tabRailRef.current;
    if (!rail) {
      return undefined;
    }

    const syncRailState = () => {
      const canLeft = rail.scrollLeft > 4;
      const canRight = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4;
      setTabRailState((current) => ({
        canLeft,
        canRight,
        scrolledOnce: current.scrolledOnce || rail.scrollLeft > 4,
      }));
    };

    syncRailState();
    rail.addEventListener('scroll', syncRailState, { passive: true });
    window.addEventListener('resize', syncRailState, { passive: true });

    return () => {
      rail.removeEventListener('scroll', syncRailState);
      window.removeEventListener('resize', syncRailState);
    };
  }, []);

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
    setMenuOpen(false);
  };

  const watchDemo = () => {
    document.getElementById('screenshots')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveTab('reports');
  };

  const scrollTabs = (direction) => {
    const rail = tabRailRef.current;
    if (!rail) {
      return;
    }

    rail.scrollBy({ left: direction, behavior: 'smooth' });
    setTabRailState((current) => ({ ...current, scrolledOnce: true }));
  };

  const selectTab = (tabId, element) => {
    setActiveTab(tabId);
    setTabRailState((current) => ({ ...current, scrolledOnce: true }));
    element?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <div className="landing-shell">
      <header className={`landing-navbar ${isScrolled ? 'is-scrolled' : ''}`}>
        <button type="button" className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="landing-brand-mark" aria-hidden="true"><HiOutlineBuildingOffice2 /></span>
          <span>
            <strong>Pearry ERP</strong>
            <small>Commercial Operations Platform</small>
          </span>
        </button>

        <button type="button" className={`landing-menu-toggle ${menuOpen ? 'is-open' : ''}`} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>
          <span />
          <span />
          <span />
        </button>

        <div className={`landing-nav-shell ${menuOpen ? 'open' : ''}`}>
          <nav className="landing-nav-links" aria-label="Primary">
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#screenshots" onClick={() => setMenuOpen(false)}>Screenshots</a>
            <a href="#workflow" onClick={() => setMenuOpen(false)}>Workflow</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
            <button type="button" onClick={() => { setHelpOpen(true); setMenuOpen(false); }}>Help Center</button>
          </nav>

          <div className="landing-nav-actions">
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openAuth('login')}>Login</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openAuth('register')}>Register</button>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">ERP for inventory, sales, billing, employees, and support</div>
            <h1>Run your business with a premium ERP that feels built for real operations.</h1>
            <p>
              Manage inventory, customers, suppliers, orders, invoices, employees, and reporting from one polished commercial platform designed for desktop and mobile.
            </p>

            <div className="landing-hero-actions">
              <button type="button" className="btn btn-primary" onClick={() => openAuth('register')}>Start Free Trial</button>
              <button type="button" className="btn btn-outline-primary" onClick={watchDemo}>Watch Demo</button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => openAuth('login')}>Login</button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => openAuth('register')}>Register</button>
            </div>

            <div className="landing-trust-row">
              <span><HiOutlineShieldCheck /> Secure onboarding</span>
              <span><HiOutlineFingerPrint /> Role based access</span>
              <span><HiOutlineCheckBadge /> GST ready</span>
            </div>
          </div>

          <div className="landing-hero-visual">
            <svg className="landing-hero-svg" viewBox="0 0 760 560" aria-hidden="true">
              <defs>
                <linearGradient id="heroBg" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                <linearGradient id="heroAccent" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <rect x="48" y="48" width="664" height="464" rx="34" fill="url(#heroBg)" />
              <rect x="96" y="94" width="180" height="100" rx="24" fill="rgba(255,255,255,0.08)" />
              <rect x="96" y="220" width="180" height="176" rx="24" fill="rgba(255,255,255,0.06)" />
              <rect x="296" y="94" width="368" height="302" rx="28" fill="#eef2ff" />
              <rect x="324" y="126" width="106" height="16" rx="8" fill="#94a3b8" />
              <rect x="324" y="156" width="216" height="14" rx="7" fill="#cbd5e1" />
              <rect x="324" y="190" width="272" height="102" rx="20" fill="#fff" />
              <rect x="324" y="308" width="140" height="24" rx="12" fill="url(#heroAccent)" />
              <circle cx="186" cy="140" r="28" fill="url(#heroAccent)" />
              <path d="M120 264h128" stroke="url(#heroAccent)" strokeWidth="12" strokeLinecap="round" />
              <path d="M120 296h96" stroke="#94a3b8" strokeWidth="12" strokeLinecap="round" />
              <path d="M120 328h72" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
              <path d="M98 452h560" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
            </svg>

            <div className="landing-float-card float-a">
              <strong>{heroCards[0].title}</strong>
              <span>{heroCards[0].value}</span>
              <small>{heroCards[0].detail}</small>
            </div>
            <div className="landing-float-card float-b">
              <strong>{heroCards[1].title}</strong>
              <span>{heroCards[1].value}</span>
              <small>{heroCards[1].detail}</small>
            </div>
            <div className="landing-float-card float-c">
              <strong>{heroCards[2].title}</strong>
              <span>{heroCards[2].value}</span>
              <small>{heroCards[2].detail}</small>
            </div>
            <div className="landing-float-card float-d">
              <strong>{heroCards[3].title}</strong>
              <span>{heroCards[3].value}</span>
              <small>{heroCards[3].detail}</small>
            </div>
            <div className="landing-float-card float-e">
              <strong>{heroCards[4].title}</strong>
              <span>{heroCards[4].value}</span>
              <small>{heroCards[4].detail}</small>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Business features</span>
            <h2>Everything a commercial ERP needs in one place.</h2>
          </div>
          <div className="landing-feature-grid">
            {featureItems.map(([title, icon]) => (
              <article key={title} className="landing-feature-card">
                <div className="landing-feature-icon">{icon}</div>
                <strong>{title}</strong>
              </article>
            ))}
          </div>
        </section>

        <section id="screenshots" className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">ERP screenshots</span>
            <h2>Multiple module views with tabs for faster evaluation.</h2>
          </div>
          <div className={`landing-tabs-shell ${tabRailState.scrolledOnce ? 'has-scrolled' : ''}`}>
            <button type="button" className={`landing-tabs-chevron landing-tabs-chevron-left ${tabRailState.canLeft ? 'visible' : 'faded'}`} aria-label="Scroll tabs left" onClick={() => scrollTabs(-260)}>
              <HiOutlineChevronLeft />
            </button>
            <div className="landing-tabs-row" ref={tabRailRef}>
              {screenshotTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`landing-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={(event) => selectTab(tab.id, event.currentTarget)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button type="button" className={`landing-tabs-chevron landing-tabs-chevron-right ${tabRailState.canRight ? 'visible' : 'faded'}`} aria-label="Scroll tabs right" onClick={() => scrollTabs(260)}>
              <HiOutlineChevronRight />
            </button>
          </div>
          <div className="landing-screenshot-panel">
            <div className="landing-screenshot-head">
              <h3>{screenshotPanels[activeTab].title}</h3>
              <button type="button" className="landing-inline-link" onClick={() => openAuth('register')}>Open trial <HiOutlineArrowTopRightOnSquare /></button>
            </div>
            <div className="landing-screenshot-body">
              <div className="landing-screenshot-card landing-screenshot-dashboard">
                <div className="landing-dashboard-mini-header">
                  <span>Overview</span>
                  <strong>Live ERP snapshot</strong>
                </div>
                <div className="landing-dashboard-chips">
                  {screenshotPanels[activeTab].metrics.map((metric) => <span key={metric}>{metric}</span>)}
                </div>
                <div className="landing-dashboard-bars">
                  <span style={{ height: '78%' }} />
                  <span style={{ height: '58%' }} />
                  <span style={{ height: '88%' }} />
                  <span style={{ height: '66%' }} />
                  <span style={{ height: '92%' }} />
                </div>
              </div>
              <div className="landing-screenshot-card">
                <div className="landing-screenshot-list">
                  {screenshotPanels[activeTab].rows.map(([title, value, status]) => (
                    <div key={`${title}-${value}`} className="landing-screenshot-row">
                      <div>
                        <strong>{title}</strong>
                        <span>{value}</span>
                      </div>
                      <span>{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Workflow</span>
            <h2>Purchase to customer invoice in one connected flow.</h2>
          </div>
          <div className="landing-workflow">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="landing-workflow-step">
                <div className="landing-workflow-icon">{step.icon}</div>
                <strong>{step.title}</strong>
                {index < workflowSteps.length - 1 && <span className="landing-workflow-arrow">→</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Why choose us</span>
            <h2>Built for speed, clarity, and business trust.</h2>
          </div>
          <div className="landing-why-grid">
            {whyItems.map((item) => (
              <article key={item.title} className="landing-why-card">
                <div className="landing-why-icon">{item.icon}</div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Testimonials</span>
            <h2>Used by teams that need a business-first ERP.</h2>
          </div>
          <div className="landing-testimonial-grid">
            {testimonials.map((item) => (
              <article key={item.name} className="landing-testimonial-card">
                <p>“{item.quote}”</p>
                <strong>{item.name}</strong>
                <span>{item.role}</span>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Pricing</span>
            <h2>Simple plans for every stage of growth.</h2>
          </div>
          <div className="landing-pricing-grid">
            {pricing.map((plan) => (
              <article key={plan.name} className={`landing-pricing-card ${plan.name === 'Business' ? 'featured' : ''}`}>
                <div className="landing-pricing-header">
                  <strong>{plan.name}</strong>
                  <span>{plan.price}</span>
                </div>
                <p>{plan.description}</p>
                <ul>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <button type="button" className="btn btn-primary w-100" onClick={() => openAuth('register')}>Get Started</button>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">FAQ</span>
            <h2>Answers to common questions.</h2>
          </div>
          <div className="landing-faq-list">
            {faqItems.map((question, index) => (
              <details key={question} className="landing-faq-item" open={index === 0}>
                <summary>{question}</summary>
                <p>
                  {index === 0 && 'Use Login to open the modal or Start Free Trial to begin registration.'}
                  {index === 1 && 'Yes, Register opens a clean two-step onboarding flow right from the landing page.'}
                  {index === 2 && 'Admins can generate customer invites from the dashboard and activation links use the customer invite route.'}
                  {index === 3 && 'Employee onboarding uses the invite workflow from the employee management portal.'}
                  {index === 4 && 'Yes. The shell is responsive from desktop to mobile with no horizontal scrolling.'}
                  {index === 5 && 'The shell already supports branch-aware workflows and can be extended per role.'}
                  {index === 6 && 'The ERP includes invoice and billing-oriented screens with GST-friendly structure.'}
                  {index === 7 && 'Inventory and dashboard modules already surface stock-oriented metrics and alerts.'}
                  {index === 8 && 'Yes. Role-based permissions exist in the employee management flow.'}
                  {index === 9 && 'Support contacts are loaded from the existing support settings in the admin settings area.'}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <strong>Pearry ERP</strong>
          <p>Premium ERP software for real businesses.</p>
        </div>
        <div className="landing-footer-links">
          <div>
            <strong>Company</strong>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div>
            <strong>Support</strong>
            <button type="button" onClick={() => setHelpOpen(true)}>Help Center</button>
            <a href="mailto:support@pearryerp.com">Email</a>
            <a href="tel:+919000012345">Phone</a>
            <a href="https://wa.me/919000077777" target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
          <div>
            <strong>Resources</strong>
            <a href="#screenshots">Documentation</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
      </footer>

      {authOpen && (
        <div className="landing-modal-backdrop" role="presentation" onMouseDown={() => setAuthOpen(false)}>
          <div className="landing-modal" role="dialog" aria-modal="true" aria-label={authMode === 'login' ? 'Login' : 'Register'} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="landing-modal-close" aria-label="Close" onClick={() => setAuthOpen(false)}>
              <HiOutlineXMark />
            </button>
            <Auth initialMode={authMode} onLogin={onLogin} />
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="landing-modal-backdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}>
          <aside className="landing-help-panel" role="dialog" aria-modal="true" aria-label="Help Center" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="landing-modal-close" aria-label="Close" onClick={() => setHelpOpen(false)}>
              <HiOutlineXMark />
            </button>
            <div className="landing-help-header">
              <span className="landing-section-kicker">Help Center</span>
              <h2>Support, contact, and documentation</h2>
              <p>{support.support_notes}</p>
            </div>
            <div className="landing-help-grid">
              {support.contact_points.map((contact) => (
                <div key={contact.label} className="landing-help-item">
                  <strong>{contact.label}</strong>
                  <span>{contact.value}</span>
                </div>
              ))}
            </div>
            <div className="landing-help-hours">
              <HiOutlineClock />
              <div>
                <strong>Business hours</strong>
                <span>{support.business_hours}</span>
              </div>
            </div>
            <form className="landing-help-form" onSubmit={(event) => { event.preventDefault(); notify('Support request submitted.', 'success'); }}>
              <div className="row g-3">
                <div className="col-12 col-md-6"><input className="form-control" placeholder="Your name" /></div>
                <div className="col-12 col-md-6"><input className="form-control" placeholder="Your email" /></div>
                <div className="col-12"><textarea className="form-control" rows="4" placeholder="How can we help?" /></div>
              </div>
              <button type="submit" className="btn btn-primary mt-3">Send message</button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
