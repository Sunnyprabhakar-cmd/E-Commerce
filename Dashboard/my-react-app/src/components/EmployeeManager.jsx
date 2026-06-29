import { useEffect, useMemo, useState } from 'react';
import AppCard from './common/AppCard';
import EmptyState from './common/EmptyState';
import LoadingSpinner from './common/LoadingSpinner';
import PageHeader from './common/PageHeader';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';
import {
  adjustEmployeeSalary,
  deleteEmployeeProfile,
  fetchEmployeeSalaryHistory,
  fetchEmployees as fetchEmployeesService,
  fetchSalarySummary,
  generateEmployeeInvite,
  saveEmployeePermissions,
  saveEmployeeProfile,
} from '../services/adminService';

const emptyEmployeeForm = {
  employee_id: '',
  employee_name: '',
  phone_country_code: '+91',
  phone: '',
  aadhar_card: '',
  salary: '',
  notes: '',
  is_active: true,
};

const countryOptions = [
  { code: '+91', label: 'India', flag: '🇮🇳', example: '10 digits' },
  { code: '+1', label: 'United States', flag: '🇺🇸', example: '10 digits' },
  { code: '+44', label: 'United Kingdom', flag: '🇬🇧', example: '10 to 11 digits' },
  { code: '+971', label: 'United Arab Emirates', flag: '🇦🇪', example: '8 to 9 digits' },
];

const permissionSections = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { key: 'products', label: 'Products', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'stock', label: 'Stock', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'purchase', label: 'Purchase', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'sales', label: 'Sales', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'invoices', label: 'Invoices', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'custom_invoice', label: 'Custom Invoice', actions: ['view', 'create', 'update', 'delete', 'export', 'approve', 'use'] },
  { key: 'orders', label: 'Orders', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'customers', label: 'Customers', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'suppliers', label: 'Suppliers', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'employees', label: 'Employees', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'reports', label: 'Reports', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'finance', label: 'Finance', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'expenses', label: 'Expenses', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'settings', label: 'Settings', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'theme_manager', label: 'Theme Manager', actions: ['view', 'create', 'update', 'delete', 'export', 'approve', 'use'] },
  { key: 'invoice_designer', label: 'Invoice Designer', actions: ['view', 'create', 'update', 'delete', 'export', 'approve', 'use'] },
  { key: 'print_settings', label: 'Print Settings', actions: ['view', 'create', 'update', 'delete', 'export', 'approve', 'use'] },
  { key: 'business_settings', label: 'Business Settings', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'backup_restore', label: 'Backup & Restore', actions: ['view', 'create', 'update', 'delete', 'export', 'approve', 'use'] },
  { key: 'audit_logs', label: 'Audit Logs', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
  { key: 'user_management', label: 'User Management', actions: ['view', 'create', 'update', 'delete', 'export', 'approve'] },
];

const buildEmptyPermissionMatrix = () => Object.fromEntries(
  permissionSections.map((section) => [section.key, Object.fromEntries(section.actions.map((action) => [action, false]))])
);

const rolePermissionTemplates = {
  admin: permissionSections.reduce((matrix, section) => {
    matrix[section.key] = Object.fromEntries(section.actions.map((action) => [action, true]));
    return matrix;
  }, {}),
  manager: {
    dashboard: { view: true },
    products: { view: true, create: true, update: true, export: true },
    stock: { view: true, update: true, export: true },
    sales: { view: true, create: true, update: true, approve: true },
    invoices: { view: true, create: true, update: true, export: true },
    orders: { view: true, update: true, approve: true },
    customers: { view: true, create: true, update: true },
    suppliers: { view: true, create: true, update: true },
    reports: { view: true, export: true },
    finance: { view: true, approve: true },
    settings: { view: true },
    invoice_designer: { view: true, use: true },
  },
  finance: {
    dashboard: { view: true },
    invoices: { view: true, create: true, update: true, export: true, approve: true },
    finance: { view: true, create: true, update: true, approve: true },
    expenses: { view: true, create: true, update: true, approve: true },
    reports: { view: true, export: true },
    audit_logs: { view: true, export: true },
    user_management: { view: true },
  },
  employee: {
    dashboard: { view: true },
    products: { view: true },
    stock: { view: true },
    sales: { view: true, create: true },
    orders: { view: true },
    invoices: { view: true },
    customers: { view: true },
    reports: { view: true },
    invoice_designer: { view: true, use: true },
  },
};

const clonePermissionMatrix = (matrix = {}) => {
  const next = buildEmptyPermissionMatrix();
  permissionSections.forEach((section) => {
    const sectionValues = matrix?.[section.key] || {};
    section.actions.forEach((action) => {
      next[section.key][action] = Boolean(sectionValues[action]);
    });
  });
  return next;
};

const templateMatrix = (role) => clonePermissionMatrix(rolePermissionTemplates[role] || {});

