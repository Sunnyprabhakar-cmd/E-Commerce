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

    `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS employee_accounts (
                employee_id TEXT PRIMARY KEY,
                user_id TEXT,
                login_email TEXT UNIQUE,
                invite_token TEXT UNIQUE,
                invite_expires_at TIMESTAMP,
                activated_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS employee_invites (
                invite_token TEXT PRIMARY KEY,
                employee_id TEXT NOT NULL,
                created_by_user_id TEXT,
                created_by_name TEXT,
                invite_expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_invites (
                invite_token TEXT PRIMARY KEY,
                created_by_user_id TEXT,
                created_by_name TEXT,
                invite_email TEXT,
                invite_phone TEXT,
                invite_expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                refresh_token_id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                revoked_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
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

    await db.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS employee_name TEXT NOT NULL DEFAULT 'Employee'");
    await db.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS phone TEXT");
    await db.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS aadhar_card TEXT");
    await db.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2) NOT NULL DEFAULT 0");
    await db.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS notes TEXT");
    await db.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS created_by_user_id TEXT");
    await db.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS created_by_name TEXT");
    await db.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()");
    await db.query("ALTER TABLE customer_invites ADD COLUMN IF NOT EXISTS created_by_user_id TEXT");
    await db.query("ALTER TABLE customer_invites ADD COLUMN IF NOT EXISTS created_by_name TEXT");
    await db.query("ALTER TABLE customer_invites ADD COLUMN IF NOT EXISTS invite_email TEXT");
    await db.query("ALTER TABLE customer_invites ADD COLUMN IF NOT EXISTS invite_phone TEXT");
    await db.query("ALTER TABLE customer_invites ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days'");
    await db.query("ALTER TABLE customer_invites ADD COLUMN IF NOT EXISTS used_at TIMESTAMP");

    await db.query(`
        CREATE TABLE IF NOT EXISTS salary_ledger (
            salary_entry_id SERIAL PRIMARY KEY,
            employee_id TEXT NOT NULL,
            employee_name TEXT NOT NULL,
            amount NUMERIC(12,2) NOT NULL,
            payment_note TEXT,
            period_start DATE,
            period_end DATE,
            recorded_by_user_id TEXT,
            recorded_by_name TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await db.query("ALTER TABLE salary_ledger ADD COLUMN IF NOT EXISTS period_start DATE");
    await db.query("ALTER TABLE salary_ledger ADD COLUMN IF NOT EXISTS period_end DATE");
    await db.query("ALTER TABLE salary_ledger ADD COLUMN IF NOT EXISTS payment_note TEXT");

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

export const linkEmployeeAccount = async (userId) => {
    await ensureAdminPortalSchema();
    const result = await db.query(
        `SELECT employee_id FROM employee_accounts WHERE CAST(user_id AS TEXT)=CAST($1 AS TEXT) LIMIT 1`,
        [String(userId)]
    );
    return result.rows?.[0]?.employee_id || null;
};

export const loadEmployeeAccountByUserId = async (userId) => {
    await ensureAdminPortalSchema();
    const result = await db.query(
        `SELECT employee_id, login_email, invite_token, activated_at FROM employee_accounts WHERE CAST(user_id AS TEXT)=CAST($1 AS TEXT) LIMIT 1`,
        [String(userId)]
    );
    return result.rows?.[0] || null;
};

export const saveRefreshToken = async ({ user_id, token_hash, expires_at }) => {
    await ensureAdminPortalSchema();
    await db.query(
        `INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
         VALUES ($1,$2,$3)`,
        [String(user_id), token_hash, expires_at]
    );
};

export const findRefreshToken = async (token_hash) => {
    await ensureAdminPortalSchema();
    const result = await db.query(
        `SELECT refresh_token_id, user_id, token_hash, expires_at, revoked_at
         FROM refresh_tokens
         WHERE token_hash = $1
         LIMIT 1`,
        [token_hash]
    );
    return result.rows?.[0] || null;
};

export const revokeRefreshToken = async (token_hash) => {
    await ensureAdminPortalSchema();
    await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
        [token_hash]
    );
};

