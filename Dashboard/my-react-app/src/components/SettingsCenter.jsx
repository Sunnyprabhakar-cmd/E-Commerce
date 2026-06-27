import { useEffect, useMemo, useState } from 'react';
import { applyTheme, getThemePresets, getStoredThemeId } from '../utils/themeManager';
import {
  activateInvoiceTemplate,
  activateThemeProfile,
  deleteInvoiceTemplate,
  deleteThemeProfile,
  fetchActivityLogs,
  fetchInvoiceTemplates,
  fetchSystemSettings,
  fetchThemes,
  fetchUserSessions,
  fetchUsers,
  saveInvoiceTemplate,
  saveSystemSetting,
  saveSupportSettings,
  saveThemeProfile,
  saveReminderSettings,
  updateUserRole,
} from '../services/systemService';

const sectionOrder = [
  'business',
  'invoice',
  'print',
  'users',
  'reminders',
  'support',
  'theme',
  'designer',
];

const sectionMeta = {
  business: { title: 'Business profile', subtitle: 'Brand, identity, and legal defaults.' },
  invoice: { title: 'Invoice settings', subtitle: 'Numbering, taxes, terms, and currency.' },
  print: { title: 'Print settings', subtitle: 'Paper, margins, and output behavior.' },
  users: { title: 'User management', subtitle: 'Access, sessions, and operational activity.' },
  reminders: { title: 'Reminders', subtitle: 'Payment and renewal notifications.' },
  support: { title: 'Help & support', subtitle: 'Support channels and escalation details.' },
  theme: { title: 'Theme manager', subtitle: 'Application chrome, palette, and density.' },
  designer: { title: 'Invoice designer', subtitle: 'Template library and invoice workspace.' },
};

const defaultBusinessSettings = {
  company_name: '',
  legal_name: '',
  website: '',
  timezone: 'UTC',
  currency: 'USD',
};

const defaultInvoiceSettings = {
  invoice_prefix: 'INV',
  invoice_terms: 'Due on receipt',
  tax_label: 'VAT / GST',
  tax_rate: 0,
  footer_note: '',
};

const defaultPrintSettings = {
  paper_size: 'A4',
  orientation: 'portrait',
  margin_top: 12,
  margin_right: 12,
  margin_bottom: 12,
  margin_left: 12,
  header_height: 72,
  footer_height: 56,
  logo_position: 'header-left',
  signature_position: 'footer-right',
  qr_position: 'footer-left',
  watermark_position: 'background-center',
  barcode_position: 'footer-center',
  page_break_rules: 'table-items',
  scale: 1,
  zoom: 100,
  print_density: 'normal',
  dpi: 300,
  grid: true,
  snap_to_grid: true,
  show_safe_area: true,
  live_ruler: true,
  page_guides: true,
  show_logo: true,
  show_qr: true,
  layout: [],
};

const defaultReminderSettings = {
  enable_payment_reminders: true,
  payment_days_before: 3,
  enable_subscription_reminders: true,
  subscription_days_before: 7,
};

const defaultSupportSettings = {
  contact_points: [
    { id: 'support-email', label: 'Support Email', value: '', type: 'email' },
    { id: 'support-whatsapp', label: 'Support WhatsApp', value: '', type: 'whatsapp' },
    { id: 'support-phone', label: 'Support Phone', value: '', type: 'phone' },
    { id: 'support-telegram', label: 'Telegram', value: '', type: 'telegram' },
    { id: 'support-website', label: 'Website', value: '', type: 'website' },
    { id: 'live-chat', label: 'Live Chat URL', value: '', type: 'url' },
    { id: 'knowledge-base', label: 'Knowledge Base URL', value: '', type: 'url' },
  ],
  business_hours: '09:00-17:00',
  live_chat_url: '',
  knowledge_base_url: '',
  support_notes: '',
};

const normalizeSupportSettings = (settings = {}) => {
  const fallbackContacts = defaultSupportSettings.contact_points;
  const legacyContacts = [
    settings.support_email ? { id: 'support-email', label: 'Support Email', value: settings.support_email, type: 'email' } : null,
    settings.support_whatsapp ? { id: 'support-whatsapp', label: 'Support WhatsApp', value: settings.support_whatsapp, type: 'whatsapp' } : null,
    settings.support_phone ? { id: 'support-phone', label: 'Support Phone', value: settings.support_phone, type: 'phone' } : null,
    settings.telegram ? { id: 'support-telegram', label: 'Telegram', value: settings.telegram, type: 'telegram' } : null,
    settings.website ? { id: 'support-website', label: 'Website', value: settings.website, type: 'website' } : null,
    settings.live_chat_url ? { id: 'live-chat', label: 'Live Chat URL', value: settings.live_chat_url, type: 'url' } : null,
    settings.knowledge_base_url ? { id: 'knowledge-base', label: 'Knowledge Base URL', value: settings.knowledge_base_url, type: 'url' } : null,
  ].filter(Boolean);
  const incomingContacts = Array.isArray(settings.contact_points) ? settings.contact_points : legacyContacts;
  const contact_points = fallbackContacts.map((contact, index) => ({
    ...contact,
    ...(incomingContacts[index] || {}),
  }));

  return {
    ...defaultSupportSettings,
    ...settings,
    contact_points,
  };
};

const roleOptions = [
  'Administrator',
  'Manager',
  'Sales',
  'Cashier',
  'Stock Manager',
  'HR',
  'Accountant',
  'Owner',
  'Supervisor',
  'Delivery',
  'Custom Role',
];

