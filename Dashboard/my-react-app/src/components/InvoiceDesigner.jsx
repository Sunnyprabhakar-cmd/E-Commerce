import { useEffect, useMemo, useState } from 'react';
import AppCard from './common/AppCard';
import EmptyState from './common/EmptyState';
import LoadingSpinner from './common/LoadingSpinner';
import PageHeader from './common/PageHeader';
import { notify } from '../utils/notify';
import {
  activateInvoiceTemplate,
  deleteInvoiceTemplate,
  fetchInvoiceTemplates,
  saveInvoiceTemplate,
} from '../services/systemService';

const emptyTemplate = {
  template_key: 'invoice-default',
  template_name: 'Default Invoice',
  template_category: 'sales',
  logo_mode: 'upload',
  logo_url: '',
  logo_name: '',
  header_color: '#0f172a',
  accent_color: '#2563eb',
  primary_color: '#0f172a',
  secondary_color: '#2563eb',
  font_family: 'Inter',
  font_size: '14px',
  border_style: 'solid',
  corner_radius: '18px',
  logo_variant: 'full',
  is_enabled: true,
  notes: '',
  typography: {
    header_text: 'Invoice',
    company_name: 'Company Name',
    customer_text: 'Customer',
    table_headers: 'Product,Qty,Rate,Subtotal',
    footer_text: 'Thank you for your business',
    notes_text: 'Notes',
  },
  layout: ['header', 'company', 'customer', 'invoice', 'items', 'totals', 'qr', 'signature', 'footer', 'notes'],
};

const layoutLibrary = [
  { key: 'header', label: 'Header' },
  { key: 'company', label: 'Company Details' },
  { key: 'customer', label: 'Customer Details' },
  { key: 'invoice', label: 'Invoice Information' },
  { key: 'items', label: 'Items Table' },
  { key: 'totals', label: 'Totals' },
  { key: 'footer', label: 'Footer' },
  { key: 'notes', label: 'Notes' },
  { key: 'qr', label: 'QR Code' },
  { key: 'signature', label: 'Signature' },
];

const typographyDefaults = emptyTemplate.typography;

const ensureObject = (value, fallback) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return fallback;
};

const normalizeLayout = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [...emptyTemplate.layout];
  }

  const known = new Set(layoutLibrary.map((block) => block.key));
  const unique = [];
  value.forEach((entry) => {
    if (known.has(entry) && !unique.includes(entry)) {
      unique.push(entry);
    }
  });
  layoutLibrary.forEach((block) => {
    if (!unique.includes(block.key)) {
      unique.push(block.key);
    }
  });
  return unique;
};

const safeJson = (value) => {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value || {});
  } catch {
    return {};
  }
};