export const generateEmployeeInvite = async ({ employee_id, created_by_user_id, created_by_name, daysValid = 7 }) => {
    await ensureAdminPortalSchema();
    if (!employee_id) {
        return { ok: false, message: 'Employee id is required' };
    }

    const employee = await db.query(
        'SELECT employee_id, employee_name, phone FROM employee_profiles WHERE CAST(employee_id AS TEXT)=CAST($1 AS TEXT) LIMIT 1',
        [employee_id]
    );
    if (!employee.rows?.[0]) {
        return { ok: false, message: 'Employee not found' };
    }

    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + Number(daysValid || 7) * 24 * 60 * 60 * 1000);
    await db.query(
        `INSERT INTO employee_invites(invite_token, employee_id, created_by_user_id, created_by_name, invite_expires_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (invite_token) DO UPDATE SET invite_expires_at = EXCLUDED.invite_expires_at`,
        [inviteToken, String(employee_id), created_by_user_id || null, created_by_name || null, expiresAt]
    );

    return {
        ok: true,
        invite: {
            invite_token: inviteToken,
            employee_id: String(employee_id),
            employee_name: employee.rows[0].employee_name,
            phone: employee.rows[0].phone || null,
            invite_expires_at: expiresAt,
        },
    };
};

export const activateEmployeeInvite = async ({ invite_token, name, email, phone, password }) => {
    await ensureAdminPortalSchema();
    if (!invite_token || !email || !password) {
        return { ok: false, message: 'Invite token, email and password are required' };
    }

    const inviteResult = await db.query(
        `SELECT invite_token, employee_id, invite_expires_at, used_at
         FROM employee_invites
         WHERE invite_token = $1
         LIMIT 1`,
        [invite_token]
    );
    const invite = inviteResult.rows?.[0];
    if (!invite) return { ok: false, message: 'Invalid invite link' };
    if (invite.used_at) return { ok: false, message: 'Invite link already used' };
    if (new Date(invite.invite_expires_at).getTime() < Date.now()) return { ok: false, message: 'Invite link expired' };

    const employee = await db.query(
        'SELECT employee_id, employee_name, phone FROM employee_profiles WHERE CAST(employee_id AS TEXT)=CAST($1 AS TEXT) LIMIT 1',
        [invite.employee_id]
    );
    const employeeRecord = employee.rows?.[0];
    if (!employeeRecord) return { ok: false, message: 'Employee not found' };

    const existingEmail = await db.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [email]);
    if (existingEmail.rows?.[0]) return { ok: false, message: 'Email already registered' };

    const passwordHash = await hashPassword(password);
    const userInsert = await db.query(
        `INSERT INTO users(name, password, email, phone, role)
         VALUES ($1,$2,$3,$4,'employee')
         RETURNING id, name, email, phone, role`,
        [name || employeeRecord.employee_name, passwordHash, email, phone || employeeRecord.phone || null]
    );
    const user = userInsert.rows?.[0];

    await db.query(
        `INSERT INTO employee_accounts(employee_id, user_id, login_email, invite_token, invite_expires_at, activated_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
         ON CONFLICT (employee_id) DO UPDATE SET user_id = EXCLUDED.user_id, login_email = EXCLUDED.login_email, invite_token = EXCLUDED.invite_token, invite_expires_at = EXCLUDED.invite_expires_at, activated_at = NOW(), updated_at = NOW()`,
        [String(invite.employee_id), String(user.id), email, invite_token, invite.invite_expires_at]
    );

    await db.query('UPDATE employee_invites SET used_at = NOW() WHERE invite_token = $1', [invite_token]);
    await db.query(
        `INSERT INTO employee_permissions(employee_id, employee_name, employee_email, role, updated_at)
         VALUES ($1,$2,$3,'employee',NOW())
         ON CONFLICT (employee_id) DO UPDATE SET employee_name = EXCLUDED.employee_name, employee_email = EXCLUDED.employee_email, updated_at = NOW()`,
        [String(invite.employee_id), name || employeeRecord.employee_name, email]
    );

    return { ok: true, user, employee_id: String(invite.employee_id) };
};

export const generateCustomerInvite = async ({ created_by_user_id, created_by_name, invite_email = null, invite_phone = null, daysValid = 7 }) => {
    await ensureAdminPortalSchema();
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + Number(daysValid || 7) * 24 * 60 * 60 * 1000);

    await db.query(
        `INSERT INTO customer_invites(invite_token, created_by_user_id, created_by_name, invite_email, invite_phone, invite_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (invite_token) DO UPDATE SET invite_email = EXCLUDED.invite_email, invite_phone = EXCLUDED.invite_phone, invite_expires_at = EXCLUDED.invite_expires_at`,
        [inviteToken, created_by_user_id || null, created_by_name || null, invite_email || null, invite_phone || null, expiresAt]
    );

    return { ok: true, invite: { invite_token: inviteToken, invite_email, invite_phone, invite_expires_at: expiresAt } };
};

