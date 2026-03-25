import {v4 as uuidv4} from "uuid";
import db from "../database/database.js";

let isProductSchemaReady = false;

export const ensureProductSchema = async () => {
    if (isProductSchemaReady) {
        return;
    }
    await db.query(`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
            category TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    isProductSchemaReady = true;
};

export const addProduct = async (name, price, category, quantity) => {
    await ensureProductSchema();
    const newProduct = {
        id: uuidv4(),
        name,
        price: Number(price),
        category,
        quantity: Number(quantity),
    };

    const inserted = await db.query(
        "INSERT INTO products(id,name,price,category,quantity) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,price,category,quantity",
        [newProduct.id, newProduct.name, newProduct.price, newProduct.category, newProduct.quantity]
    );
    return inserted.rows[0];
};

export const fetchAllProduct = async () => {
    await ensureProductSchema();
    const products = await db.query("SELECT id,name,price,category,quantity FROM products ORDER BY created_at DESC");
    return products.rows;
};

export const fetchProductById = async (idOrName) => {
    await ensureProductSchema();
    const product = await db.query(
        "SELECT id,name,price,category,quantity FROM products WHERE id=$1 OR name=$1 LIMIT 1",
        [idOrName]
    );
    return product.rows[0] || null;
};

export const removeProduct = async (id) => {
    await ensureProductSchema();
    const removed = await db.query("DELETE FROM products WHERE id=$1", [id]);
    return removed.rowCount > 0;
};
