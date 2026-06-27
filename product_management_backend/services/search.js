import db from "../database/database.js";

const search = async (keyword) => {
    try {
        if (!keyword) {
            return { message: "invalid keyword" };
        }

        const result = await db.query(
            "SELECT id,name,sku,barcode,price,category,piece,availability FROM products WHERE CAST(id AS TEXT) ILIKE $1 OR COALESCE(sku,'') ILIKE $1 OR COALESCE(barcode,'') ILIKE $1 OR category ILIKE $1 OR name ILIKE $1 ORDER BY created_at DESC",
            [`%${keyword}%`]
        );

        if (result.rows.length === 0) {
            return [];
        }
        return result.rows;
    } catch (err) {
        return { error: true, message: err.message };
    }
};

export default search;