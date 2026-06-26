import db from "../database/database.js";

const update_product = (req, res) => {
    const run = async () => {
        const { id } = req.params;
        const { name, category, price, piece, availability } = req.body;

        const fields = [];
        const values = [];

        if (name != null && name !== "") {
            values.push(name);
            fields.push(`name=$${values.length}`);
        }
        if (category != null && category !== "") {
            values.push(category);
            fields.push(`category=$${values.length}`);
        }
        if (price != null && price !== "") {
            values.push(Number(price));
            fields.push(`price=$${values.length}`);
        }
        if (piece != null && piece !== "") {
             values.push(Number(piece));
            fields.push(`piece=$${values.length}`);
       }
        if (availability !== undefined) {
           values.push(availability);
           fields.push(`availability=$${values.length}`);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        values.push(id);
        const updated = await db.query(
            `UPDATE products SET ${fields.join(",")} WHERE CAST(id AS TEXT)=CAST($${values.length} AS TEXT) RETURNING id,name,price,category,piece,availability`,
            values
        );

        if (updated.rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        return res.status(200).json({ message: "Product updated successfully", product: updated.rows[0] });
    };

    run().catch((err) => {
         console.error(err);        // prints full error
    console.error(err.stack);  // prints file + line number
        return res.status(500).json({ message: "Error updating product", error: err.message });
    });
};

export default update_product;