const settingsToRecord = (rows = []) => rows.reduce((acc, row) => {
  acc[row.setting_key] = row.setting_value || {};
  return acc;
}, {});

const prettyDate = (value) => {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const fieldStyle = {
  width: '100%',
  borderRadius: '14px',
  border: '1px solid rgba(148, 163, 184, 0.24)',
  background: 'rgba(15, 23, 42, 0.03)',
  color: 'inherit',
  padding: '0.8rem 0.95rem',
};

const cardStyle = {
  borderRadius: '24px',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(248,250,252,0.94))',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
};

const previewShellStyle = {
  borderRadius: '24px',
  overflow: 'hidden',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: '#ffffff',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.12)',
};

const SettingsCenter = () => {
  const [activeSection, setActiveSection] = useState('business');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [systemSettings, setSystemSettings] = useState({});
  const [themes, setThemes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [sessionsByUser, setSessionsByUser] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [businessDraft, setBusinessDraft] = useState(defaultBusinessSettings);
  const [invoiceDraft, setInvoiceDraft] = useState(defaultInvoiceSettings);
  const [printDraft, setPrintDraft] = useState(defaultPrintSettings);
  const [reminderDraft, setReminderDraft] = useState(defaultReminderSettings);
  const [supportDraft, setSupportDraft] = useState(defaultSupportSettings);
  const [themeDraft, setThemeDraft] = useState({ theme_key: 'retail', theme_name: 'Retail Core', theme_value: getThemePresets().retail });
  const [templateDraft, setTemplateDraft] = useState({ template_key: 'standard-a4', template_name: 'Standard A4', template_category: 'invoice', template_value: {} });
  const [roleDraft, setRoleDraft] = useState({});

  const activeThemeId = getStoredThemeId();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [settingsRes, themesRes, templatesRes, usersRes, logsRes] = await Promise.all([
          fetchSystemSettings(),
          fetchThemes(),
          fetchInvoiceTemplates(),
          fetchUsers(),
          fetchActivityLogs(25),
        ]);

        if (cancelled) return;

        const nextSettings = settingsToRecord(settingsRes.data?.settings || []);
        setSystemSettings(nextSettings);
        setBusinessDraft({ ...defaultBusinessSettings, ...(nextSettings.business_settings || nextSettings.business_profile || nextSettings.business || {}) });
        setInvoiceDraft({ ...defaultInvoiceSettings, ...(nextSettings.invoice_settings || nextSettings.invoice || {}) });
        setPrintDraft({ ...defaultPrintSettings, ...(nextSettings.print_settings || nextSettings.print || {}) });
        setReminderDraft({ ...defaultReminderSettings, ...(nextSettings.reminder_settings || nextSettings.notifications || {}) });
        setSupportDraft(normalizeSupportSettings(nextSettings.support_settings || nextSettings.support || {}));

        const nextThemes = themesRes.data?.themes || [];
        setThemes(nextThemes);
        const activeTheme = nextThemes.find((theme) => theme.is_active) || nextThemes[0];
        if (activeTheme?.theme_key) {
          setThemeDraft({
            theme_key: activeTheme.theme_key,
            theme_name: activeTheme.theme_name,
            theme_value: activeTheme.theme_value || getThemePresets()[activeTheme.theme_key] || getThemePresets().retail,
          });
        }

        setTemplates(templatesRes.data?.templates || []);
        setUsers(usersRes.data?.users || []);
        setActivityLogs(logsRes.data?.logs || []);
          setRoleDraft((usersRes.data?.users || []).reduce((acc, user) => {
            acc[user.id] = user.role || 'Custom Role';
          return acc;
        }, {}));
      } catch (loadError) {
        if (!cancelled) setError(loadError.response?.data?.message || loadError.message || 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSection === 'theme' && themeDraft?.theme_key) {
      applyTheme(themeDraft.theme_key);
    }
  }, [activeSection, themeDraft?.theme_key]);

  const sortedThemes = useMemo(() => [...themes].sort((left, right) => Number(right.is_active) - Number(left.is_active)), [themes]);
  const sortedTemplates = useMemo(() => [...templates].sort((left, right) => Number(right.is_default) - Number(left.is_default)), [templates]);

  const saveSectionSetting = async (key, payload, setter) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await saveSystemSetting(key, { setting_key: key, setting_value: payload });
      setter(response.data?.setting?.setting_value || payload);
      setMessage('Settings saved.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || saveError.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveTheme = async () => {
    setSavingTheme(true);
    setMessage('');
    setError('');
    try {
      await saveThemeProfile(themeDraft.theme_key, {
        theme_key: themeDraft.theme_key,
        theme_name: themeDraft.theme_name,
        theme_value: themeDraft.theme_value,
        is_active: true,
      });
      await activateThemeProfile(themeDraft.theme_key);
      applyTheme(themeDraft.theme_key);
      setMessage('Theme activated.');
      const refreshed = await fetchThemes();
      setThemes(refreshed.data?.themes || []);
    } catch (themeError) {
      setError(themeError.response?.data?.message || themeError.message || 'Failed to save theme');
    } finally {
      setSavingTheme(false);
    }
  };

  const saveTemplate = async () => {
    setSavingTemplate(true);
    setMessage('');
    setError('');
    try {
      await saveInvoiceTemplate(templateDraft.template_key, {
        template_key: templateDraft.template_key,
        template_name: templateDraft.template_name,
        template_category: templateDraft.template_category,
        template_value: templateDraft.template_value,
        is_default: true,
      });
      await activateInvoiceTemplate(templateDraft.template_key);
      setMessage('Invoice template saved.');
      const refreshed = await fetchInvoiceTemplates();
      setTemplates(refreshed.data?.templates || []);
    } catch (templateError) {
      setError(templateError.response?.data?.message || templateError.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const refreshUserSessions = async (userId) => {
    const response = await fetchUserSessions(userId);
    setSessionsByUser((current) => ({ ...current, [userId]: response.data?.sessions || [] }));
  };

  const saveRole = async (userId) => {
    setMessage('');
    setError('');
    try {
      const response = await updateUserRole(userId, { role: roleDraft[userId] });
      setUsers((current) => current.map((user) => (user.id === userId ? response.data?.user || user : user)));
      setMessage('User role updated.');
    } catch (roleError) {
      setError(roleError.response?.data?.message || roleError.message || 'Failed to update role');
    }
  };

  const sectionTabs = sectionOrder.map((section) => ({
    key: section,
    ...sectionMeta[section],
  }));

  return (
    <div className="settings-center" style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={cardStyle} className="p-4 p-lg-5">
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-start">
          <div>
            <div className="text-uppercase small fw-bold opacity-75">Settings hub</div>
            <h2 className="mb-1">ERP configuration workspace</h2>
            <p className="mb-0 text-muted">Each section is purpose-built. Invoice preview is only available in the dedicated invoice designer view.</p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <span className="badge rounded-pill text-bg-dark">Active theme: {activeThemeId}</span>
            <span className="badge rounded-pill text-bg-secondary">{themes.length} themes</span>
            <span className="badge rounded-pill text-bg-secondary">{templates.length} templates</span>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`alert ${error ? 'alert-danger' : 'alert-success'} mb-0`} role="status">
          {error || message}
        </div>
      )}

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-3">
          <div style={cardStyle} className="p-3 p-lg-4 sticky-top" data-settings-nav>
            <div className="text-uppercase small fw-bold mb-3 opacity-75">Sections</div>
            <div className="d-grid gap-2">
              {sectionTabs.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className={`btn text-start ${activeSection === section.key ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setActiveSection(section.key)}
                >
                  <div className="fw-semibold">{section.title}</div>
                  <div className="small opacity-75">{section.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-9">
          {loading ? (
            <div style={cardStyle} className="p-5 text-center">Loading settings workspace...</div>
          ) : (
            <div className="d-grid gap-4">
              {activeSection === 'business' ? (
                <BusinessSettingsSection
                  data={businessDraft}
                  onChange={setBusinessDraft}
                  onSave={() => saveSectionSetting('business_settings', businessDraft, setBusinessDraft)}
                  saving={saving}
                />
              ) : activeSection === 'invoice' ? (
                <InvoiceSettingsSection
                  data={invoiceDraft}
                  onChange={setInvoiceDraft}
                  onSave={() => saveSectionSetting('invoice_settings', invoiceDraft, setInvoiceDraft)}
                  saving={saving}
                  templates={sortedTemplates}
                  templateDraft={templateDraft}
                  onTemplateSelect={setTemplateDraft}
                />
              ) : activeSection === 'print' ? (
                <PrintSettingsSection
                  data={printDraft}
                  onChange={setPrintDraft}
                  onSave={() => saveSectionSetting('print_settings', printDraft, setPrintDraft)}
                  saving={saving}
                />
              ) : activeSection === 'users' ? (
                <UserManagementSection
                  users={users}
                  sessionsByUser={sessionsByUser}
                  roleDraft={roleDraft}
                  onRoleDraftChange={setRoleDraft}
                  onRefreshSessions={refreshUserSessions}
                  onSaveRole={saveRole}
                  onReload={async () => {
                    const response = await fetchUsers();
                    setUsers(response.data?.users || []);
                  }}
                />
              ) : activeSection === 'reminders' ? (
                <ReminderSettingsSection
                  data={reminderDraft}
                  onChange={setReminderDraft}
                  onSave={async () => {
                    await saveReminderSettings(reminderDraft);
                    setMessage('Reminder settings saved.');
                  }}
                />
              ) : activeSection === 'support' ? (
                <SupportSettingsSection
                  data={supportDraft}
                  onChange={setSupportDraft}
                  onSave={async () => {
                    await saveSupportSettings(supportDraft);
                    setMessage('Support settings saved.');
                  }}
                />
              ) : activeSection === 'theme' ? (
                <ThemeManagerSection
                  themes={sortedThemes}
                  themeDraft={themeDraft}
                  onThemeDraftChange={setThemeDraft}
                  onSave={saveTheme}
                  onActivate={async (themeKey) => {
                    await activateThemeProfile(themeKey);
                    applyTheme(themeKey);
                    setThemeDraft((current) => ({ ...current, theme_key: themeKey }));
                    setMessage('Theme activated.');
                    const refreshed = await fetchThemes();
                    setThemes(refreshed.data?.themes || []);
                  }}
                  onDelete={async (themeKey) => {
                    await deleteThemeProfile(themeKey);
                    const refreshed = await fetchThemes();
                    setThemes(refreshed.data?.themes || []);
                  }}
                  saving={savingTheme}
                />
              ) : activeSection === 'designer' ? (
                <InvoiceDesignerSection
                  templates={sortedTemplates}
                  templateDraft={templateDraft}
                  onTemplateDraftChange={setTemplateDraft}
                  onSaveTemplate={saveTemplate}
                  saving={savingTemplate}
                  onActivateTemplate={async (templateKey) => {
                    await activateInvoiceTemplate(templateKey);
                    setMessage('Invoice template activated.');
                    const refreshed = await fetchInvoiceTemplates();
                    setTemplates(refreshed.data?.templates || []);
                  }}
                  onDeleteTemplate={async (templateKey) => {
                    await deleteInvoiceTemplate(templateKey);
                    const refreshed = await fetchInvoiceTemplates();
                    setTemplates(refreshed.data?.templates || []);
                  }}
                />
              ) : null}

              <ActivityFeedCard logs={activityLogs} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SectionCard = ({ title, subtitle, actions, children }) => (
  <section style={cardStyle} className="p-4 p-lg-5">
    <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-start mb-4">
      <div>
        <h3 className="h4 mb-1">{title}</h3>
        <p className="text-muted mb-0">{subtitle}</p>
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const BusinessSettingsSection = ({ data, onChange, onSave, saving }) => (
  <SectionCard
    title="Business profile"
    subtitle="Configure the company identity used across the ERP."
    actions={<button className="btn btn-dark" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save business settings'}</button>}
  >
    <div className="row g-3">
      {[
        ['company_name', 'Company name'],
        ['legal_name', 'Legal name'],
        ['website', 'Website'],
        ['timezone', 'Timezone'],
        ['currency', 'Currency'],
      ].map(([field, label]) => (
        <div className="col-12 col-md-6" key={field}>
          <label className="form-label fw-semibold">{label}</label>
          <input
            className="form-control"
            style={fieldStyle}
            value={data[field] || ''}
            onChange={(event) => onChange({ ...data, [field]: event.target.value })}
          />
        </div>
      ))}
    </div>
  </SectionCard>
);

const InvoiceSettingsSection = ({ data, onChange, onSave, saving, templates, templateDraft, onTemplateSelect }) => (
  <SectionCard
    title="Invoice settings"
    subtitle="Control numbering and the defaults that feed the invoice designer."
    actions={<button className="btn btn-dark" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save invoice settings'}</button>}
  >
    <div className="row g-3 mb-4">
      {[
        ['invoice_prefix', 'Invoice prefix'],
        ['tax_label', 'Tax label'],
        ['tax_rate', 'Tax rate'],
        ['invoice_terms', 'Default terms'],
      ].map(([field, label]) => (
        <div className="col-12 col-md-6" key={field}>
          <label className="form-label fw-semibold">{label}</label>
          <input
            className="form-control"
            style={fieldStyle}
            value={data[field] || ''}
            onChange={(event) => onChange({ ...data, [field]: event.target.value })}
          />
        </div>
      ))}
      <div className="col-12">
        <label className="form-label fw-semibold">Footer note</label>
        <textarea
          className="form-control"
          style={{ ...fieldStyle, minHeight: '110px' }}
          value={data.footer_note || ''}
          onChange={(event) => onChange({ ...data, footer_note: event.target.value })}
        />
      </div>
    </div>
    <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3">
      <div>
        <div className="fw-semibold">Template handoff</div>
        <div className="text-muted">Use the designer page for the full invoice canvas. This section only manages defaults.</div>
      </div>
      <select
        className="form-select"
        style={{ ...fieldStyle, maxWidth: '320px' }}
        onChange={(event) => {
          const selected = templates.find((template) => template.template_key === event.target.value);
          if (selected) onTemplateSelect(selected);
        }}
        value={templateDraft.template_key || ''}
      >
        {templates.map((template) => (
          <option key={template.template_key} value={template.template_key}>{template.template_name}</option>
        ))}
      </select>
    </div>
  </SectionCard>
);

const defaultPrintBlocks = [
  { id: 'logo', label: 'Company Logo', x: 6, y: 6, width: 20, height: 10, enabled: true },
  { id: 'company', label: 'Company Details', x: 30, y: 6, width: 28, height: 12, enabled: true },
  { id: 'customer', label: 'Customer Details', x: 6, y: 20, width: 28, height: 12, enabled: true },
  { id: 'invoice', label: 'Invoice Number', x: 36, y: 20, width: 18, height: 10, enabled: true },
  { id: 'date', label: 'Date', x: 56, y: 20, width: 14, height: 10, enabled: true },
  { id: 'items', label: 'Products Table', x: 6, y: 36, width: 64, height: 20, enabled: true },
  { id: 'gst', label: 'GST', x: 72, y: 36, width: 20, height: 10, enabled: true },
  { id: 'bank', label: 'Bank Details', x: 72, y: 48, width: 20, height: 10, enabled: true },
  { id: 'qr', label: 'QR Code', x: 6, y: 60, width: 14, height: 12, enabled: true },
  { id: 'terms', label: 'Terms', x: 22, y: 60, width: 24, height: 12, enabled: true },
  { id: 'signature', label: 'Signature', x: 48, y: 60, width: 22, height: 12, enabled: true },
  { id: 'footer', label: 'Footer', x: 72, y: 60, width: 20, height: 12, enabled: true },
];

const PrintSettingsSection = ({ data, onChange, onSave, saving }) => {
  const [layout, setLayout] = useState(() => (Array.isArray(data.layout) && data.layout.length > 0 ? data.layout : defaultPrintBlocks));
  const [activeBlockId, setActiveBlockId] = useState(defaultPrintBlocks[0].id);
  const [dragSourceId, setDragSourceId] = useState('');
  const [resizeSourceId, setResizeSourceId] = useState('');

  useEffect(() => {
    if (Array.isArray(data.layout) && data.layout.length > 0) {
      setLayout(data.layout);
    }
  }, [data.layout]);

  const commitLayout = (nextLayout) => {
    setLayout(nextLayout);
    onChange({ ...data, layout: nextLayout });
  };

  const updateField = (field, value) => onChange({ ...data, [field]: value, layout });

  const updateBlock = (blockId, patch) => {
    commitLayout(layout.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  };

  const swapBlocks = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const source = layout.find((block) => block.id === sourceId);
    const target = layout.find((block) => block.id === targetId);
    if (!source || !target) return;
    commitLayout(layout.map((block) => {
      if (block.id === sourceId) return { ...block, x: target.x, y: target.y };
      if (block.id === targetId) return { ...block, x: source.x, y: source.y };
      return block;
    }));
  };

  const startResize = (blockId) => {
    setResizeSourceId(blockId);
    const onMove = (event) => {
      const target = layout.find((block) => block.id === blockId);
      if (!target) return;
      const width = Math.max(10, Math.min(60, target.width + (event.movementX / 8)));
      const height = Math.max(8, Math.min(24, target.height + (event.movementY / 8)));
      updateBlock(blockId, { width: Number(width.toFixed(1)), height: Number(height.toFixed(1)) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setResizeSourceId('');
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <SectionCard
      title="Print designer"
      subtitle="Drag template blocks onto a page, snap them into place, and tune print defaults without leaving the ERP."
      actions={<button className="btn btn-dark" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save print settings'}</button>}
    >
      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <div className="d-grid gap-3">
            {[
              ['paper_size', 'Paper size', ['A4', 'A5', 'Thermal']],
              ['orientation', 'Orientation', ['portrait', 'landscape']],
              ['page_break_rules', 'Page break rules', ['table-items', 'manual', 'smart']],
              ['print_density', 'Print density', ['normal', 'compact', 'spacious']],
              ['logo_position', 'Logo position', ['header-left', 'header-center', 'header-right']],
              ['signature_position', 'Signature position', ['footer-left', 'footer-center', 'footer-right']],
              ['qr_position', 'QR position', ['footer-left', 'footer-center', 'footer-right']],
              ['watermark_position', 'Watermark position', ['background-center', 'background-top', 'background-bottom']],
              ['barcode_position', 'Barcode position', ['footer-left', 'footer-center', 'footer-right']],
            ].map(([field, label, options]) => (
              <div key={field}>
                <label className="form-label fw-semibold">{label}</label>
                <select className="form-select" value={data[field] || options[0]} onChange={(event) => updateField(field, event.target.value)}>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            ))}

            {[
              ['margin_top', 'Top margin'],
              ['margin_right', 'Right margin'],
              ['margin_bottom', 'Bottom margin'],
              ['margin_left', 'Left margin'],
              ['header_height', 'Header height'],
              ['footer_height', 'Footer height'],
              ['scale', 'Scale'],
              ['zoom', 'Zoom'],
              ['dpi', 'DPI'],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="form-label fw-semibold">{label}</label>
                <input className="form-control" type="number" value={data[field] ?? 0} onChange={(event) => updateField(field, Number(event.target.value))} />
              </div>
            ))}

            <div className="d-grid gap-2">
              {[
                ['grid', 'Grid'],
                ['snap_to_grid', 'Snap to grid'],
                ['show_safe_area', 'Show safe area'],
                ['live_ruler', 'Live ruler'],
                ['page_guides', 'Page guides'],
                ['show_logo', 'Show logo'],
                ['show_qr', 'Show QR code'],
              ].map(([field, label]) => (
                <label key={field} className="d-flex align-items-center gap-2">
                  <input type="checkbox" checked={Boolean(data[field])} onChange={(event) => updateField(field, event.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => commitLayout(defaultPrintBlocks)}>Reset layout</button>
              <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setAllBlocksVisible(true)}>Show all blocks</button>
              <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setAllBlocksVisible(false)}>Hide all blocks</button>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div className="mb-2 d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <div>
              <div className="fw-semibold">Live page canvas</div>
              <div className="small text-muted">Drag blocks to rearrange them. Click a block to edit its position and size.</div>
            </div>
            <div className="small text-muted">Paper: {data.paper_size || 'A4'} • {data.orientation || 'portrait'} • DPI {data.dpi || 300}</div>
          </div>

          <div
            className="position-relative rounded-4 border overflow-hidden"
            style={{
              minHeight: '760px',
              backgroundImage: data.grid ? 'linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)' : 'none',
              backgroundSize: data.grid ? '24px 24px' : 'auto',
              backgroundColor: '#fff',
            }}
          >
            <div
              className="position-absolute"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '92%',
                height: '92%',
                border: data.show_safe_area ? '2px dashed rgba(239, 68, 68, 0.35)' : 'none',
                borderRadius: '20px',
                pointerEvents: 'none',
              }}
            />

            {layout.map((block) => (
              <button
                key={block.id}
                type="button"
                draggable
                onDragStart={() => setDragSourceId(block.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => swapBlocks(dragSourceId, block.id)}
                onClick={() => setActiveBlockId(block.id)}
                className={`position-absolute text-start p-2 rounded-3 border ${activeBlockId === block.id ? 'border-dark' : 'border-secondary-subtle'}`}
                style={{
                  left: `${block.x}%`,
                  top: `${block.y}%`,
                  width: `${block.width}%`,
                  height: `${block.height}%`,
                  background: block.enabled ? 'rgba(15,23,42,0.04)' : 'rgba(148,163,184,0.12)',
                  cursor: 'grab',
                  zIndex: activeBlockId === block.id ? 2 : 1,
                }}
              >
                <div className="fw-semibold small">{block.label}</div>
                <div className="small text-muted">Drag here</div>
                <div
                  className="position-absolute"
                  style={{ right: -1, bottom: -1, width: 18, height: 18, cursor: 'nwse-resize', background: 'rgba(15,23,42,0.7)', borderTopLeftRadius: 8 }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setActiveBlockId(block.id);
                    startResize(block.id);
                  }}
                />
              </button>
            ))}
          </div>

          <div className="row g-3 mt-3">
            {layout.filter((block) => block.id === activeBlockId).map((block) => (
              <div className="col-12" key={block.id}>
                <div className="p-3 rounded-4 border bg-light">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <div>
                      <div className="fw-semibold">{block.label}</div>
                      <div className="small text-muted">Adjust position and size</div>
                    </div>
                    <label className="d-flex align-items-center gap-2 small">
                      <input type="checkbox" checked={Boolean(block.enabled)} onChange={(event) => updateBlock(block.id, { enabled: event.target.checked })} />
                      Enabled
                    </label>
                  </div>
                  <div className="row g-2">
                    {['x', 'y', 'width', 'height'].map((field) => (
                      <div className="col-6 col-md-3" key={field}>
                        <label className="form-label small text-uppercase">{field}</label>
                        <input className="form-control form-control-sm" type="number" value={block[field]} onChange={(event) => updateBlock(block.id, { [field]: Number(event.target.value) })} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );

  function setAllBlocksVisible(value) {
    commitLayout(layout.map((block) => ({ ...block, enabled: value })));
  }
};

const UserManagementSection = ({ users, sessionsByUser, roleDraft, onRoleDraftChange, onRefreshSessions, onSaveRole, onReload }) => (
  <SectionCard
    title="User management"
    subtitle="Review access, update roles, and inspect active sessions."
    actions={<button className="btn btn-outline-dark" onClick={onReload}>Reload users</button>}
  >
    <div className="table-responsive">
      <table className="table align-middle mb-0">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Sessions</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="fw-semibold">{user.name}</div>
                <div className="small text-muted">ID: {user.id}</div>
              </td>
              <td>{user.email}</td>
              <td style={{ minWidth: '220px' }}>
                <select
                  className="form-select"
                  style={fieldStyle}
                  value={roleDraft[user.id] || user.role || 'Custom Role'}
                  onChange={(event) => onRoleDraftChange((current) => ({ ...current, [user.id]: event.target.value }))}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </td>
              <td>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => onRefreshSessions(user.id)}>
                  View
                </button>
              </td>
              <td>
                <button className="btn btn-sm btn-dark" onClick={() => onSaveRole(user.id)}>Save role</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="row g-3 mt-2">
      {users.map((user) => (
        <div className="col-12 col-xl-6" key={`sessions-${user.id}`}>
          <div className="p-3 rounded-4 border bg-light">
            <div className="fw-semibold mb-2">{user.name} sessions</div>
            {(sessionsByUser[user.id] || []).slice(0, 4).map((session) => (
              <div key={session.refresh_token_id} className="small text-muted d-flex justify-content-between gap-3 border-bottom py-2">
                <span>{prettyDate(session.created_at)}</span>
                <span>{session.revoked_at ? 'revoked' : 'active'}</span>
              </div>
            ))}
            {!sessionsByUser[user.id]?.length && <div className="small text-muted">No session data loaded yet.</div>}
          </div>
        </div>
      ))}
    </div>
  </SectionCard>
);

const ReminderSettingsSection = ({ data, onChange, onSave }) => (
  <SectionCard
    title="Reminders"
    subtitle="Configure reminder cadence for payment and renewal workflows."
    actions={<button className="btn btn-dark" onClick={onSave}>Save reminders</button>}
  >
    <div className="row g-3">
      {[
        ['enable_payment_reminders', 'Enable payment reminders', true],
        ['payment_days_before', 'Payment reminder lead time', false],
        ['enable_subscription_reminders', 'Enable subscription reminders', true],
        ['subscription_days_before', 'Subscription reminder lead time', false],
      ].map(([field, label, isToggle]) => (
        <div className="col-12 col-md-6" key={field}>
          <label className="form-label fw-semibold">{label}</label>
          {isToggle ? (
            <select
              className="form-select"
              style={fieldStyle}
              value={data[field] ? 'true' : 'false'}
              onChange={(event) => onChange({ ...data, [field]: event.target.value === 'true' })}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          ) : (
            <input
              className="form-control"
              style={fieldStyle}
              type="number"
              value={data[field] || 0}
              onChange={(event) => onChange({ ...data, [field]: event.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  </SectionCard>
);

const SupportSettingsSection = ({ data, onChange, onSave }) => (
  <SectionCard
    title="Help & support"
    subtitle="Keep the internal support contacts visible and current."
    actions={<button className="btn btn-dark" onClick={onSave}>Save support settings</button>}
  >
    <div className="d-grid gap-4">
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Business hours</label>
          <input className="form-control" style={fieldStyle} value={data.business_hours || ''} onChange={(event) => onChange({ ...data, business_hours: event.target.value })} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Live chat URL</label>
          <input className="form-control" style={fieldStyle} value={data.live_chat_url || ''} onChange={(event) => onChange({ ...data, live_chat_url: event.target.value })} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Knowledge base URL</label>
          <input className="form-control" style={fieldStyle} value={data.knowledge_base_url || ''} onChange={(event) => onChange({ ...data, knowledge_base_url: event.target.value })} />
        </div>
      </div>

      <div className="d-grid gap-3">
        {(data.contact_points || []).map((contact, index) => (
          <div className="p-3 rounded-4 border bg-light" key={contact.id || `${contact.label}-${index}`}>
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-3">
                <label className="form-label fw-semibold">Label</label>
                <input
                  className="form-control"
                  style={fieldStyle}
                  value={contact.label || ''}
                  onChange={(event) => {
                    const nextContacts = [...(data.contact_points || [])];
                    nextContacts[index] = { ...nextContacts[index], label: event.target.value };
                    onChange({ ...data, contact_points: nextContacts });
                  }}
                />
              </div>
              <div className="col-12 col-md-2">
                <label className="form-label fw-semibold">Type</label>
                <input
                  className="form-control"
                  style={fieldStyle}
                  value={contact.type || ''}
                  onChange={(event) => {
                    const nextContacts = [...(data.contact_points || [])];
                    nextContacts[index] = { ...nextContacts[index], type: event.target.value };
                    onChange({ ...data, contact_points: nextContacts });
                  }}
                />
              </div>
              <div className="col-12 col-md-5">
                <label className="form-label fw-semibold">Value</label>
                <input
                  className="form-control"
                  style={fieldStyle}
                  value={contact.value || ''}
                  onChange={(event) => {
                    const nextContacts = [...(data.contact_points || [])];
                    nextContacts[index] = { ...nextContacts[index], value: event.target.value };
                    onChange({ ...data, contact_points: nextContacts });
                  }}
                />
              </div>
              <div className="col-12 col-md-2 d-flex gap-2 justify-content-md-end flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    if (index === 0) return;
                    const nextContacts = [...(data.contact_points || [])];
                    [nextContacts[index - 1], nextContacts[index]] = [nextContacts[index], nextContacts[index - 1]];
                    onChange({ ...data, contact_points: nextContacts });
                  }}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    const nextContacts = [...(data.contact_points || [])];
                    if (index >= nextContacts.length - 1) return;
                    [nextContacts[index + 1], nextContacts[index]] = [nextContacts[index], nextContacts[index + 1]];
                    onChange({ ...data, contact_points: nextContacts });
                  }}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onChange({ ...data, contact_points: (data.contact_points || []).filter((_, contactIndex) => contactIndex !== index) })}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="d-flex gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-outline-dark"
          onClick={() => onChange({
            ...data,
            contact_points: [
              ...(data.contact_points || []),
              { id: `contact-${Date.now()}`, label: 'New contact', value: '', type: 'custom' },
            ],
          })}
        >
          Add contact
        </button>
      </div>

      <div>
        <label className="form-label fw-semibold">Support notes</label>
        <textarea
          className="form-control"
          style={{ ...fieldStyle, minHeight: '120px' }}
          value={data.support_notes || ''}
          onChange={(event) => onChange({ ...data, support_notes: event.target.value })}
        />
      </div>
    </div>
  </SectionCard>
);

const ThemeManagerSection = ({ themes, themeDraft, onThemeDraftChange, onSave, onActivate, onDelete, saving }) => {
  const previewTheme = themeDraft.theme_value || getThemePresets().retail;

  return (
    <div className="d-grid gap-4">
      <SectionCard
        title="Theme manager"
        subtitle="Preview the application shell, then save and activate a theme. This preview is not invoice-specific."
        actions={<button className="btn btn-dark" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save theme'}</button>}
      >
        <div className="row g-4">
          <div className="col-12 col-lg-5">
            <label className="form-label fw-semibold">Theme key</label>
            <input className="form-control" style={fieldStyle} value={themeDraft.theme_key} onChange={(event) => onThemeDraftChange({ ...themeDraft, theme_key: event.target.value })} />
            <label className="form-label fw-semibold mt-3">Theme name</label>
            <input className="form-control" style={fieldStyle} value={themeDraft.theme_name} onChange={(event) => onThemeDraftChange({ ...themeDraft, theme_name: event.target.value })} />
            <div className="mt-4">
              <div className="fw-semibold mb-2">Available themes</div>
              <div className="d-grid gap-2">
                {themes.map((theme) => (
                  <button key={theme.theme_key} type="button" className={`btn text-start ${theme.is_active ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => onThemeDraftChange({ theme_key: theme.theme_key, theme_name: theme.theme_name, theme_value: theme.theme_value || getThemePresets()[theme.theme_key] || getThemePresets().retail })}>
                    <div className="fw-semibold d-flex justify-content-between gap-2"><span>{theme.theme_name}</span><span className="small opacity-75">{theme.theme_key}</span></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-7">
            <div style={previewShellStyle}>
              <div style={{ background: previewTheme.sidebar || '#111827', color: '#fff', padding: '1rem 1.25rem' }} className="d-flex justify-content-between align-items-center">
                <div className="fw-bold">Pearry's Dashboard</div>
                <div className="small opacity-75">Application preview</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '320px' }}>
                <div style={{ background: previewTheme.sidebarSoft || '#1e293b', color: '#fff', padding: '1rem' }}>
                  <div className="small text-uppercase opacity-75 mb-3">Navigation</div>
                  {['Overview', 'Products', 'Orders', 'Employees'].map((item) => (
                    <div key={item} className="py-2 px-3 rounded-3 mb-2" style={{ background: item === 'Overview' ? previewTheme.accent || '#4f46e5' : 'rgba(255,255,255,0.08)' }}>
                      {item}
                    </div>
                  ))}
                </div>
                <div style={{ background: previewTheme.surface || '#fff', padding: '1.25rem' }}>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <div className="px-3 py-2 rounded-3 text-white" style={{ background: previewTheme.accent || '#4f46e5' }}>Accent</div>
                    <div className="px-3 py-2 rounded-3 text-white" style={{ background: previewTheme.accentDark || '#3730a3' }}>Accent dark</div>
                  </div>
                  <div className="row g-3">
                    {[1, 2, 3].map((tile) => (
                      <div className="col-12 col-md-4" key={tile}>
                        <div className="p-3 rounded-4 border h-100" style={{ background: 'rgba(15, 23, 42, 0.03)' }}>
                          <div className="small text-muted">Metric {tile}</div>
                          <div className="fs-4 fw-bold">{tile * 24}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Theme library"
        subtitle="Activate or remove saved theme profiles."
        actions={null}
      >
        <div className="row g-3">
          {themes.map((theme) => (
            <div className="col-12 col-md-6" key={theme.theme_key}>
              <div className="p-3 rounded-4 border h-100 d-flex flex-column gap-2">
                <div className="d-flex justify-content-between gap-2">
                  <div>
                    <div className="fw-semibold">{theme.theme_name}</div>
                    <div className="small text-muted">{theme.theme_key}</div>
                  </div>
                  <span className={`badge ${theme.is_active ? 'text-bg-success' : 'text-bg-secondary'}`}>{theme.is_active ? 'active' : 'saved'}</span>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <button className="btn btn-sm btn-dark" onClick={() => onActivate(theme.theme_key)}>Activate</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(theme.theme_key)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

const InvoiceDesignerSection = ({ templates, templateDraft, onTemplateDraftChange, onSaveTemplate, onActivateTemplate, onDeleteTemplate, saving }) => (
  <div className="d-grid gap-4">
    <SectionCard
      title="Invoice designer"
      subtitle="Manage templates here. The full invoice preview lives in the dedicated Invoice Designer page, not in the general settings hub."
      actions={<button className="btn btn-dark" onClick={onSaveTemplate} disabled={saving}>{saving ? 'Saving...' : 'Save template'}</button>}
    >
      <div className="row g-3 mb-4">
        {[
          ['template_key', 'Template key'],
          ['template_name', 'Template name'],
          ['template_category', 'Template category'],
        ].map(([field, label]) => (
          <div className="col-12 col-md-4" key={field}>
            <label className="form-label fw-semibold">{label}</label>
            <input className="form-control" style={fieldStyle} value={templateDraft[field] || ''} onChange={(event) => onTemplateDraftChange({ ...templateDraft, [field]: event.target.value })} />
          </div>
        ))}
      </div>
      <div className="d-flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline-dark" onClick={() => window.dispatchEvent(new CustomEvent('erp:open-invoice-designer'))}>
          Open invoice designer
        </button>
      </div>
    </SectionCard>

    <SectionCard title="Template library" subtitle="Activate or delete invoice templates from the system store." actions={null}>
      <div className="row g-3">
        {templates.map((template) => (
          <div className="col-12 col-md-6" key={template.template_key}>
            <div className="p-3 rounded-4 border h-100 d-flex flex-column gap-2">
              <div className="d-flex justify-content-between gap-2">
                <div>
                  <div className="fw-semibold">{template.template_name}</div>
                  <div className="small text-muted">{template.template_key}</div>
                </div>
                <span className={`badge ${template.is_default ? 'text-bg-success' : 'text-bg-secondary'}`}>{template.is_default ? 'default' : 'saved'}</span>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-sm btn-dark" onClick={() => onActivateTemplate(template.template_key)}>Activate</button>
                <button className="btn btn-sm btn-outline-danger" onClick={() => onDeleteTemplate(template.template_key)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 p-3 rounded-4 border bg-light">
        <div className="fw-semibold mb-1">Full preview location</div>
        <div className="text-muted">The full invoice canvas is reserved for <strong>CustomInvoice</strong> in the main dashboard navigation.</div>
      </div>
    </SectionCard>
  </div>
);

const ActivityFeedCard = ({ logs }) => (
  <SectionCard title="Recent system activity" subtitle="Live settings-related events and notifications." actions={null}>
    <div className="row g-3">
      {(logs || []).slice(0, 6).map((log) => (
        <div className="col-12 col-md-6" key={log.notification_id}>
          <div className="p-3 rounded-4 border h-100">
            <div className="d-flex justify-content-between gap-3">
              <div className="fw-semibold">{log.notification_title || log.notification_type || 'Event'}</div>
              <span className={`badge ${log.notification_status === 'sent' ? 'text-bg-success' : 'text-bg-secondary'}`}>{log.notification_status || 'queued'}</span>
            </div>
            <div className="small text-muted mt-1">{log.notification_body || 'No details provided.'}</div>
            <div className="small text-muted mt-2">{prettyDate(log.created_at)}</div>
          </div>
        </div>
      ))}
      {!logs?.length && <div className="col-12"><div className="text-muted">No activity yet.</div></div>}
    </div>
  </SectionCard>
);

export default SettingsCenter;