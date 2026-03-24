import fs from "fs";
import path from "path";
import product from "../product_data/data.js";

const DATA_PATH = path.resolve(process.cwd(), "product_data", "data.json");

export const loadProducts = () => {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.writeFileSync(DATA_PATH, JSON.stringify([], null, 2));
    }
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const arr = JSON.parse(raw);
    product.length = 0;
    product.push(...arr);
  } catch (err) {
    console.error("loadProducts error:", err);
  }
};

export const saveProducts = () => {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(product, null, 2));
  } catch (err) {
    console.error("saveProducts error:", err);
  }
};