export const activateCustomerInvite = async ({ invite_token, name, email, phone, password }) => {
    await ensureAdminPortalSchema();
    if (!invite_token || !email || !password) {
        return { ok: false, message: 'Invite token, email and password are required' };
    }

    const inviteResult = await db.query(
        `SELECT invite_token, invite_email, invite_phone, invite_expires_at, used_at
         FROM customer_invites
         WHERE invite_token = $1
         LIMIT 1`,
        [invite_token]
    );
    const invite = inviteResult.rows?.[0];
    if (!invite) return { ok: false, message: 'Invalid invite link' };
    if (invite.used_at) return { ok: false, message: 'Invite link already used' };
    if (new Date(invite.invite_expires_at).getTime() < Date.now()) return { ok: false, message: 'Invite link expired' };

    const existingEmail = await db.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [email]);
    if (existingEmail.rows?.[0]) return { ok: false, message: 'Email already registered' };

    const passwordHash = await hashPassword(password);
    const userInsert = await db.query(
        `INSERT INTO users(name, password, email, phone, role)
         VALUES ($1,$2,$3,$4,'user')
         RETURNING id, name, email, phone, role`,
        [name || email, passwordHash, email, phone || invite.invite_phone || null]
    );

    await db.query('UPDATE customer_invites SET used_at = NOW() WHERE invite_token = $1', [invite_token]);
    return { ok: true, user: userInsert.rows?.[0] || null };
};

export const linkEmployeeAccount = async (userId) => {
    await ensureAdminPortalSchema();
    const result = await db.query(
        `SELECT employee_id FROM employee_accounts WHERE CAST(user_id AS TEXT)=CAST($1 AS TEXT) LIMIT 1`,
        [String(userId)]
    );
    return result.rows?.[0]?.employee_id || null;
};

export const loadEmployeeAccountByUserId = async (userId) => {
    await ensureAdminPortalSchema();
    const result = await db.query(
        `SELECT employee_id, login_email, invite_token, activated_at FROM employee_accounts WHERE CAST(user_id AS TEXT)=CAST($1 AS TEXT) LIMIT 1`,
        [String(userId)]
    );
    return result.rows?.[0] || null;
};

export const saveRefreshToken = async ({ user_id, token_hash, expires_at }) => {
    await ensureAdminPortalSchema();
    await db.query(
        `INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
         VALUES ($1,$2,$3)`,
        [String(user_id), token_hash, expires_at]
    );
};

export const findRefreshToken = async (token_hash) => {
    await ensureAdminPortalSchema();
    const result = await db.query(
        `SELECT refresh_token_id, user_id, token_hash, expires_at, revoked_at
         FROM refresh_tokens
         WHERE token_hash = $1
         LIMIT 1`,
        [token_hash]
    );
    return result.rows?.[0] || null;
};

