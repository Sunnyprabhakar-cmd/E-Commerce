import {v4 as uuidv4} from "uuid";
import db from "../database/database.js";

let isProductSchemaReady = false;

export const ensureProductSchema = async () => {
    if (isProductSchemaReady) {
        return;
    }

    // Normalize legacy schema if products table already exists with product_id.
    const hasProductId = await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='product_id' LIMIT 1"
    );
    const hasId = await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='id' LIMIT 1"
    );

    if (hasProductId.rows.length > 0 && hasId.rows.length === 0) {
        await db.query("ALTER TABLE products RENAME COLUMN product_id TO id");
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

    // Ensure required columns exist in legacy tables.
    await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()");
    await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1");

    // Keep API stable: product IDs are treated as strings across backend/frontend.
    await db.query("ALTER TABLE products ALTER COLUMN id TYPE TEXT USING id::text");

    isProductSchemaReady = true;
};

export const addProduct = async (id,name, price, category,piece ,quantity) => {
    await ensureProductSchema();
    const newProduct = {
        id,
        name,
        price: Number(price),
        category,
        piece,
        quantity: Number(quantity),
    };

    const inserted = await db.query(
        "INSERT INTO products(id,name,price,category,piece,quantity) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,price,category,piece,quantity",
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
