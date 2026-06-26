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

const emptyEmployeeForm = {
  employee_id: '',
  employee_name: '',
  phone: '',
  aadhar_card: '',
  salary: '',
  notes: '',
};

const emptySalaryEntry = {
  amount: '',
  reason: '',
};

const EmployeeManager = ({ mode = 'records' }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [permissions, setPermissions] = useState(emptyPermissions);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salarySummary, setSalarySummary] = useState({ total_salary_spend: 0, adjustment_count: 0 });
  const [salaryStartDate, setSalaryStartDate] = useState('');
  const [salaryEndDate, setSalaryEndDate] = useState('');
  const [salaryEntry, setSalaryEntry] = useState(emptySalaryEntry);
  const [message, setMessage] = useState('');

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(selectedEmployeeId)) || null,
    [employees, selectedEmployeeId]
  );

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
      const loadedEmployees = Array.isArray(employeeResponse.data?.employees) ? employeeResponse.data.employees : [];
      setEmployees(loadedEmployees);
      setSalarySummary(summaryResponse.data?.summary || { total_salary_spend: 0, adjustment_count: 0 });

      if (!selectedEmployeeId && loadedEmployees.length > 0) {
        setSelectedEmployeeId(String(loadedEmployees[0].id));
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaryStartDate, salaryEndDate]);

  useEffect(() => {
    if (!selectedEmployee) {
      setPermissions(emptyPermissions);
      setEmployeeForm(emptyEmployeeForm);
      setSalaryHistory([]);
      setSalaryEntry(emptySalaryEntry);
      return;
    }

    setEmployeeForm({
      employee_id: selectedEmployee.id || '',
      employee_name: selectedEmployee.name || '',
      phone: selectedEmployee.phone || '',
      aadhar_card: selectedEmployee.aadhar_card || '',
      salary: selectedEmployee.salary ?? '',
      notes: selectedEmployee.notes || '',
    });

    setPermissions({
      can_create_product: Boolean(selectedEmployee.can_create_product),
      can_delete_product: Boolean(selectedEmployee.can_delete_product),
      can_update_product: Boolean(selectedEmployee.can_update_product),
      can_apply_discount: Boolean(selectedEmployee.can_apply_discount),
      can_manage_stock: Boolean(selectedEmployee.can_manage_stock),
      can_manage_employees: Boolean(selectedEmployee.can_manage_employees),
      can_manage_salary: Boolean(selectedEmployee.can_manage_salary),
    });

    if (mode === 'salary') {
      fetchSalaryHistory(selectedEmployee.id);
    }
  }, [mode, selectedEmployee]);

  const handleEmployeeFormChange = (event) => {
    const { name, value } = event.target;
    setEmployeeForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (event) => {
    const { name, checked } = event.target;
    setPermissions((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSalaryEntryChange = (event) => {
    const { name, value } = event.target;
    setSalaryEntry((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmployeeSave = async () => {
    if (!employeeForm.employee_id || !employeeForm.employee_name) {
      setMessage('Employee id and name are required');
      return;
    }

    try {
      await api.post(`/admin/employees/${employeeForm.employee_id}/profile`, {
        employee_id: employeeForm.employee_id,
        employee_name: employeeForm.employee_name,
        phone: employeeForm.phone,
        aadhar_card: employeeForm.aadhar_card,
        salary: employeeForm.salary,
        notes: employeeForm.notes,
      });
      setMessage('Employee profile saved');
      await fetchEmployees();
      setSelectedEmployeeId(String(employeeForm.employee_id));
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save employee profile');
    }
  };

  const handlePermissionSave = async () => {
    if (!selectedEmployeeId) {
      setMessage('Select an employee first');
      return;
    }

    try {
      await api.post(`/admin/employees/${selectedEmployeeId}/permissions`, permissions);
      setMessage('Employee permissions saved');
      await fetchEmployees();
      await fetchSalaryHistory(selectedEmployeeId);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save employee permissions');
    }
  };

  const handleSalarySave = async () => {
    if (!selectedEmployeeId) {
      setMessage('Select an employee first');
      return;
    }
    const amount = Number(salaryEntry.amount);
    if (Number.isNaN(amount) || amount === 0) {
      setMessage('Enter a non-zero salary amount');
      return;
    }

    try {
      await api.post(`/admin/employees/${selectedEmployeeId}/salary`, {
        amount,
        reason: salaryEntry.reason,
      });
      setMessage('Salary entry saved');
      setSalaryEntry(emptySalaryEntry);
      await fetchEmployees();
      await fetchSalaryHistory(selectedEmployeeId);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save salary entry');
    }
  };

  const renderEmployeeList = () => (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <h3 className="card-title mb-3">Employee Registry</h3>
        <div className="list-group" style={{ maxHeight: '640px', overflowY: 'auto' }}>
          {employees.map((employee) => (
            <button
              type="button"
              key={employee.id}
              className={`list-group-item list-group-item-action ${String(selectedEmployeeId) === String(employee.id) ? 'active' : ''}`}
              onClick={() => setSelectedEmployeeId(String(employee.id))}
            >
              <div className="d-flex justify-content-between align-items-center gap-2">
                <div>
                  <div className="fw-semibold">{employee.name}</div>
                  <div className="small opacity-75">ID: {employee.id}</div>
                  <div className="small opacity-75">Phone: {employee.phone || 'N/A'}</div>
                </div>
                <div className="text-end small opacity-75">
                  <div>{money.format(Number(employee.salary || 0))}</div>
                  <div>{employee.employee_role || 'employee'}</div>
                </div>
              </div>
            </button>
          ))}
          {employees.length === 0 && <div className="text-muted">No employees found</div>}
        </div>
      </div>
    </div>
  );

  const renderRecordsView = () => (
    <div className="row g-4">
      <div className="col-lg-7">
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <h3 className="card-title mb-3">Employee Details</h3>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Employee ID</label>
                <input className="form-control" name="employee_id" value={employeeForm.employee_id} onChange={handleEmployeeFormChange} placeholder="EMP-001" />
              </div>
              <div className="col-md-8">
                <label className="form-label">Employee Name</label>
                <input className="form-control" name="employee_name" value={employeeForm.employee_name} onChange={handleEmployeeFormChange} placeholder="Full name" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Phone Number</label>
                <input className="form-control" name="phone" value={employeeForm.phone} onChange={handleEmployeeFormChange} placeholder="Mobile number" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Aadhar Card</label>
                <input className="form-control" name="aadhar_card" value={employeeForm.aadhar_card} onChange={handleEmployeeFormChange} placeholder="Aadhar card number" />
              </div>
              <div className="col-md-4">
                <label className="form-label">Salary</label>
                <input className="form-control" name="salary" type="number" value={employeeForm.salary} onChange={handleEmployeeFormChange} placeholder="0" />
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <textarea className="form-control" name="notes" rows="3" value={employeeForm.notes} onChange={handleEmployeeFormChange} placeholder="Optional internal notes" />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button className="btn btn-primary" onClick={handleEmployeeSave}>Save Employee</button>
            </div>
          </div>
        </div>

        <div className="card shadow-sm">
          <div className="card-body">
            <h3 className="card-title mb-3">Employee Table</h3>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Aadhar</th>
                    <th>Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} onClick={() => setSelectedEmployeeId(String(employee.id))} style={{ cursor: 'pointer' }}>
                      <td>{employee.id}</td>
                      <td>{employee.name}</td>
                      <td>{employee.phone || 'N/A'}</td>
                      <td>{employee.aadhar_card || 'N/A'}</td>
                      <td>{money.format(Number(employee.salary || 0))}</td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">No employee records yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-5">
        {renderEmployeeList()}
      </div>
    </div>
  );

  const renderPermissionsView = () => (
    <div className="row g-4">
      <div className="col-lg-4">{renderEmployeeList()}</div>
      <div className="col-lg-8">
        <div className="card shadow-sm h-100">
          <div className="card-body">
            <h3 className="card-title mb-3">Permissions</h3>
            <div className="mb-3">
              <label className="form-label">Selected Employee</label>
              <input className="form-control" value={selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.id})` : ''} readOnly placeholder="Choose an employee" />
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
                  <label className="d-flex align-items-center gap-2 border rounded p-2 h-100">
                    <input type="checkbox" name={name} checked={Boolean(permissions[name])} onChange={handlePermissionChange} />
                    <span>{label}</span>
                  </label>
                </div>
              ))}
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button className="btn btn-primary" onClick={handlePermissionSave}>Save Permissions</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSalaryView = () => (
    <div className="row g-4">
      <div className="col-lg-4">
        {renderEmployeeList()}
        <div className="card shadow-sm mt-4">
          <div className="card-body">
            <h3 className="card-title mb-3">Salary Adjustments</h3>
            <div className="mb-3">
              <label className="form-label">Amount</label>
              <input className="form-control" type="number" name="amount" value={salaryEntry.amount} onChange={handleSalaryEntryChange} placeholder="Enter positive or negative amount" />
            </div>
            <div className="mb-3">
              <label className="form-label">Reason</label>
              <textarea className="form-control" name="reason" rows="3" value={salaryEntry.reason} onChange={handleSalaryEntryChange} placeholder="Payroll note or correction" />
            </div>
            <button className="btn btn-primary w-100" onClick={handleSalarySave}>Save Salary Entry</button>
          </div>
        </div>
      </div>

      <div className="col-lg-8">
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted small">Total salary spent</div>
                <div className="fs-3 fw-semibold text-danger">{money.format(Number(salarySummary.total_salary_spend || 0))}</div>
                <div className="small text-muted">Across {salarySummary.adjustment_count || 0} ledger entries</div>
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

        <div className="card shadow-sm">
          <div className="card-body">
            <h3 className="card-title mb-3">Salary History</h3>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Note</th>
                    <th>Period</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryHistory.map((item) => (
                    <tr key={item.salary_entry_id}>
                      <td>{item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</td>
                      <td>{money.format(Number(item.amount || 0))}</td>
                      <td>{item.payment_note || '—'}</td>
                      <td>{item.period_start || '—'} to {item.period_end || '—'}</td>
                      <td>{item.recorded_by_name || item.recorded_by_user_id || 'N/A'}</td>
                    </tr>
                  ))}
                  {salaryHistory.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">No salary entries found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="mb-1">
            {mode === 'records' ? 'Employee Records' : mode === 'permissions' ? 'Employee Permissions' : 'Salary Ledger'}
          </h2>
          <p className="text-muted mb-0">Dedicated employee data, access control, and salary tracking for scale.</p>
        </div>
        <button className="btn btn-outline-primary" onClick={fetchEmployees}>Refresh</button>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {mode === 'records' ? renderRecordsView() : mode === 'permissions' ? renderPermissionsView() : renderSalaryView()}
    </div>
  );
};

export default EmployeeManager;
