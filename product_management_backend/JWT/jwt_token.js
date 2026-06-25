import jwt from "jsonwebtoken";
import db from "../database/database.js";

const loadEmployeePermissions = async (userId) => {
    try {
        const result = await db.query(
            `SELECT
                can_create_product,
                can_delete_product,
                can_update_product,
                can_apply_discount,
                can_manage_stock,
                can_manage_employees,
                can_manage_salary,
                base_salary,
                salary_adjustment,
                employee_name
             FROM employee_permissions
             WHERE CAST(employee_id AS TEXT) = CAST($1 AS TEXT)
             LIMIT 1`,
            [userId]
        );
        return result.rows?.[0] || null;
    } catch {
        return null;
    }
};

async function auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: "Authorization header missing" });
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Invalid authorization format" });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET || "secretkey");
        if (decoded?.id) {
            const permissions = await loadEmployeePermissions(decoded.id);
            if (permissions) {
                decoded.permissions = permissions;
            }
        }
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid token" });
    }
}
export default auth;