const flattenLegacyPermissionFlags = (matrix) => ({
  can_create_product: Boolean(matrix.products?.create),
  can_delete_product: Boolean(matrix.products?.delete),
  can_update_product: Boolean(matrix.products?.update),
  can_apply_discount: Boolean(matrix.sales?.approve || matrix.invoices?.approve),
  can_manage_stock: Boolean(matrix.stock?.update || matrix.stock?.create),
  can_manage_employees: Boolean(matrix.employees?.update || matrix.employees?.approve),
  can_manage_salary: Boolean(matrix.finance?.approve),
});

const emptySalaryForm = {
  increase_salary: '',
  decrease_salary: '',
  bonus: '',
  deduction: '',
  effective_date: '',
  remarks: '',
};

const detailTabs = [
  { id: 'profile', label: 'Profile' },
  { id: 'salary', label: 'Salary' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'activity', label: 'Activity' },
];

const normalizeEmployee = (employee) => ({
  id: employee.employee_id ?? employee.id ?? '',
  employee_id: employee.employee_id ?? employee.id ?? '',
  employee_name: employee.employee_name ?? employee.name ?? '',
  phone: employee.phone ?? '',
  phone_country_code: String(employee.phone ?? '').match(/^\+\d+/)?.[0] || '+91',
  aadhar_card: employee.aadhar_card ?? '',
  salary: Number(employee.salary ?? 0),
  notes: employee.notes ?? '',
  is_active: employee.is_active ?? employee.active ?? true,
  created_at: employee.created_at ?? null,
  updated_at: employee.updated_at ?? null,
  invite_token: employee.invite_token ?? null,
  invite_status: employee.invite_status ?? 'none',
  invite_expires_at: employee.invite_expires_at ?? null,
  invite_used_at: employee.invite_used_at ?? null,
  employee_role: employee.employee_role ?? employee.role ?? 'employee',
  permissions_json: employee.permissions_json ?? {},
  can_create_product: Boolean(employee.can_create_product),
  can_delete_product: Boolean(employee.can_delete_product),
  can_update_product: Boolean(employee.can_update_product),
  can_apply_discount: Boolean(employee.can_apply_discount),
  can_manage_stock: Boolean(employee.can_manage_stock),
  can_manage_employees: Boolean(employee.can_manage_employees),
  can_manage_salary: Boolean(employee.can_manage_salary),
  recent_login: employee.recent_login ?? employee.last_login_at ?? null,
  orders_handled: employee.orders_handled ?? employee.orders_count ?? null,
  products_added: employee.products_added ?? employee.products_count ?? null,
  recent_actions: employee.recent_actions ?? [],
});

