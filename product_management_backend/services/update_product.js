import product from "../product_data/data.js";
import { saveProducts } from "../utils/storage.js";

const update_product = (req, res) => {
    const { id } = req.params;
    const { name, category, price, quantity } = req.body;

    const productIndex = product.findIndex(p => p.id === id);
    if (productIndex === -1) {
        return res.status(404).json({ message: "Product not found" });
    }

    if (name) product[productIndex].name = name;
    if (category) product[productIndex].category = category;
    if (price) product[productIndex].price = price;
    if (quantity) product[productIndex].quantity = quantity;

    saveProducts();
    return res.status(200).json({ message: "Product updated successfully", product: product[productIndex] });
};

export default update_product;