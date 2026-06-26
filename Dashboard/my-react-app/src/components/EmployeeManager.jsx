import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const emptyPermissions = {
  can_create_product: false,
  can_delete_product: false,
  can_update_product: false,
  can_apply_discount: false,
  can_manage_stock: false,
  can_manage_employees: false,
  can_manage_salary: false,
};

const EmployeeManager = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [permissions, setPermissions] = useState(emptyPermissions);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salarySummary, setSalarySummary] = useState({ total_salary_spend: 0, adjustment_count: 0 });
  const [salaryStartDate, setSalaryStartDate] = useState('');
  const [salaryEndDate, setSalaryEndDate] = useState('');
  const [message, setMessage] = useState('');

  const fetchEmployees = async () => {
    try {
      const [employeeResponse, summaryResponse] = await Promise.all([
        api.get('/admin/employees'),
        api.get('/admin/salary-summary', {
          params: {
            employeeId: selectedEmployeeId || undefined,
            startDate: salaryStartDate || undefined,
            endDate: salaryEndDate || undefined,
          },
        }),
      ]);
      setEmployees(Array.isArray(employeeResponse.data?.employees) ? employeeResponse.data.employees : []);
      setSalarySummary(summaryResponse.data?.summary || { total_salary_spend: 0, adjustment_count: 0 });
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load employees');
    }
  };

  const fetchSalaryHistory = async (employeeId) => {
    if (!employeeId) {
      setSalaryHistory([]);
      return;
    }
    try {
      const response = await api.get(`/admin/employees/${employeeId}/salary`);
      setSalaryHistory(Array.isArray(response.data?.history) ? response.data.history : []);
    } catch (error) {
      setSalaryHistory([]);
      setMessage(error.response?.data?.message || 'Failed to load salary history');
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(selectedEmployeeId)),
    [employees, selectedEmployeeId]
  );

  const selectedHistory = useMemo(() => {
    return salaryHistory.filter((item) => {
      const itemDate = item.created_at ? item.created_at.slice(0, 10) : '';
      if (salaryStartDate && itemDate < salaryStartDate) return false;
      if (salaryEndDate && itemDate > salaryEndDate) return false;
      return true;
    });
  }, [salaryEndDate, salaryHistory, salaryStartDate]);

  useEffect(() => {
    if (!selectedEmployee) {
      setPermissions(emptyPermissions);
      setSalaryHistory([]);
      setSalarySummary({ total_salary_spend: 0, adjustment_count: 0 });
      return;
    }

    setPermissions({
      can_create_product: Boolean(selectedEmployee.can_create_product),
      can_delete_product: Boolean(selectedEmployee.can_delete_product),
      can_update_product: Boolean(selectedEmployee.can_update_product),
      can_apply_discount: Boolean(selectedEmployee.can_apply_discount),
      can_manage_stock: Boolean(selectedEmployee.can_manage_stock),
      can_manage_employees: Boolean(selectedEmployee.can_manage_employees),
      can_manage_salary: Boolean(selectedEmployee.can_manage_salary),
    });
    fetchSalaryHistory(selectedEmployee.id);
  }, [selectedEmployee]);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    fetchEmployees();
    fetchSalaryHistory(selectedEmployeeId);
  }, [salaryStartDate, salaryEndDate]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      return;
    }
    fetchEmployees();
  }, [selectedEmployeeId]);

  const handlePermissionChange = (event) => {
    const { name, checked } = event.target;
    setPermissions((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSave = async () => {
    if (!selectedEmployeeId) {
      setMessage('Select an employee first');
      return;
    }

    try {
      await api.post(`/admin/employees/${selectedEmployeeId}`, {
        ...permissions,
      });
      setMessage('Employee permissions saved');
      await fetchEmployees();
      await fetchSalaryHistory(selectedEmployeeId);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save employee permissions');
    }
  };

  const handleOpenSalaryHistory = () => {
    if (!selectedEmployee) {
      setMessage('Select an employee first');
      return;
    }

    const historyRows = selectedHistory.map((item) => ({
      date: item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A',
      amount: Number(item.amount || 0).toFixed(2),
      type: item.adjustment_type || 'N/A',
      reason: item.reason || '—',
      by: item.created_by_name || item.created_by_user_id || 'N/A',
    }));
    const totalSalarySpend = selectedHistory.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const detailWindow = window.open('', '_blank');
    if (!detailWindow) {
      setMessage('Unable to open salary history window. Check popup settings.');
      return;
    }

    const rowsHtml = historyRows.map((row) => `<tr><td>${row.date}</td><td>${row.amount}</td><td>${row.type}</td><td>${row.reason}</td><td>${row.by}</td></tr>`).join('');
    const title = `${selectedEmployee.name} salary history`;
    detailWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:0;background:#fff4e6;color:#2b1d0e;}header{background:#c62828;color:#fff;padding:20px 24px;}main{max-width:1100px;margin:0 auto;padding:24px;} .summary{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0;} .card{background:#fff;border:1px solid #f3d18c;border-radius:14px;padding:16px 18px;min-width:180px;box-shadow:0 10px 24px rgba(198,40,40,.08);} .controls{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 20px;} button,a{border:0;border-radius:10px;padding:10px 14px;cursor:pointer;text-decoration:none;font-weight:700;} .primary{background:#c62828;color:#fff;} .secondary{background:#ffd54f;color:#7f1d1d;} .outline{background:#fff;border:1px solid #c62828;color:#c62828;} table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;} th,td{padding:12px 14px;border-bottom:1px solid #f1e2c5;text-align:left;} th{background:#fff7e6;} </style></head><body><header><h1>${selectedEmployee.name}</h1><div>${selectedEmployee.phone || 'No phone'} · ${selectedEmployee.email || 'No email'}</div></header><main><div class="summary"><div class="card"><div>Total salary spend</div><strong>${money.format(totalSalarySpend)}</strong></div><div class="card"><div>Entries</div><strong>${historyRows.length}</strong></div><div class="card"><div>Period</div><strong>${salaryStartDate || 'All'} to ${salaryEndDate || 'All'}</strong></div></div><div class="controls"><a class="primary" download="salary-history.doc" href="data:application/msword;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html><html><body><table border='1'><tr><th>Date</th><th>Amount</th><th>Type</th><th>Reason</th><th>By</th></tr>${rowsHtml}</table></body></html>`) }">Export Doc</a><a class="secondary" download="salary-history.xls" href="data:application/vnd.ms-excel;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html><html><body><table border='1'><tr><th>Date</th><th>Amount</th><th>Type</th><th>Reason</th><th>By</th></tr>${rowsHtml}</table></body></html>`) }">Export Excel</a><a class="outline" download="salary-history.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(['Date,Amount,Type,Reason,By', ...historyRows.map((row) => [row.date,row.amount,row.type,row.reason,row.by].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n'))}">Export CSV</a><button class="outline" onclick="window.print()">Print / Save PDF</button></div><table><thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Reason</th><th>By</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="5">No history found</td></tr>'}</tbody></table></main></body></html>`);
    detailWindow.document.close();
    detailWindow.focus();
  };

  return (
    <div className="container mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="mb-1">Employee Access Table</h2>
          <p className="text-muted mb-0">Manage dedicated employee records, permissions, and salary history.</p>
        </div>
        <button className="btn btn-outline-primary" onClick={fetchEmployees}>Refresh</button>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small">Total salary spent</div>
              <div className="fs-3 fw-semibold text-danger">{money.format(Number(salarySummary.total_salary_spend || 0))}</div>
              <div className="small text-muted">Across {salarySummary.adjustment_count || 0} salary entries</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small">Period start</div>
              <input type="date" className="form-control" value={salaryStartDate} onChange={(e) => setSalaryStartDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small">Period end</div>
              <input type="date" className="form-control" value={salaryEndDate} onChange={(e) => setSalaryEndDate(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h3 className="card-title">Employee Registry</h3>
              <div className="list-group" style={{ maxHeight: '640px', overflowY: 'auto' }}>
                {employees.map((employee) => (
                  <button
                    type="button"
                    key={employee.id}
                    className={`list-group-item list-group-item-action ${String(selectedEmployeeId) === String(employee.id) ? 'active' : ''}`}
                    onClick={() => setSelectedEmployeeId(employee.id)}
                  >
                    <div className="fw-semibold">{employee.name}</div>
                    <div className="small opacity-75">{employee.email}</div>
                    <div className="small opacity-75">Phone: {employee.phone || 'N/A'}</div>
                    <div className="small opacity-75">Role: {employee.employee_role || 'employee'}</div>
                  </button>
                ))}
                {employees.length === 0 && <div className="text-muted">No employees found</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <h3 className="card-title mb-3">Permissions</h3>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">Employee</label>
                  <input className="form-control" value={selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.phone || 'no phone'})` : ''} readOnly placeholder="Select an employee" />
                </div>
              </div>

              <div className="row g-2">
                {[
                  ['can_create_product', 'Create products'],
                  ['can_delete_product', 'Delete products'],
                  ['can_update_product', 'Update products'],
                  ['can_apply_discount', 'Apply discounts'],
                  ['can_manage_stock', 'Manage stock'],
                  ['can_manage_employees', 'Manage employees'],
                  ['can_manage_salary', 'Manage salary'],
                ].map(([name, label]) => (
                  <div className="col-md-6" key={name}>
                    <label className="d-flex align-items-center gap-2 border rounded p-2">
                      <input type="checkbox" name={name} checked={Boolean(permissions[name])} onChange={handlePermissionChange} />
                      <span>{label}</span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-3 d-flex justify-content-end gap-2">
                <button className="btn btn-primary" onClick={handleSave}>Save Permissions</button>
              </div>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-body">
              <h3 className="card-title mb-3">Salary History</h3>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHistory.map((item) => (
                      <tr key={item.salary_adjustment_id}>
                        <td>{item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</td>
                        <td>{Number(item.amount || 0).toFixed(2)}</td>
                        <td>{item.adjustment_type || 'N/A'}</td>
                        <td>{item.reason || '—'}</td>
                        <td>{item.created_by_name || item.created_by_user_id || 'N/A'}</td>
                      </tr>
                    ))}
                    {selectedHistory.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-4">No salary changes recorded</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeManager;