const EmployeeManager = ({ mode = 'records' }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [detailTab, setDetailTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingSalary, setSavingSalary] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState('');
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salarySummary, setSalarySummary] = useState({ total_salary_spend: 0, adjustment_count: 0 });
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [permissionMatrix, setPermissionMatrix] = useState(buildEmptyPermissionMatrix());
  const [permissionTemplateName, setPermissionTemplateName] = useState('employee');
  const [salaryForm, setSalaryForm] = useState(emptySalaryForm);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteMeta, setInviteMeta] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setMessageState] = useState('');

  const setMessage = (text) => {
    setMessageState(text);
    if (text) {
      notify(text);
    }
  };

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(selectedEmployeeId)) || null,
    [employees, selectedEmployeeId]
  );

  const loadEmployees = async (options = {}) => {
    const { silent = false } = options;
    if (silent) {
      setReloading(true);
    } else {
      setLoading(true);
    }

    try {
      const [employeeResponse, summaryResponse] = await Promise.all([
        fetchEmployeesService(),
        fetchSalarySummary(),
      ]);

      const loadedEmployees = Array.isArray(employeeResponse.data?.employees)
        ? employeeResponse.data.employees.map(normalizeEmployee)
        : [];

      setEmployees(loadedEmployees);
      setSalarySummary(summaryResponse.data?.summary || { total_salary_spend: 0, adjustment_count: 0 });

      if (!selectedEmployeeId && loadedEmployees.length > 0) {
        setSelectedEmployeeId(String(loadedEmployees[0].id));
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load employees');
      setEmployees([]);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  const loadSalaryHistory = async (employeeId) => {
    if (!employeeId) {
      setSalaryHistory([]);
      return;
    }

    try {
      const response = await fetchEmployeeSalaryHistory(employeeId);
      setSalaryHistory(Array.isArray(response.data?.history) ? response.data.history : []);
    } catch (error) {
      setSalaryHistory([]);
      setMessage(error.response?.data?.message || 'Failed to load salary history');
    }
  };

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedEmployee) {
      setEmployeeForm(emptyEmployeeForm);
      setPermissionMatrix(buildEmptyPermissionMatrix());
      setPermissionTemplateName('employee');
      setSalaryForm(emptySalaryForm);
      setSalaryHistory([]);
      return;
    }

    const backendMatrix = selectedEmployee.permissions_json && typeof selectedEmployee.permissions_json === 'object'
      ? selectedEmployee.permissions_json
      : null;
    const nextMatrix = backendMatrix || templateMatrix(selectedEmployee.employee_role || 'employee');

    setEmployeeForm({
      employee_id: selectedEmployee.employee_id || '',
      employee_name: selectedEmployee.employee_name || '',
      phone_country_code: String(selectedEmployee.phone || '').match(/^\+\d+/)?.[0] || '+91',
      phone: String(selectedEmployee.phone || '').replace(/^\+\d+/, ''),
      aadhar_card: selectedEmployee.aadhar_card || '',
      salary: selectedEmployee.salary ?? '',
      notes: selectedEmployee.notes || '',
      is_active: Boolean(selectedEmployee.is_active),
    });

    setPermissionMatrix(clonePermissionMatrix(nextMatrix));
    setPermissionTemplateName(selectedEmployee.employee_role || 'employee');

    setSalaryForm((current) => ({
      ...current,
      effective_date: current.effective_date || new Date().toISOString().slice(0, 10),
    }));

    loadSalaryHistory(selectedEmployee.id);
  }, [selectedEmployee]);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      const haystack = [
        employee.employee_id,
        employee.employee_name,
        employee.phone,
        employee.aadhar_card,
        employee.employee_role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, searchQuery]);

  const openEditor = (employee) => {
    setSelectedEmployeeId(String(employee.id));
    setDetailTab('profile');
    setIsDrawerOpen(true);
  };

  const openNewEmployeeDrawer = () => {
    setSelectedEmployeeId('');
    setEmployeeForm(emptyEmployeeForm);
    setPermissionMatrix(buildEmptyPermissionMatrix());
    setPermissionTemplateName('employee');
    setSalaryForm(emptySalaryForm);
    setInviteLink('');
    setInviteMeta(null);
    setDetailTab('profile');
    setIsDrawerOpen(true);
  };

  const handleEmployeeFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEmployeeForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePermissionFormChange = (event) => {
    const { name, checked } = event.target;
    const [sectionKey, actionKey] = name.split('.');
    setPermissionMatrix((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [actionKey]: checked,
      },
    }));
  };

  const setAllPermissions = (value) => {
    const next = buildEmptyPermissionMatrix();
    permissionSections.forEach((section) => {
      section.actions.forEach((action) => {
        next[section.key][action] = value;
      });
    });
    setPermissionMatrix(next);
  };

  const copyPermissionsFromRole = (role) => {
    setPermissionMatrix(templateMatrix(role));
    setPermissionTemplateName(role);
  };

  const handleSalaryFormChange = (event) => {
    const { name, value } = event.target;
    setSalaryForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveEmployee = async () => {
    const employeeId = employeeForm.employee_id || selectedEmployee?.employee_id;
    if (!employeeId || !employeeForm.employee_name) {
      setMessage('Employee id and name are required');
      return false;
    }

    const aadhaar = String(employeeForm.aadhar_card || '').replace(/\s+/g, '');
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      setMessage('Aadhaar must be exactly 12 numeric digits');
      return false;
    }

    const countryCode = employeeForm.phone_country_code || '+91';
    const localPhone = String(employeeForm.phone || '').replace(/\D/g, '');
    const phone = `${countryCode}${localPhone}`;
    if (countryCode === '+91' && !/^\+91\d{10}$/.test(phone)) {
      setMessage('Indian phone numbers must be 10 digits after +91');
      return false;
    }
    if (!/^\+\d{8,15}$/.test(phone)) {
      setMessage('Phone must include a valid country code');
      return false;
    }

    setSavingEmployee(true);
    try {
      await saveEmployeeProfile(employeeId, {
        employee_id: employeeId,
        employee_name: employeeForm.employee_name,
        phone,
        aadhar_card: aadhaar,
        salary: employeeForm.salary,
        notes: employeeForm.notes,
        is_active: employeeForm.is_active,
      });
      await saveEmployeePermissions(employeeId, {
        ...flattenLegacyPermissionFlags(permissionMatrix),
        permission_matrix: permissionMatrix,
        employee_name: employeeForm.employee_name,
        notes: employeeForm.notes || null,
        role: permissionTemplateName || selectedEmployee?.employee_role || 'employee',
        base_salary: Number(employeeForm.salary || selectedEmployee?.salary || 0),
      });
      notify('Employee profile saved', 'success');
      setInviteLink('');
      setInviteMeta(null);
      setIsDrawerOpen(false);
      setSelectedEmployeeId(String(employeeId));
      await loadEmployees({ silent: true });
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to save employee profile';
      setMessage(errorMessage);
      notify(errorMessage, 'danger');
      return false;
    } finally {
      setSavingEmployee(false);
    }
  };

  const savePermissions = async () => {
    const employeeId = selectedEmployee?.id || employeeForm.employee_id;
    if (!employeeId) {
      setMessage('Select an employee first');
      return;
    }

    setSavingPermissions(true);
    try {
      const legacyFlags = flattenLegacyPermissionFlags(permissionMatrix);
      await saveEmployeePermissions(employeeId, {
        ...legacyFlags,
        permission_matrix: permissionMatrix,
        employee_name: employeeForm.employee_name || selectedEmployee?.employee_name,
        notes: employeeForm.notes || selectedEmployee?.notes || null,
        role: permissionTemplateName || selectedEmployee?.employee_role || 'employee',
        base_salary: Number(employeeForm.salary || selectedEmployee?.salary || 0),
      });
      notify('Employee permissions saved', 'success');
      await loadEmployees({ silent: true });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to save employee permissions';
      setMessage(errorMessage);
      notify(errorMessage, 'danger');
    } finally {
      setSavingPermissions(false);
    }
  };

  const saveSalaryAdjustment = async () => {
    if (!selectedEmployee) {
      setMessage('Select an employee first');
      return;
    }

    const increase = Number(salaryForm.increase_salary || 0);
    const decrease = Number(salaryForm.decrease_salary || 0);
    const bonus = Number(salaryForm.bonus || 0);
    const deduction = Number(salaryForm.deduction || 0);
    const delta = (increase + bonus) - (decrease + deduction);

    if (Number.isNaN(delta) || delta === 0) {
      setMessage('Enter at least one salary change value');
      return;
    }

    setSavingSalary(true);
    try {
      await adjustEmployeeSalary(selectedEmployee.id, {
        amount: delta,
        reason: salaryForm.remarks || null,
        adjustment_type: delta >= 0 ? 'credit' : 'debit',
        effective_date: salaryForm.effective_date || null,
      });
      notify('Salary history updated', 'success');
      setSalaryForm(emptySalaryForm);
      await loadEmployees({ silent: true });
      await loadSalaryHistory(selectedEmployee.id);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to update salary';
      setMessage(errorMessage);
      notify(errorMessage, 'danger');
    } finally {
      setSavingSalary(false);
    }
  };

  const generateInvite = async () => {
    if (!selectedEmployee && !employeeForm.employee_id) {
      setMessage('Select an employee first');
      return;
    }

    try {
      if (!selectedEmployee) {
        const saved = await saveEmployee();
        if (!saved) {
          return;
        }
      }

      const employeeId = String(employeeForm.employee_id || selectedEmployee?.id || selectedEmployee?.employee_id || '');
      const response = await generateEmployeeInvite(employeeId, {
        phone: employeeForm.phone || selectedEmployee?.phone,
        email: selectedEmployee?.employee_email || '',
      });
      setInviteLink(response.data?.invite_link || '');
      setInviteMeta({
        tempPassword: response.data?.temp_password || '',
        inviteStatus: response.data?.invite_status || 'pending',
        shareLinks: response.data?.share_links || {},
        expiresAt: response.data?.invite?.invite_expires_at || null,
      });
      notify('Employee invite link generated', 'success');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to generate invite link';
      setMessage(errorMessage);
      notify(errorMessage, 'danger');
    }
  };

  const handleDeleteEmployee = async (employee) => {
    const confirmed = window.confirm(`Delete ${employee.employee_name}? This will remove the employee profile, permissions, and salary history.`);
    if (!confirmed) {
      return;
    }

    setDeletingEmployeeId(String(employee.id));
    try {
      await deleteEmployeeProfile(employee.id);
      notify('Employee deleted', 'success');
      const remaining = employees.filter((item) => String(item.id) !== String(employee.id));
      setEmployees(remaining);
      setSelectedEmployeeId(remaining[0] ? String(remaining[0].id) : '');
      setIsDrawerOpen(false);
      await loadEmployees({ silent: true });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to delete employee';
      setMessage(errorMessage);
      notify(errorMessage, 'danger');
    } finally {
      setDeletingEmployeeId('');
    }
  };

  const renderPermissionMatrix = ({ editable = false, compact = false } = {}) => (
    <div className={`permission-matrix ${compact ? 'is-compact' : ''}`}>
          <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
            <div>
              <div className="fw-semibold">Grouped RBAC Matrix</div>
              <div className="small text-muted">Manage permissions through the RBAC matrix below.</div>
            </div>
            {editable && (
              <div className="d-flex gap-2 flex-wrap">
                <select className="form-select form-select-sm" style={{ width: 180 }} value={permissionTemplateName} onChange={(event) => copyPermissionsFromRole(event.target.value)}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="button" className="toolbar-button compact secondary" onClick={() => setAllPermissions(true)}>Select All</button>
                <button type="button" className="toolbar-button compact secondary" onClick={() => setAllPermissions(false)}>Clear All</button>
              </div>
            )}
          </div>
  
          <div className="row g-3">
            {permissionSections.map((section) => (
              <div className="col-12 col-xl-6" key={section.key}>
                <div className="p-3 rounded-4 border bg-white h-100">
                  <div className="d-flex justify-content-between gap-2 align-items-start mb-2">
                    <div>
                      <div className="fw-semibold">{section.label}</div>
                      <div className="small text-muted">{section.actions.join(' / ')}</div>
                    </div>
                    {editable && (
                      <label className="small d-flex align-items-center gap-2">
                        <input
                          type="checkbox"
                          checked={section.actions.every((action) => Boolean(permissionMatrix[section.key]?.[action]))}
                          onChange={(event) => {
                            const nextValue = event.target.checked;
                            setPermissionMatrix((prev) => ({
                              ...prev,
                              [section.key]: Object.fromEntries(section.actions.map((action) => [action, nextValue])),
                            }));
                          }}
                        />
                        All
                      </label>
                    )}
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {section.actions.map((action) => (
                      <label key={`${section.key}.${action}`} className="permission-action-chip d-inline-flex align-items-center gap-2 rounded-3 border px-3 py-2">
                        <input
                          type="checkbox"
                          name={`${section.key}.${action}`}
                          checked={Boolean(permissionMatrix[section.key]?.[action])}
                          onChange={editable ? handlePermissionFormChange : undefined}
                          disabled={!editable}
                        />
                        <span className="text-capitalize small fw-semibold">{action}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
    </div>
  );

  const statusLabel = selectedEmployee?.is_active ? 'Active' : 'Inactive';
  const summaryCards = [
    { label: 'Employees', value: employees.length },
    { label: 'Active', value: employees.filter((employee) => employee.is_active).length },
    { label: 'Salary spend', value: formatINR(salarySummary.total_salary_spend || 0) },
    { label: 'Adjustments', value: Number(salarySummary.adjustment_count || 0) },
  ];

  const renderRegistry = () => (
    <AppCard
      title="Employee Registry"
      subtitle="Scrollable roster for quick selection. Picking a card updates the detail panel instantly."
      className="employee-registry-card h-100"
    >
      <div className="employee-registry-list">
        {filteredEmployees.map((employee) => {
          const active = String(employee.id) === String(selectedEmployeeId);
          const avatar = String(employee.employee_name || employee.employee_id || 'E').trim().charAt(0).toUpperCase();

          return (
            <button
              key={employee.id}
              type="button"
              className={`employee-registry-item ${active ? 'active' : ''}`}
              onClick={() => setSelectedEmployeeId(String(employee.id))}
            >
              <div className="employee-avatar">{avatar || 'E'}</div>
              <div className="employee-registry-copy">
                <div className="employee-registry-name">{employee.employee_name || employee.employee_id}</div>
                <div className="employee-registry-meta">{employee.employee_id}</div>
                <div className="employee-registry-meta">{employee.employee_role || 'employee'}</div>
              </div>
              <div className="employee-registry-side">
                <span className={`employee-status-chip ${employee.is_active ? 'is-active' : 'is-inactive'}`}>{employee.is_active ? 'Active' : 'Inactive'}</span>
                <span className={`employee-status-chip ${employee.invite_status === 'accepted' ? 'is-active' : employee.invite_status === 'expired' ? 'is-inactive' : 'is-pending'}`}>
                  {(employee.invite_status || 'none').replace('_', ' ')}
                </span>
                <strong>{formatINR(employee.salary)}</strong>
              </div>
            </button>
          );
        })}
        {filteredEmployees.length === 0 && <EmptyState title="No employees found" description="Create the first employee profile or widen the search." />}
      </div>
    </AppCard>
  );

  const renderDetailPanel = () => {
    if (!selectedEmployee) {
      return (
        <AppCard title="Employee details" subtitle="Pick an employee from the registry or table to inspect their profile.">
          <EmptyState title="No employee selected" description="Select a card from the registry or table to open the detail page." />
        </AppCard>
      );
    }

    return (
      <AppCard
        title={`${selectedEmployee.employee_name || 'Employee'} details`}
        subtitle={`Employee ID ${selectedEmployee.employee_id} • ${statusLabel} • ${selectedEmployee.employee_role || 'employee'}`}
        actions={(
          <div className="employee-detail-actions">
            <button type="button" className="toolbar-button secondary" onClick={generateInvite}>Invite</button>
            <button type="button" className="toolbar-button" onClick={() => setIsDrawerOpen(true)}>Edit</button>
          </div>
        )}
        className="employee-detail-card h-100"
      >
        <div className="employee-detail-summary">
          <div className="employee-detail-stat">
            <span>Phone</span>
            <strong>{selectedEmployee.phone || 'Not provided'}</strong>
          </div>
          <div className="employee-detail-stat">
            <span>Aadhaar</span>
            <strong>{selectedEmployee.aadhar_card || 'Not provided'}</strong>
          </div>
          <div className="employee-detail-stat">
            <span>Salary</span>
            <strong>{formatINR(selectedEmployee.salary)}</strong>
          </div>
          <div className="employee-detail-stat">
            <span>Created</span>
            <strong>{selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleDateString() : 'N/A'}</strong>
          </div>
        </div>

        <div className="p-3 rounded-4 border bg-light mb-3 d-flex flex-wrap gap-3 justify-content-between align-items-center">
          <div>
            <div className="small text-muted">Invitation</div>
            <div className="fw-semibold text-capitalize">{selectedEmployee.invite_status || 'none'}</div>
          </div>
          <div>
            <div className="small text-muted">Token</div>
            <div className="fw-semibold text-break">{selectedEmployee.invite_token || 'No invite yet'}</div>
          </div>
          <div>
            <div className="small text-muted">Expires</div>
            <div className="fw-semibold">{selectedEmployee.invite_expires_at ? new Date(selectedEmployee.invite_expires_at).toLocaleString() : 'N/A'}</div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-sm btn-outline-dark" onClick={generateInvite}>Resend Invitation</button>
            {selectedEmployee.invite_token && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/employee-invite/${selectedEmployee.invite_token}`)}>Copy Invite Link</button>}
          </div>
        </div>

        <div className="employee-tabs">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`employee-tab-button ${detailTab === tab.id ? 'active' : ''}`}
              onClick={() => setDetailTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {detailTab === 'profile' && (
          <div className="employee-detail-grid">
            <div>
              <div className="employee-detail-label">Name</div>
              <div className="employee-detail-value">{selectedEmployee.employee_name || 'N/A'}</div>
            </div>
            <div>
              <div className="employee-detail-label">Status</div>
              <div className="employee-detail-value">{statusLabel}</div>
            </div>
            <div>
              <div className="employee-detail-label">Role</div>
              <div className="employee-detail-value">{selectedEmployee.employee_role || 'employee'}</div>
            </div>
            <div>
              <div className="employee-detail-label">Updated</div>
              <div className="employee-detail-value">{selectedEmployee.updated_at ? new Date(selectedEmployee.updated_at).toLocaleString() : 'N/A'}</div>
            </div>
          </div>
        )}

        {detailTab === 'salary' && (
          <>
            <div className="employee-salary-adjuster">
              <div className="employee-salary-adjuster-head">
                <div>
                  <div className="employee-detail-label">Current salary</div>
                  <div className="employee-detail-value display-salary">{formatINR(selectedEmployee.salary)}</div>
                </div>
                <div className="small text-muted">Salary history is append-only. Previous records are never overwritten.</div>
              </div>
              <div className="row g-3 mt-1">
                <div className="col-md-3">
                  <label className="form-label">Increase Salary</label>
                  <input className="form-control" type="number" name="increase_salary" value={salaryForm.increase_salary} onChange={handleSalaryFormChange} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Decrease Salary</label>
                  <input className="form-control" type="number" name="decrease_salary" value={salaryForm.decrease_salary} onChange={handleSalaryFormChange} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Bonus</label>
                  <input className="form-control" type="number" name="bonus" value={salaryForm.bonus} onChange={handleSalaryFormChange} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Deduction</label>
                  <input className="form-control" type="number" name="deduction" value={salaryForm.deduction} onChange={handleSalaryFormChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Effective Date</label>
                  <input className="form-control" type="date" name="effective_date" value={salaryForm.effective_date} onChange={handleSalaryFormChange} />
                </div>
                <div className="col-md-8">
                  <label className="form-label">Remarks</label>
                  <input className="form-control" name="remarks" value={salaryForm.remarks} onChange={handleSalaryFormChange} placeholder="Payroll note, correction, bonus reason" />
                </div>
              </div>
              <div className="d-flex justify-content-end mt-3">
                <button type="button" className="btn btn-primary" onClick={saveSalaryAdjustment} disabled={savingSalary}>
                  {savingSalary ? 'Saving...' : 'Save Salary Change'}
                </button>
              </div>
            </div>

            <div className="table-responsive mt-3">
              <table className="table table-sm align-middle employee-history-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Effective Date</th>
                    <th>Remarks</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryHistory.map((item) => (
                    <tr key={item.salary_entry_id}>
                      <td>{item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</td>
                      <td>{formatINR(item.amount)}</td>
                      <td>{item.adjustment_type || 'adjustment'}</td>
                      <td>{item.period_start || 'N/A'}</td>
                      <td>{item.payment_note || '—'}</td>
                      <td>{item.recorded_by_name || item.recorded_by_user_id || 'N/A'}</td>
                    </tr>
                  ))}
                  {salaryHistory.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">No salary history yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {detailTab === 'permissions' && (
          <div className="employee-permissions-summary">
            <div className="employee-detail-grid mb-3">
              <div>
                <div className="employee-detail-label">Access level</div>
                <div className="employee-detail-value">{selectedEmployee.employee_role || 'employee'}</div>
              </div>
              <div>
                <div className="employee-detail-label">Active</div>
                <div className="employee-detail-value">{selectedEmployee.is_active ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="employee-detail-label">Permissions</div>
                <div className="employee-detail-value">Managed by role matrix</div>
              </div>
              <div>
                <div className="employee-detail-label">Notes</div>
                <div className="employee-detail-value">{selectedEmployee.notes || 'No notes saved'}</div>
              </div>
            </div>
            {renderPermissionMatrix({ editable: false })}
          </div>
        )}

        {detailTab === 'activity' && (
          <div className="employee-activity-panel">
            <div className="employee-detail-grid">
              <div>
                <div className="employee-detail-label">Recent login</div>
                <div className="employee-detail-value">{selectedEmployee.recent_login ? new Date(selectedEmployee.recent_login).toLocaleString() : 'N/A'}</div>
              </div>
              <div>
                <div className="employee-detail-label">Orders handled</div>
                <div className="employee-detail-value">{selectedEmployee.orders_handled ?? 'N/A'}</div>
              </div>
              <div>
                <div className="employee-detail-label">Products added</div>
                <div className="employee-detail-value">{selectedEmployee.products_added ?? 'N/A'}</div>
              </div>
              <div>
                <div className="employee-detail-label">Recent actions</div>
                <div className="employee-detail-value">{Array.isArray(selectedEmployee.recent_actions) && selectedEmployee.recent_actions.length > 0 ? selectedEmployee.recent_actions.length : 'N/A'}</div>
              </div>
            </div>
            <EmptyState
              title="Activity feed not yet connected"
              description="The backend currently exposes employee profile, permissions, and salary history. Login and workflow telemetry can be added as a next step without changing this layout."
              className="mt-3"
            />
          </div>
        )}
      </AppCard>
    );
  };

  const renderTable = () => (
    <AppCard
      title="Employee table"
      subtitle="Each row exposes edit, details, delete, salary history, and permissions actions."
      className="employee-table-card"
      actions={(
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="toolbar-button secondary" onClick={() => loadEmployees({ silent: true })}>
            {reloading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" className="toolbar-button primary" onClick={openNewEmployeeDrawer}>Create / Edit</button>
        </div>
      )}
    >
      <div className="employee-table-toolbar mb-3">
        <input
          className="form-control employee-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by employee id, name, role, phone, or Aadhaar"
        />
      </div>
      <div className="table-responsive employee-table-scroll">
        <table className="table align-middle employee-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Aadhaar</th>
              <th>Salary</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => (
              <tr
                key={employee.id}
                className={String(employee.id) === String(selectedEmployeeId) ? 'active-row' : ''}
                onClick={() => setSelectedEmployeeId(String(employee.id))}
              >
                <td>{employee.employee_id}</td>
                <td>{employee.employee_name}</td>
                <td>{employee.phone || 'N/A'}</td>
                <td>{employee.aadhar_card || 'N/A'}</td>
                <td>{formatINR(employee.salary)}</td>
                <td>
                  <span className={`employee-status-chip ${employee.is_active ? 'is-active' : 'is-inactive'}`}>
                    {employee.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{employee.created_at ? new Date(employee.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <div className="employee-row-actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="toolbar-button compact" onClick={() => openEditor(employee)}>Edit</button>
                    <button type="button" className="toolbar-button compact secondary" onClick={() => { setSelectedEmployeeId(String(employee.id)); setDetailTab('profile'); }}>
                      View
                    </button>
                    <button type="button" className="toolbar-button compact secondary" onClick={() => { setSelectedEmployeeId(String(employee.id)); setDetailTab('salary'); }}>
                      Salary History
                    </button>
                    <button type="button" className="toolbar-button compact secondary" onClick={() => { setSelectedEmployeeId(String(employee.id)); setDetailTab('permissions'); }}>
                      Permissions
                    </button>
                    <button
                      type="button"
                      className="toolbar-button compact danger"
                      onClick={() => handleDeleteEmployee(employee)}
                      disabled={deletingEmployeeId === String(employee.id)}
                    >
                      {deletingEmployeeId === String(employee.id) ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center text-muted py-4">No employee records yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppCard>
  );

  const renderDrawer = () => {
    if (!isDrawerOpen) {
      return null;
    }

    return (
      <div className="employee-drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
        <aside className="employee-drawer" onClick={(event) => event.stopPropagation()}>
          <div className="employee-drawer-head">
            <div>
              <div className="toolbar-kicker">Employee editor</div>
              <h2 className="h4 mb-1">{selectedEmployee ? `Edit ${selectedEmployee.employee_name}` : 'Create employee'}</h2>
              <p className="text-muted mb-0">Update all employee fields without leaving the dashboard.</p>
            </div>
            <button type="button" className="toolbar-button" onClick={() => setIsDrawerOpen(false)}>Close</button>
          </div>

          <div className="employee-drawer-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Employee ID</label>
                <input className="form-control" name="employee_id" value={employeeForm.employee_id} onChange={handleEmployeeFormChange} />
              </div>
              <div className="col-md-8">
                <label className="form-label">Name</label>
                <input className="form-control" name="employee_name" value={employeeForm.employee_name} onChange={handleEmployeeFormChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Phone</label>
                <div className="input-group">
                  <select className="form-select" name="phone_country_code" value={employeeForm.phone_country_code} onChange={handleEmployeeFormChange} style={{ maxWidth: '190px' }}>
                    {countryOptions.map((country) => (
                      <option key={country.code} value={country.code}>{country.flag} {country.code} {country.label}</option>
                    ))}
                  </select>
                  <input className="form-control" name="phone" value={employeeForm.phone} onChange={handleEmployeeFormChange} placeholder="Phone number" />
                </div>
                <div className="form-text">{countryOptions.find((country) => country.code === employeeForm.phone_country_code)?.example || 'Enter the local number only'}</div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Aadhaar</label>
                <input className="form-control" name="aadhar_card" value={employeeForm.aadhar_card} onChange={handleEmployeeFormChange} inputMode="numeric" maxLength="12" placeholder="12-digit Aadhaar" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Salary</label>
                <input className="form-control" name="salary" type="number" value={employeeForm.salary} onChange={handleEmployeeFormChange} />
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <label className="employee-switch w-100">
                  <input type="checkbox" name="is_active" checked={Boolean(employeeForm.is_active)} onChange={handleEmployeeFormChange} />
                  <span>Active employee</span>
                </label>
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows="4" name="notes" value={employeeForm.notes} onChange={handleEmployeeFormChange} />
              </div>
            </div>

            <div className="mt-4">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                <div>
                  <div className="toolbar-kicker">Permissions</div>
                  <h3 className="h5 mb-0">Role matrix</h3>
                </div>
                <button type="button" className="toolbar-button secondary" onClick={savePermissions} disabled={savingPermissions || !(employeeForm.employee_id || selectedEmployee)}>
                  {savingPermissions ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
              {renderPermissionMatrix({ editable: true })}
            </div>
          </div>

          <div className="employee-drawer-actions sticky-bottom">
            <button type="button" className="toolbar-button secondary" onClick={generateInvite}>Generate Invite</button>
            <button type="button" className="toolbar-button primary" onClick={saveEmployee} disabled={savingEmployee}>
              {savingEmployee ? 'Saving...' : 'Save Employee'}
            </button>
          </div>

          {inviteLink && (
            <div className="employee-drawer-footer">
              <div className="small text-muted mb-1">Invite link</div>
              <a href={inviteLink} target="_blank" rel="noreferrer">{inviteLink}</a>
              {inviteMeta?.tempPassword && <div className="small mt-2">Temporary password: <strong>{inviteMeta.tempPassword}</strong></div>}
              <div className="d-flex gap-2 flex-wrap mt-3">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy Invite Link</button>
                {inviteMeta?.shareLinks?.email && <a className="btn btn-sm btn-outline-primary" href={inviteMeta.shareLinks.email}>Email</a>}
                {inviteMeta?.shareLinks?.whatsapp && <a className="btn btn-sm btn-outline-success" href={inviteMeta.shareLinks.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}
              </div>
            </div>
          )}
        </aside>
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner className="mt-5" label="Loading employees..." />;
  }

  return (
    <div className="employee-manager-shell">
      <PageHeader
        kicker="Employees"
        title="Employee Management"
        description="Run employee records, permissions, salary tracking, and access history from one workspace."
        actions={(
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <div className="mini-stat"><span>Total</span><strong>{employees.length}</strong></div>
            <div className="mini-stat"><span>Active</span><strong>{employees.filter((employee) => employee.is_active).length}</strong></div>
            <button type="button" className="toolbar-button secondary" onClick={openNewEmployeeDrawer}>Add Employee</button>
            <button type="button" className="toolbar-button primary" onClick={() => loadEmployees({ silent: true })}>{reloading ? 'Refreshing...' : 'Refresh'}</button>
          </div>
        )}
      />

      <div className="employee-summary-row">
        {summaryCards.map((card) => (
          <AppCard key={card.label} className="employee-summary-card" title={card.label}>
            <div className="employee-summary-value">{card.value}</div>
          </AppCard>
        ))}
      </div>

      <div className="employee-workspace-grid">
        <div className="employee-workspace-main">
          {renderTable()}
          <div className="mt-4">{renderDetailPanel()}</div>
        </div>
        <div className="employee-workspace-side">{renderRegistry()}</div>
      </div>

      {renderDrawer()}
    </div>
  );
};

export default EmployeeManager;
