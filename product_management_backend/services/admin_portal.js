import db from "../database/database.js";
import { fetchProductById } from "../product_model/model.js";

let isAdminPortalSchemaReady = false;

const buildDateFilter = (startDate, endDate, columnName = 'created_at') => {
    const clauses = [];
    const params = [];

    if (startDate) {
        params.push(startDate);
        clauses.push(`${columnName}::date >= $${params.length}::date`);
    }

    if (endDate) {
        params.push(endDate);
        clauses.push(`${columnName}::date <= $${params.length}::date`);
    }

    return { clauses, params };
};

export const ensureAdminPortalSchema = async () => {
    if (isAdminPortalSchemaReady) {
        return;
    }

    await db.query(`
        CREATE TABLE IF NOT EXISTS stock_entries (
            stock_entry_id SERIAL PRIMARY KEY,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            units INTEGER NOT NULL CHECK (units > 0),
            notes TEXT,
            recorded_by_user_id TEXT,
            recorded_by_name TEXT,
            recorded_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS employee_permissions (
            employee_id TEXT PRIMARY KEY,
            employee_name TEXT,
            employee_email TEXT,
            role TEXT NOT NULL DEFAULT 'employee',
            can_create_product BOOLEAN NOT NULL DEFAULT FALSE,
            can_delete_product BOOLEAN NOT NULL DEFAULT FALSE,
            can_update_product BOOLEAN NOT NULL DEFAULT FALSE,
            can_apply_discount BOOLEAN NOT NULL DEFAULT FALSE,
            can_manage_stock BOOLEAN NOT NULL DEFAULT FALSE,
            can_manage_employees BOOLEAN NOT NULL DEFAULT FALSE,
            can_manage_salary BOOLEAN NOT NULL DEFAULT FALSE,
            base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
            salary_adjustment NUMERIC(12,2) NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS salary_adjustments (
            salary_adjustment_id SERIAL PRIMARY KEY,
            employee_id TEXT NOT NULL,
            employee_name TEXT,
            amount NUMERIC(12,2) NOT NULL,
            reason TEXT,
            adjustment_type TEXT,
            created_by_user_id TEXT,
            created_by_name TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS employee_name TEXT");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS employee_email TEXT");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'employee'");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS can_create_product BOOLEAN NOT NULL DEFAULT FALSE");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS can_delete_product BOOLEAN NOT NULL DEFAULT FALSE");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS can_update_product BOOLEAN NOT NULL DEFAULT FALSE");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS can_apply_discount BOOLEAN NOT NULL DEFAULT FALSE");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS can_manage_stock BOOLEAN NOT NULL DEFAULT FALSE");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS can_manage_employees BOOLEAN NOT NULL DEFAULT FALSE");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS can_manage_salary BOOLEAN NOT NULL DEFAULT FALSE");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12,2) NOT NULL DEFAULT 0");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS salary_adjustment NUMERIC(12,2) NOT NULL DEFAULT 0");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS notes TEXT");
    await db.query("ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()");

    isAdminPortalSchemaReady = true;
};

export const getAdminSummary = async ({ startDate = null, endDate = null } = {}) => {
    await ensureAdminPortalSchema();
    const { clauses, params } = buildDateFilter(startDate, endDate, 'created_at');
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await db.query(
        `SELECT
            COALESCE(SUM(total_cost), 0) AS total_amount,
            COALESCE(SUM(amount_paid), 0) AS total_paid_amount,
            COALESCE(SUM(payable_amount), 0) AS total_generated_after_discount,
            COALESCE(SUM(discount_amount), 0) AS total_discount_amount,
            COUNT(*) AS order_count
         FROM orders
         ${whereClause}`,
        params
    );

    return result.rows?.[0] || {
        total_amount: 0,
        total_paid_amount: 0,
        total_generated_after_discount: 0,
        total_discount_amount: 0,
        order_count: 0,
    };
};

export const getRecentProducts = async (limit = 10) => {
    await ensureAdminPortalSchema();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
    const result = await db.query(
        `SELECT id, name, price, category, piece, availability, created_at
         FROM products
         ORDER BY created_at DESC, id DESC
         LIMIT $1`,
        [safeLimit]
    );
    return result.rows || [];
};

export const getRecentStockEntries = async (limit = 10) => {
    await ensureAdminPortalSchema();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
    const result = await db.query(
        `SELECT
            s.stock_entry_id,
            s.product_id,
            s.product_name,
            s.units,
            s.notes,
            s.recorded_by_user_id,
            s.recorded_by_name,
            s.recorded_at
         FROM stock_entries s
         ORDER BY s.recorded_at DESC, s.stock_entry_id DESC
         LIMIT $1`,
        [safeLimit]
    );
    return result.rows || [];
};

export const getStockEntries = async () => {
    await ensureAdminPortalSchema();
    const result = await db.query(`
        SELECT
            s.stock_entry_id,
            s.product_id,
            s.product_name,
            s.units,
            s.notes,
            s.recorded_by_user_id,
            s.recorded_by_name,
            s.recorded_at
        FROM stock_entries s
        ORDER BY s.recorded_at DESC, s.stock_entry_id DESC
    `);

    return result.rows || [];
};

export const createStockEntry = async ({ product_id, units, notes, recorded_by_user_id, recorded_by_name }) => {
    await ensureAdminPortalSchema();
    const product = await fetchProductById(product_id);
    if (!product) {
        return { ok: false, message: "Product not found" };
    }

    const normalizedUnits = Number(units);
    if (!Number.isInteger(normalizedUnits) || normalizedUnits <= 0) {
        return { ok: false, message: "Units must be a positive whole number" };
    }

    const inserted = await db.query(
        `INSERT INTO stock_entries(product_id, product_name, units, notes, recorded_by_user_id, recorded_by_name)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING stock_entry_id, product_id, product_name, units, notes, recorded_by_user_id, recorded_by_name, recorded_at`,
        [String(product.id), product.name, normalizedUnits, notes || null, recorded_by_user_id || null, recorded_by_name || null]
    );

    return { ok: true, entry: inserted.rows?.[0] || null };
};

export const listEmployees = async () => {
    await ensureAdminPortalSchema();
    const result = await db.query(`
        SELECT
            ep.employee_id AS id,
            COALESCE(ep.employee_name, u.name, 'Employee') AS name,
            COALESCE(ep.employee_email, u.email, '') AS email,
            u.phone,
            u.role AS user_role,
            COALESCE(ep.role, 'employee') AS employee_role,
            COALESCE(ep.can_create_product, FALSE) AS can_create_product,
            COALESCE(ep.can_delete_product, FALSE) AS can_delete_product,
            COALESCE(ep.can_update_product, FALSE) AS can_update_product,
            COALESCE(ep.can_apply_discount, FALSE) AS can_apply_discount,
            COALESCE(ep.can_manage_stock, FALSE) AS can_manage_stock,
            COALESCE(ep.can_manage_employees, FALSE) AS can_manage_employees,
            COALESCE(ep.can_manage_salary, FALSE) AS can_manage_salary,
            COALESCE(ep.base_salary, 0) AS base_salary,
            COALESCE(ep.salary_adjustment, 0) AS salary_adjustment,
            ep.notes,
            ep.updated_at
        FROM employee_permissions ep
        LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(ep.employee_id AS TEXT)
        ORDER BY COALESCE(ep.employee_name, u.name, 'Employee') ASC, CAST(ep.employee_id AS TEXT) ASC
    `);

    return result.rows || [];
};

export const getSalarySummary = async ({ employeeId = null, startDate = null, endDate = null } = {}) => {
    await ensureAdminPortalSchema();
    const conditions = [];
    const params = [];

    if (employeeId) {
        params.push(String(employeeId));
        conditions.push(`CAST(employee_id AS TEXT) = CAST($${params.length} AS TEXT)`);
    }
    if (startDate) {
        params.push(startDate);
        conditions.push(`created_at::date >= $${params.length}::date`);
    }
    if (endDate) {
        params.push(endDate);
        conditions.push(`created_at::date <= $${params.length}::date`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
        `SELECT
            COALESCE(SUM(amount), 0) AS total_salary_spend,
            COUNT(*) AS adjustment_count
         FROM salary_adjustments
         ${whereClause}`,
        params
    );

    return result.rows?.[0] || { total_salary_spend: 0, adjustment_count: 0 };
};

export const saveEmployeePermissions = async (employeeId, payload = {}) => {
    await ensureAdminPortalSchema();
    if (!employeeId) {
        return { ok: false, message: "Employee id is required" };
    }

    const existingUser = await db.query(
        "SELECT id, name, email, role FROM users WHERE CAST(id AS TEXT) = CAST($1 AS TEXT) LIMIT 1",
        [employeeId]
    );
    const existingEmployee = await db.query(
        "SELECT employee_id, employee_name, employee_email, role FROM employee_permissions WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT) LIMIT 1",
        [employeeId]
    );

    if (existingUser.rows.length === 0 && existingEmployee.rows.length === 0 && !payload.employee_name && !payload.employee_email) {
        return { ok: false, message: "Employee not found" };
    }

    const current = existingEmployee.rows[0] || existingUser.rows[0] || {};
    const employeeName = payload.employee_name || current.name || current.employee_name || 'Employee';
    const employeeEmail = payload.employee_email || current.email || current.employee_email || null;
    const employeeRole = payload.role || current.role || 'employee';
    const permissions = {
        can_create_product: Boolean(payload.can_create_product),
        can_delete_product: Boolean(payload.can_delete_product),
        can_update_product: Boolean(payload.can_update_product),
        can_apply_discount: Boolean(payload.can_apply_discount),
        can_manage_stock: Boolean(payload.can_manage_stock),
        can_manage_employees: Boolean(payload.can_manage_employees),
        can_manage_salary: Boolean(payload.can_manage_salary),
    };
    const baseSalary = Number(payload.base_salary ?? 0) || 0;
    const salaryAdjustment = Number(payload.salary_adjustment ?? 0) || 0;

    const saved = await db.query(
        `INSERT INTO employee_permissions(
            employee_id, employee_name, employee_email, role,
            can_create_product, can_delete_product, can_update_product,
            can_apply_discount, can_manage_stock, can_manage_employees,
            can_manage_salary, base_salary, salary_adjustment, notes, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
        ON CONFLICT (employee_id) DO UPDATE SET
            employee_name = EXCLUDED.employee_name,
            employee_email = EXCLUDED.employee_email,
            role = EXCLUDED.role,
            can_create_product = EXCLUDED.can_create_product,
            can_delete_product = EXCLUDED.can_delete_product,
            can_update_product = EXCLUDED.can_update_product,
            can_apply_discount = EXCLUDED.can_apply_discount,
            can_manage_stock = EXCLUDED.can_manage_stock,
            can_manage_employees = EXCLUDED.can_manage_employees,
            can_manage_salary = EXCLUDED.can_manage_salary,
            base_salary = EXCLUDED.base_salary,
            salary_adjustment = EXCLUDED.salary_adjustment,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        RETURNING *`,
        [
            String(employeeId),
            employeeName,
            employeeEmail,
            employeeRole,
            permissions.can_create_product,
            permissions.can_delete_product,
            permissions.can_update_product,
            permissions.can_apply_discount,
            permissions.can_manage_stock,
            permissions.can_manage_employees,
            permissions.can_manage_salary,
            baseSalary,
            salaryAdjustment,
            payload.notes || null,
        ]
    );

    return { ok: true, employee: saved.rows?.[0] || null };
};

export const adjustEmployeeSalary = async (employeeId, amount, reason, adjustmentType, createdByUserId, createdByName) => {
    await ensureAdminPortalSchema();
    if (!employeeId) {
        return { ok: false, message: "Employee id is required" };
    }

    const delta = Number(amount);
    if (Number.isNaN(delta) || delta === 0) {
        return { ok: false, message: "Amount must be a non-zero number" };
    }

    const employee = await db.query(
        "SELECT id, name FROM users WHERE CAST(id AS TEXT) = CAST($1 AS TEXT) LIMIT 1",
        [employeeId]
    );
    const employeeRecord = employee.rows[0] || null;
    if (!employeeRecord) {
        const fallbackEmployee = await db.query(
            "SELECT employee_id, employee_name FROM employee_permissions WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT) LIMIT 1",
            [employeeId]
        );
        if (fallbackEmployee.rows.length === 0) {
            return { ok: false, message: "Employee not found" };
        }
        employee.rows = [{ id: fallbackEmployee.rows[0].employee_id, name: fallbackEmployee.rows[0].employee_name || 'Employee' }];
    }

    const current = await db.query(
        "SELECT base_salary, salary_adjustment FROM employee_permissions WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT) LIMIT 1",
        [employeeId]
    );

    const currentBase = Number(current.rows?.[0]?.base_salary || 0);
    const currentAdjustment = Number(current.rows?.[0]?.salary_adjustment || 0);
    const nextAdjustment = Number((currentAdjustment + delta).toFixed(2));

    await db.query(
        `INSERT INTO salary_adjustments(employee_id, employee_name, amount, reason, adjustment_type, created_by_user_id, created_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [String(employeeId), employee.rows[0].name, delta, reason || null, adjustmentType || (delta > 0 ? 'overtime' : 'deduction'), createdByUserId || null, createdByName || null]
    );

    const updated = await db.query(
        `INSERT INTO employee_permissions(
            employee_id, employee_name, employee_email, role,
            can_create_product, can_delete_product, can_update_product,
            can_apply_discount, can_manage_stock, can_manage_employees,
            can_manage_salary, base_salary, salary_adjustment, updated_at
        ) VALUES ($1,$2,$3,$4,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,$5,$6,NOW())
        ON CONFLICT (employee_id) DO UPDATE SET
            employee_name = EXCLUDED.employee_name,
            employee_email = EXCLUDED.employee_email,
            role = EXCLUDED.role,
            base_salary = EXCLUDED.base_salary,
            salary_adjustment = EXCLUDED.salary_adjustment,
            updated_at = NOW()
        RETURNING *`,
        [String(employeeId), employee.rows[0].name, null, 'employee', currentBase, nextAdjustment]
    );

    const record = updated.rows?.[0] || {
        employee_id: String(employeeId),
        employee_name: employee.rows[0].name,
        base_salary: currentBase,
        salary_adjustment: nextAdjustment,
    };

    return {
        ok: true,
        employee: record,
        current_salary: Number(currentBase) + Number(nextAdjustment),
        salary_adjustment: nextAdjustment,
    };
};

export const getSalaryHistory = async (employeeId) => {
    await ensureAdminPortalSchema();
    const result = await db.query(
        `SELECT salary_adjustment_id, employee_id, employee_name, amount, reason, adjustment_type, created_by_user_id, created_by_name, created_at
         FROM salary_adjustments
         WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT)
         ORDER BY created_at DESC, salary_adjustment_id DESC`,
        [employeeId]
    );

    return result.rows || [];
};
