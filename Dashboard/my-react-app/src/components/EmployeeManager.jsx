import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

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
  const [users, setUsers] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [permissions, setPermissions] = useState(emptyPermissions);
  const [baseSalary, setBaseSalary] = useState('0');
  const [salaryDelta, setSalaryDelta] = useState('');
  const [salaryReason, setSalaryReason] = useState('');
  const [salaryType, setSalaryType] = useState('overtime');
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [message, setMessage] = useState('');

  const fetchEmployees = async () => {
    try {
      const [employeeResponse, userResponse] = await Promise.all([
        api.get('/admin/employees'),
        api.get('/admin/users'),
      ]);
      setEmployees(Array.isArray(employeeResponse.data?.employees) ? employeeResponse.data.employees : []);
      setUsers(Array.isArray(userResponse.data?.users) ? userResponse.data.users : []);
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

  const promotedUsers = useMemo(
    () => new Set(employees.map((employee) => String(employee.id))),
    [employees]
  );

  const availableUsers = useMemo(
    () => users.filter((user) => !promotedUsers.has(String(user.id))),
    [promotedUsers, users]
  );

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(selectedEmployeeId)),
    [selectedEmployeeId, users]
  );

  useEffect(() => {
    if (!selectedEmployee) {
      setPermissions(emptyPermissions);
      setBaseSalary('0');
      setSalaryHistory([]);
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
    setBaseSalary(String(selectedEmployee.base_salary ?? 0));
    fetchSalaryHistory(selectedEmployee.id);
  }, [selectedEmployee]);

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
        base_salary: Number(baseSalary || 0),
      });
      setMessage('Employee permissions saved');
      await fetchEmployees();
      await fetchSalaryHistory(selectedEmployeeId);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save employee permissions');
    }
  };

  const handleSalaryAdjust = async () => {
    if (!selectedEmployeeId) {
      setMessage('Select an employee first');
      return;
    }

    const amount = Number(salaryDelta);
    if (Number.isNaN(amount) || amount === 0) {
      setMessage('Enter a non-zero salary adjustment');
      return;
    }

    try {
      await api.post(`/admin/employees/${selectedEmployeeId}/salary`, {
        amount,
        reason: salaryReason,
        adjustment_type: salaryType,
      });
      setMessage('Salary updated');
      setSalaryDelta('');
      setSalaryReason('');
      await fetchEmployees();
      await fetchSalaryHistory(selectedEmployeeId);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to update salary');
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="mb-1">Employee Access Table</h2>
          <p className="text-muted mb-0">Manage dedicated employee records, permissions, and salary adjustments.</p>
        </div>
        <button className="btn btn-outline-primary" onClick={fetchEmployees}>Refresh</button>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

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
                    <div className="small opacity-75">Role: {employee.employee_role || 'employee'}</div>
                  </button>
                ))}
                {employees.length === 0 && <div className="text-muted">No employees found</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h3 className="card-title">Available Users</h3>
              <p className="text-muted small">Pick a user to promote into the employee registry, then save permissions.</p>
              <div className="list-group" style={{ maxHeight: '640px', overflowY: 'auto' }}>
                {availableUsers.map((user) => (
                  <button
                    type="button"
                    key={user.id}
                    className={`list-group-item list-group-item-action ${String(selectedEmployeeId) === String(user.id) ? 'active' : ''}`}
                    onClick={() => setSelectedEmployeeId(user.id)}
                  >
                    <div className="fw-semibold">{user.name}</div>
                    <div className="small opacity-75">{user.email}</div>
                    <div className="small opacity-75">Role: {user.role || 'user'}</div>
                  </button>
                ))}
                {availableUsers.length === 0 && <div className="text-muted">No available users to promote</div>}
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
                  <input className="form-control" value={selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.email})` : (selectedUser ? `${selectedUser.name} (${selectedUser.email})` : '')} readOnly placeholder="Select an employee or user" />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Base Salary</label>
                  <input type="number" min="0" step="0.01" className="form-control" value={baseSalary} onChange={(event) => setBaseSalary(event.target.value)} />
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

          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <h3 className="card-title mb-3">Salary Management</h3>
              <div className="row g-3 align-items-end">
                <div className="col-md-3">
                  <label className="form-label">Adjustment Type</label>
                  <select className="form-select" value={salaryType} onChange={(event) => setSalaryType(event.target.value)}>
                    <option value="overtime">Overtime</option>
                    <option value="deduction">Deduction</option>
                    <option value="bonus">Bonus</option>
                    <option value="unavailability">Unavailability</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Amount</label>
                  <input type="number" step="0.01" className="form-control" value={salaryDelta} onChange={(event) => setSalaryDelta(event.target.value)} placeholder="Use positive or negative value" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Reason</label>
                  <input type="text" className="form-control" value={salaryReason} onChange={(event) => setSalaryReason(event.target.value)} placeholder="Overtime hours, absence, bonus reason" />
                </div>
                <div className="col-md-2">
                  <button className="btn btn-success w-100" onClick={handleSalaryAdjust}>Apply</button>
                </div>
              </div>
              <div className="text-muted small mt-2">Positive values increase salary. Negative values subtract salary.</div>
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
                    {salaryHistory.map((item) => (
                      <tr key={item.salary_adjustment_id}>
                        <td>{item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</td>
                        <td>{Number(item.amount || 0).toFixed(2)}</td>
                        <td>{item.adjustment_type || 'N/A'}</td>
                        <td>{item.reason || '—'}</td>
                        <td>{item.created_by_name || item.created_by_user_id || 'N/A'}</td>
                      </tr>
                    ))}
                    {salaryHistory.length === 0 && (
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
