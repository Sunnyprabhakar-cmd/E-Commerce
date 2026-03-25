import fs from "fs";
import path from "path";
import db from "../database/database.js";
import { ensureProductSchema } from "../product_model/model.js";

const DATA_PATH = path.resolve(process.cwd(), "product_data", "data.json");

const runMigration = async () => {
  try {
    await ensureProductSchema();

    if (!fs.existsSync(DATA_PATH)) {
      console.log("No product_data/data.json found. Nothing to migrate.");
      return;
    }

    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const products = JSON.parse(raw);

    if (!Array.isArray(products) || products.length === 0) {
      console.log("product_data/data.json is empty. Nothing to migrate.");
      return;
    }

    let inserted = 0;
    let skipped = 0;

    for (const item of products) {
      if (!item?.id || !item?.name) {
        skipped += 1;
        continue;
      }

      const result = await db.query(
        "INSERT INTO products(id,name,price,category,quantity) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
        [
          String(item.id),
          item.name,
          Number(item.price || 0),
          item.category || "general",
          Number(item.quantity || 0),
        ]
      );

      if (result.rowCount > 0) {
        inserted += 1;
      } else {
        skipped += 1;
      }
    }

    console.log(`Migration finished. Inserted: ${inserted}, Skipped: ${skipped}`);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

runMigration();