const InvoiceDesigner = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedKey, setSelectedKey] = useState(emptyTemplate.template_key);
  const [draft, setDraft] = useState(emptyTemplate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState('');

  const mergeTemplateData = (template) => {
    const templateData = safeJson(template.template_value || template.template_data || {});
    return {
      ...emptyTemplate,
      ...templateData,
      typography: {
        ...typographyDefaults,
        ...ensureObject(templateData.typography, {}),
      },
      layout: normalizeLayout(templateData.layout || templateData.sections),
    };
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetchInvoiceTemplates();
      const nextTemplates = Array.isArray(response.data?.templates) ? response.data.templates : [];
      setTemplates(nextTemplates);
      const selected = nextTemplates.find((template) => template.template_key === selectedKey) || nextTemplates[0];
      if (selected) {
        const templateData = mergeTemplateData(selected);
        setDraft({
          ...templateData,
          template_key: selected.template_key || emptyTemplate.template_key,
          template_name: selected.template_name || emptyTemplate.template_name,
          template_category: selected.template_category || emptyTemplate.template_category,
          is_enabled: selected.is_default ?? selected.is_enabled ?? true,
        });
        setSelectedKey(selected.template_key || emptyTemplate.template_key);
      }
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to load invoice templates', 'danger');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewData = useMemo(() => ({
    ...draft,
    title: draft.template_name || 'Invoice Template',
    typography: {
      ...typographyDefaults,
      ...ensureObject(draft.typography, {}),
    },
    layout: normalizeLayout(draft.layout),
  }), [draft]);

  const applyTemplate = (template) => {
    const templateData = mergeTemplateData(template);
    setSelectedKey(template.template_key);
    setDraft({
      ...templateData,
      template_key: template.template_key,
      template_name: template.template_name || template.template_key,
      template_category: template.template_category || 'sales',
      is_enabled: template.is_default ?? true,
    });
  };

  const saveTemplate = async () => {
    if (!draft.template_key || !draft.template_name) {
      notify('Template key and name are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      await saveInvoiceTemplate(draft.template_key, {
        ...draft,
        template_value: JSON.stringify(draft),
      });
      notify('Invoice template saved', 'success');
      await loadTemplates();
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to save invoice template', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const cloneTemplate = (template) => {
    const templateData = mergeTemplateData(template);
    const cloneKey = `${template.template_key}-copy`;
    setSelectedKey(cloneKey);
    setDraft({
      ...templateData,
      template_key: cloneKey,
      template_name: `${template.template_name || template.template_key} Copy`,
      is_enabled: false,
    });
  };

  const exportTemplate = (template) => {
    const payload = JSON.stringify(template, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.template_key}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      setSelectedKey(parsed.template_key || emptyTemplate.template_key);
      setDraft({
        ...emptyTemplate,
        ...parsed,
        typography: {
          ...typographyDefaults,
          ...ensureObject(parsed.typography, {}),
        },
        layout: normalizeLayout(parsed.layout || parsed.sections),
        template_key: parsed.template_key || emptyTemplate.template_key,
      });
    } catch {
      notify('Invalid template JSON', 'danger');
    }
    event.target.value = '';
  };

  const updateDraftField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateTypographyField = (field, value) => {
    setDraft((current) => ({
      ...current,
      typography: {
        ...typographyDefaults,
        ...ensureObject(current.typography, {}),
        [field]: value,
      },
    }));
  };

  const moveLayoutBlock = (blockKey, direction) => {
    setDraft((current) => {
      const layout = normalizeLayout(current.layout);
      const index = layout.indexOf(blockKey);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= layout.length) {
        return current;
      }
      const copy = [...layout];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return { ...current, layout: copy };
    });
  };

  const handleLayoutDragStart = (blockKey) => {
    setDraggedBlock(blockKey);
  };

  const handleLayoutDrop = (targetKey) => {
    if (!draggedBlock || draggedBlock === targetKey) {
      setDraggedBlock('');
      return;
    }
    setDraft((current) => {
      const layout = normalizeLayout(current.layout);
      const sourceIndex = layout.indexOf(draggedBlock);
      const targetIndex = layout.indexOf(targetKey);
      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }
      const copy = [...layout];
      const [moved] = copy.splice(sourceIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return { ...current, layout: copy };
    });
    setDraggedBlock('');
  };

  if (loading) {
    return <LoadingSpinner className="mt-5" label="Loading invoice designer..." />;
  }

  return (
    <div className="settings-center-shell invoice-designer-shell">
      <PageHeader
        kicker="Invoice Designer"
        title="Dedicated invoice template workspace"
        description="Build, clone, import, and activate invoice templates without mixing this flow with the custom invoice builder."
      />

      <div className="row g-4 mt-1">
        <div className="col-12 col-xl-4">
          <AppCard title="Template editor" subtitle="Edit the active draft and save it into the template store." className="h-100">
            <div className="d-grid gap-3">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Template Key</label>
                  <input className="form-control" value={draft.template_key} onChange={(event) => updateDraftField('template_key', event.target.value)} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Template Name</label>
                  <input className="form-control" value={draft.template_name} onChange={(event) => updateDraftField('template_name', event.target.value)} />
                </div>
                <div className="col-12">
                  <label className="form-label">Category</label>
                  <input className="form-control" value={draft.template_category} onChange={(event) => updateDraftField('template_category', event.target.value)} />
                </div>
              </div>

              <div className="p-3 rounded-4 border d-grid gap-3">
                <div>
                  <div className="fw-semibold mb-1">Logo</div>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <label className="btn btn-outline-dark mb-0">
                      Upload from device
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setDraft((current) => ({
                              ...current,
                              logo_mode: 'upload',
                              logo_url: String(reader.result || ''),
                              logo_name: file.name,
                            }));
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <button type="button" className="btn btn-outline-secondary" onClick={() => updateDraftField('logo_mode', 'url')}>Import from URL</button>
                  </div>
                  <div className="row g-2">
                    <div className="col-12">
                      <input className="form-control" placeholder="Logo URL" value={draft.logo_url} onChange={(event) => updateDraftField('logo_url', event.target.value)} />
                    </div>
                    <div className="col-12">
                      <select className="form-select" value={draft.logo_mode} onChange={(event) => updateDraftField('logo_mode', event.target.value)}>
                        <option value="upload">Device upload</option>
                        <option value="url">URL import</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="invoice-designer-logo-preview d-flex align-items-center justify-content-center border rounded-4 overflow-hidden">
                  {draft.logo_url ? <img src={draft.logo_url} alt={draft.logo_name || 'Logo preview'} className="img-fluid" /> : <span className="text-muted small">Logo preview</span>}
                </div>
              </div>

              <div className="p-3 rounded-4 border d-grid gap-3">
                <div className="fw-semibold">Theme Settings</div>
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label">Primary color</label>
                    <input type="color" className="form-control form-control-color w-100" value={draft.primary_color || draft.header_color} onChange={(event) => updateDraftField('primary_color', event.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Secondary color</label>
                    <input type="color" className="form-control form-control-color w-100" value={draft.secondary_color || draft.accent_color} onChange={(event) => updateDraftField('secondary_color', event.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Font family</label>
                    <input className="form-control" value={draft.font_family} onChange={(event) => updateDraftField('font_family', event.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Font size</label>
                    <input className="form-control" value={draft.font_size} onChange={(event) => updateDraftField('font_size', event.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Border style</label>
                    <select className="form-select" value={draft.border_style} onChange={(event) => updateDraftField('border_style', event.target.value)}>
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="double">Double</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Corner radius</label>
                    <input className="form-control" value={draft.corner_radius} onChange={(event) => updateDraftField('corner_radius', event.target.value)} />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-4 border d-grid gap-3">
                <div className="fw-semibold">Typography</div>
                <div className="row g-3">
                  {[
                    ['header_text', 'Header text'],
                    ['company_name', 'Company name'],
                    ['customer_text', 'Customer text'],
                    ['table_headers', 'Table headers'],
                    ['footer_text', 'Footer'],
                    ['notes_text', 'Notes'],
                  ].map(([field, label]) => (
                    <div className="col-12" key={field}>
                      <label className="form-label">{label}</label>
                      <input className="form-control" value={draft.typography?.[field] || ''} onChange={(event) => updateTypographyField(field, event.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-4 border d-grid gap-3">
                <div className="fw-semibold">Drag-and-drop layout builder</div>
                <div className="d-grid gap-2">
                  {normalizeLayout(draft.layout).map((blockKey) => {
                    const block = layoutLibrary.find((item) => item.key === blockKey);
                    return (
                      <div
                        key={blockKey}
                        className="invoice-layout-block d-flex justify-content-between align-items-center gap-2"
                        draggable
                        onDragStart={() => handleLayoutDragStart(blockKey)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleLayoutDrop(blockKey)}
                      >
                        <div>
                          <strong>{block?.label || blockKey}</strong>
                          <div className="small text-muted">Drag to reorder the invoice flow.</div>
                        </div>
                        <div className="d-flex gap-2">
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => moveLayoutBlock(blockKey, -1)}>Up</button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => moveLayoutBlock(blockKey, 1)}>Down</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked={Boolean(draft.is_enabled)} onChange={(event) => updateDraftField('is_enabled', event.target.checked)} id="invoice-template-enabled" />
                <label className="form-check-label" htmlFor="invoice-template-enabled">Enabled</label>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows="4" value={draft.notes} onChange={(event) => updateDraftField('notes', event.target.value)} />
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-dark" onClick={saveTemplate} disabled={saving}>{saving ? 'Saving...' : 'Save template'}</button>
                <label className="btn btn-outline-dark mb-0">
                  Import
                  <input type="file" accept="application/json" hidden onChange={importTemplate} />
                </label>
              </div>
            </div>
          </AppCard>
        </div>

        <div className="col-12 col-xl-8">
          <AppCard title="Template preview" subtitle="A dedicated invoice designer canvas, isolated from the invoice builder." className="h-100">
            <div className="rounded-4 border overflow-hidden" style={{ background: '#fff', fontFamily: previewData.font_family, fontSize: previewData.font_size, borderStyle: previewData.border_style, borderRadius: previewData.corner_radius || '18px' }}>
              <div style={{ background: previewData.primary_color || previewData.header_color || '#0f172a', color: '#fff', padding: '1.25rem', borderRadius: previewData.corner_radius || '18px' }}>
                <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                  <div>
                    <div className="small opacity-75">{previewData.typography?.header_text || 'Invoice'}</div>
                    <div className="fw-bold fs-4">{previewData.typography?.company_name || previewData.template_name}</div>
                    <div className="small opacity-75">{previewData.template_key} · {previewData.template_category}</div>
                  </div>
                  <div className="px-3 py-2 rounded-pill d-flex align-items-center gap-2" style={{ background: previewData.secondary_color || previewData.accent_color || '#2563eb' }}>
                    {previewData.logo_url ? <img src={previewData.logo_url} alt={previewData.logo_name || 'Logo'} style={{ width: '28px', height: '28px', objectFit: 'contain' }} /> : null}
                    <span>{previewData.logo_variant.toUpperCase()} LOGO</span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="p-3 rounded-4 border h-100">
                      <div className="small text-muted">Invoice Header</div>
                      <div className="fw-semibold">{previewData.typography?.header_text || 'Company and billing summary'}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 rounded-4 border h-100">
                      <div className="small text-muted">Item Table</div>
                      <div className="fw-semibold">{previewData.typography?.table_headers || 'Quantity, rate, tax, and total'}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 rounded-4 border h-100">
                      <div className="small text-muted">Footer</div>
                      <div className="fw-semibold">{previewData.typography?.footer_text || 'Signature, QR, and terms'}</div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2 mb-3">
                  {previewData.layout.map((blockKey) => {
                    const block = layoutLibrary.find((item) => item.key === blockKey);
                    return (
                      <span key={blockKey} className="badge text-bg-light border text-dark">{block?.label || blockKey}</span>
                    );
                  })}
                </div>

                <div className="d-flex flex-wrap gap-2 mb-3">
                  <button type="button" className="btn btn-outline-dark" onClick={() => exportTemplate(draft)}>Export draft</button>
                  <button type="button" className="btn btn-dark" onClick={() => activateInvoiceTemplate(selectedKey)}>Activate selected</button>
                </div>

                <div className="small text-muted">Templates available</div>
                <div className="row g-3 mt-1">
                  {templates.length > 0 ? templates.map((template) => (
                    <div className="col-12 col-md-6" key={template.template_key}>
                      <div className={`p-3 rounded-4 border h-100 ${template.template_key === selectedKey ? 'border-dark' : ''}`}>
                        <div className="d-flex justify-content-between gap-3">
                          <div>
                            <div className="fw-semibold">{template.template_name}</div>
                            <div className="small text-muted">{template.template_key}</div>
                          </div>
                          <span className={`badge ${template.is_default ? 'text-bg-success' : 'text-bg-secondary'}`}>{template.is_default ? 'active' : 'saved'}</span>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-3">
                          <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => applyTemplate(template)}>Load</button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => cloneTemplate(template)}>Clone</button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => exportTemplate(template)}>Export</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteInvoiceTemplate(template.template_key)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  )) : <EmptyState title="No templates found" description="Create the first invoice template to start building designs." />}
                </div>
              </div>
            </div>
          </AppCard>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDesigner;
