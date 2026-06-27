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
  header_color: '#0f172a',
  accent_color: '#2563eb',
  logo_variant: 'full',
  is_enabled: true,
  notes: '',
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

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetchInvoiceTemplates();
      const nextTemplates = Array.isArray(response.data?.templates) ? response.data.templates : [];
      setTemplates(nextTemplates);
      const selected = nextTemplates.find((template) => template.template_key === selectedKey) || nextTemplates[0];
      if (selected) {
        const templateData = safeJson(selected.template_value || selected.template_data || {});
        setDraft({
          ...emptyTemplate,
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
  }), [draft]);

  const applyTemplate = (template) => {
    const templateData = safeJson(template.template_value || template.template_data || {});
    setSelectedKey(template.template_key);
    setDraft({
      ...emptyTemplate,
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
    const templateData = safeJson(template.template_value || template.template_data || {});
    const cloneKey = `${template.template_key}-copy`;
    setSelectedKey(cloneKey);
    setDraft({
      ...emptyTemplate,
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
      setDraft({ ...emptyTemplate, ...parsed });
    } catch {
      notify('Invalid template JSON', 'danger');
    }
    event.target.value = '';
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
              <div>
                <label className="form-label">Template Key</label>
                <input className="form-control" value={draft.template_key} onChange={(event) => setDraft((current) => ({ ...current, template_key: event.target.value }))} />
              </div>
              <div>
                <label className="form-label">Template Name</label>
                <input className="form-control" value={draft.template_name} onChange={(event) => setDraft((current) => ({ ...current, template_name: event.target.value }))} />
              </div>
              <div>
                <label className="form-label">Category</label>
                <input className="form-control" value={draft.template_category} onChange={(event) => setDraft((current) => ({ ...current, template_category: event.target.value }))} />
              </div>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">Header Color</label>
                  <input type="color" className="form-control form-control-color w-100" value={draft.header_color} onChange={(event) => setDraft((current) => ({ ...current, header_color: event.target.value }))} />
                </div>
                <div className="col-6">
                  <label className="form-label">Accent Color</label>
                  <input type="color" className="form-control form-control-color w-100" value={draft.accent_color} onChange={(event) => setDraft((current) => ({ ...current, accent_color: event.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Logo Variant</label>
                <select className="form-select" value={draft.logo_variant} onChange={(event) => setDraft((current) => ({ ...current, logo_variant: event.target.value }))}>
                  <option value="full">Full</option>
                  <option value="icon">Icon</option>
                  <option value="text">Text</option>
                </select>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked={Boolean(draft.is_enabled)} onChange={(event) => setDraft((current) => ({ ...current, is_enabled: event.target.checked }))} id="invoice-template-enabled" />
                <label className="form-check-label" htmlFor="invoice-template-enabled">Enabled</label>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows="4" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
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
            <div className="rounded-4 border overflow-hidden" style={{ background: '#fff' }}>
              <div style={{ background: previewData.header_color || '#0f172a', color: '#fff', padding: '1.25rem' }}>
                <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                  <div>
                    <div className="fw-bold fs-4">{previewData.template_name}</div>
                    <div className="small opacity-75">{previewData.template_key} · {previewData.template_category}</div>
                  </div>
                  <div className="px-3 py-2 rounded-pill" style={{ background: previewData.accent_color || '#2563eb' }}>
                    {previewData.logo_variant.toUpperCase()} LOGO
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="p-3 rounded-4 border h-100">
                      <div className="small text-muted">Invoice Header</div>
                      <div className="fw-semibold">Company and billing summary</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 rounded-4 border h-100">
                      <div className="small text-muted">Item Table</div>
                      <div className="fw-semibold">Quantity, rate, tax, and total</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 rounded-4 border h-100">
                      <div className="small text-muted">Footer</div>
                      <div className="fw-semibold">Signature, QR, and terms</div>
                    </div>
                  </div>
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
