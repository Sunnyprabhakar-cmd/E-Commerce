import db from "../database/database.js";

const search = async (keyword) => {
    try {
        if (!keyword) {
            return { message: "invalid keyword" };
        }

        const result = await db.query(
            "SELECT id,name,price,category,quantity FROM products WHERE category ILIKE $1 OR name ILIKE $1 ORDER BY created_at DESC",
            [`%${keyword}%`]
        );

        if (result.rows.length === 0) {
            return { message: "no product available" };
        }
        return result.rows;
    } catch (err) {
        return { message: err.message };
    }
};

export default search;