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
            piece INTEGER NOT NULL DEFAULT 0,
            availability BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    // Ensure required columns exist in legacy tables.
   await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()");
await db.query(
  "ALTER TABLE products ADD COLUMN IF NOT EXISTS availability BOOLEAN NOT NULL DEFAULT TRUE"
);
await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS piece INTEGER NOT NULL DEFAULT 0");
    // Keep API stable: product IDs are treated as strings across backend/frontend.
    

    isProductSchemaReady = true;
};

export const addProduct = async (id,name, price, category,piece ,availability) => {
    await ensureProductSchema();
    const newProduct = {
    id: String(id),
    name,
    price: Number(price),
    category,
    piece: Number(piece),
    availability,
};

    const inserted = await db.query(
        "INSERT INTO products(id,name,price,category,piece,availability) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,price,category,piece,availability",
        [
            newProduct.id,
            newProduct.name,
            newProduct.price,
            newProduct.category,
            newProduct.piece,
            newProduct.availability,
        ]
    );
    return inserted.rows[0];
};

export const fetchAllProduct = async () => {
    await ensureProductSchema();
    const products = await db.query("SELECT id,name,price,category,piece,availability FROM products ORDER BY CASE WHEN CAST(id AS TEXT) ~ '^[0-9]+$' THEN CAST(id AS INTEGER) END ASC NULLS LAST, CAST(id AS TEXT) ASC");
    return products.rows;
};

export const fetchProductById = async (idOrName) => {
    await ensureProductSchema();
    const product = await db.query(
        "SELECT id,name,price,category,piece,availability FROM products WHERE CAST(id AS TEXT)=CAST($1 AS TEXT) OR CAST(name AS TEXT)=CAST($1 AS TEXT) LIMIT 1",
        [idOrName]
    );
    return product.rows[0] || null;
};

export const removeProduct = async (id) => {
    await ensureProductSchema();
    const removed = await db.query("DELETE FROM products WHERE CAST(id AS TEXT)=CAST($1 AS TEXT)", [id]);
    return removed.rowCount > 0;
};
