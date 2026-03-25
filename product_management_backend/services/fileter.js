import db from "../database/database.js";

const filter = async (from, to) => {
    const result = await db.query(
        "SELECT id,name,price,category,quantity FROM products WHERE price >= $1 AND price <= $2 ORDER BY price ASC",
        [Number(from), Number(to)]
    );
    return result.rows;
};
export default filter;