export const revokeRefreshToken = async (token_hash) => {
    await ensureAdminPortalSchema();
    await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
        [token_hash]
    );
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
            p.employee_id AS id,
            p.employee_name AS name,
            p.phone,
            p.aadhar_card,
            p.salary,
            p.notes,
            p.created_by_user_id,
            p.created_by_name,
            p.created_at,
            p.updated_at,
            COALESCE(ep.can_create_product, FALSE) AS can_create_product,
            COALESCE(ep.can_delete_product, FALSE) AS can_delete_product,
            COALESCE(ep.can_update_product, FALSE) AS can_update_product,
            COALESCE(ep.can_apply_discount, FALSE) AS can_apply_discount,
            COALESCE(ep.can_manage_stock, FALSE) AS can_manage_stock,
            COALESCE(ep.can_manage_employees, FALSE) AS can_manage_employees,
            COALESCE(ep.can_manage_salary, FALSE) AS can_manage_salary,
            COALESCE(ep.role, 'employee') AS employee_role
        FROM employee_profiles p
        LEFT JOIN employee_permissions ep ON CAST(ep.employee_id AS TEXT) = CAST(p.employee_id AS TEXT)
        ORDER BY p.employee_name ASC, CAST(p.employee_id AS TEXT) ASC
    `);

    return result.rows || [];
};

export const saveEmployeeProfile = async ({ employee_id, employee_name, phone, aadhar_card, salary, notes, created_by_user_id, created_by_name }) => {
    await ensureAdminPortalSchema();
    if (!employee_id || !employee_name) {
        return { ok: false, message: 'Employee id and name are required' };
    }

    const inserted = await db.query(
        `INSERT INTO employee_profiles(
            employee_id, employee_name, phone, aadhar_card, salary, notes, created_by_user_id, created_by_name, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (employee_id) DO UPDATE SET
            employee_name = EXCLUDED.employee_name,
            phone = EXCLUDED.phone,
            aadhar_card = EXCLUDED.aadhar_card,
            salary = EXCLUDED.salary,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        RETURNING *`,
        [String(employee_id), employee_name, phone || null, aadhar_card || null, Number(salary || 0), notes || null, created_by_user_id || null, created_by_name || null]
    );

    return { ok: true, employee: inserted.rows?.[0] || null };
};

export const getEmployeeProfiles = async () => {
    await ensureAdminPortalSchema();
    const result = await db.query(`
        SELECT employee_id, employee_name, phone, aadhar_card, salary, notes, created_by_user_id, created_by_name, created_at, updated_at
        FROM employee_profiles
        ORDER BY employee_name ASC, employee_id ASC
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
         FROM salary_ledger
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
    const employeeProfile = await db.query(
        "SELECT employee_id, employee_name, phone FROM employee_profiles WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT) LIMIT 1",
        [employeeId]
    );

    if (existingUser.rows.length === 0 && existingEmployee.rows.length === 0 && employeeProfile.rows.length === 0 && !payload.employee_name && !payload.employee_email) {
        return { ok: false, message: "Employee not found" };
    }

    const current = existingEmployee.rows[0] || existingUser.rows[0] || employeeProfile.rows[0] || {};
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

    if (employeeProfile.rows.length > 0) {
        await db.query(
            `UPDATE employee_profiles
             SET employee_name = $2, updated_at = NOW()
             WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT)`,
            [String(employeeId), employeeName]
        );
    }

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
        "SELECT employee_id, employee_name FROM employee_profiles WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT) LIMIT 1",
        [employeeId]
    );
    const employeeRecord = employee.rows[0] || null;
    if (!employeeRecord) {
        return { ok: false, message: "Employee not found" };
    }

    const current = await db.query(
        "SELECT salary AS base_salary FROM employee_profiles WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT) LIMIT 1",
        [employeeId]
    );

    const currentBase = Number(current.rows?.[0]?.base_salary || 0);
    const nextBase = Number((currentBase + delta).toFixed(2));

    await db.query(
        `INSERT INTO salary_ledger(employee_id, employee_name, amount, payment_note, period_start, period_end, recorded_by_user_id, recorded_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [String(employeeId), employeeRecord.employee_name, delta, reason || null, null, null, createdByUserId || null, createdByName || null]
    );

    const updated = await db.query(
        `UPDATE employee_profiles SET salary=$2, updated_at=NOW() WHERE CAST(employee_id AS TEXT)=CAST($1 AS TEXT) RETURNING *`,
        [String(employeeId), nextBase]
    );

    await db.query(
        `INSERT INTO employee_permissions(
            employee_id, employee_name, employee_email, role,
            can_create_product, can_delete_product, can_update_product,
            can_apply_discount, can_manage_stock, can_manage_employees,
            can_manage_salary, base_salary, salary_adjustment, updated_at
        ) VALUES ($1,$2,$3,$4,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,$5,0,NOW())
        ON CONFLICT (employee_id) DO UPDATE SET
            employee_name = EXCLUDED.employee_name,
            employee_email = EXCLUDED.employee_email,
            role = EXCLUDED.role,
            base_salary = EXCLUDED.base_salary,
            updated_at = NOW()
        RETURNING *`,
        [String(employeeId), employeeRecord.employee_name, null, 'employee', nextBase]
    );

    const record = updated.rows?.[0] || {
        employee_id: String(employeeId),
        employee_name: employeeRecord.employee_name,
        base_salary: nextBase,
        salary_adjustment: 0,
    };

    return {
        ok: true,
        employee: record,
        current_salary: nextBase,
        salary_adjustment: delta,
    };
};

export const getSalaryHistory = async (employeeId) => {
    await ensureAdminPortalSchema();
    const result = await db.query(
        `SELECT salary_entry_id, employee_id, employee_name, amount, payment_note, period_start, period_end, recorded_by_user_id, recorded_by_name, created_at
         FROM salary_ledger
         WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT)
         ORDER BY created_at DESC, salary_entry_id DESC`,
        [employeeId]
    );

    return result.rows || [];
};
