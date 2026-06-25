import db from "../database/database.js";

let isCartSchemaReady = false;

const ensureCartSchema = async () => {
    if (isCartSchemaReady) {
        return;
    }
    // product IDs in this app are UUID strings; ensure DB column can store them.
    await db.query("ALTER TABLE cart_items ALTER COLUMN product_id TYPE INTEGER USING product_id::INTEGER");
    isCartSchemaReady = true;
};

export const add_to_cart=async(user_id,product_id,quantity)=>{
    try{
        await ensureCartSchema();
        if(!product_id){
            return {ok:false,message:"Invalid product ID"};
        }
        if(!quantity){
            quantity=1;
        }
        if(!user_id){
            return {ok:false,message:"Invalid user"};
        }
        const qty = Number(quantity) || 1;
        const pid = String(product_id);
        const existingProduct = await db.query(
            "SELECT id,name,price,category FROM products WHERE id=$1 LIMIT 1",
            [pid]
        );
        if (existingProduct.rows.length === 0) {
            return {ok:false,message:"Product not found"};
        }

        const existing = await db.query("SELECT quantity FROM cart_items WHERE user_id=$1 AND product_id=$2", [user_id, pid]);
        if (existing.rows.length > 0) {
            await db.query("UPDATE cart_items SET quantity=$1 WHERE user_id=$2 AND product_id=$3", [existing.rows[0].quantity + qty, user_id, pid]);
        } else {
            await db.query("INSERT INTO cart_items(user_id,product_id,quantity) VALUES ($1,$2,$3)",[user_id,pid,qty]);
        }
        return {ok:true,message:"Product added to cart successfully"};
    }catch(err){
        return ({ok:false,message:"Error in cart management",error:err.message});
    }
}

export const cart_info=async(user_id)=>{
    try{
        await ensureCartSchema();
        if(!user_id){
            return ({message:"Invalid user"});
        }
        const productInCart=await db.query(
            `SELECT c.user_id,c.product_id,c.quantity,
                    p.name AS product_name,
                    p.price,
                    p.category
             FROM cart_items c
             LEFT JOIN products p ON p.id = c.product_id
             WHERE c.user_id=$1`,
            [user_id]
        );

        return productInCart.rows.map((row) => ({
            ...row,
            product_name: row.product_name || `Product ${row.product_id}`,
            price: Number(row.price || 0),
            category: row.category || 'N/A',
        }));
    }catch(err){
        return ({message:"Error in cart management",error:err.message});
    }
}

export const delete_info_cart=async(user_id,product_id)=>{
    try{
        await ensureCartSchema();
        if(!product_id){
            return ({ok:false,message:"Invalid product"});
        }
        if(!user_id){
            return ({ok:false,message:"Invalid user"});
        }
        const pid = String(product_id);
        await db.query("DELETE FROM cart_items where product_id=$1 AND user_id=$2",[pid,user_id]);
        return {ok:true,message:"Product deleted from cart successfully"};
    }catch(err){
        return ({ok:false,message:"Error in cart management",error:err.message});
    }
}

export const update_cart=async(user_id,product_id,operation)=>{
    try{
        await ensureCartSchema();
        if(!product_id || !operation){
            return ({ok:false,message:"Invalid product or operation"});
        }
        if(!user_id){
            return ({ok:false,message:"Invalid user"});
        }

        const pid = String(product_id);
        const cartItems=await db.query("SELECT quantity FROM cart_items WHERE product_id=$1 AND user_id=$2",[pid,user_id]);
        
        if(cartItems.rows.length === 0){
            return ({ok:false,message:"Product not in cart"});
        }
        
        let current_qty=cartItems.rows[0].quantity;
        
        if(operation==="add"){
                await db.query("UPDATE cart_items SET quantity=$1 WHERE product_id=$2 AND user_id=$3",[current_qty+1,pid,user_id]);
        }
        else if(operation==="subtract"){
            if(current_qty===1){
                await delete_info_cart(user_id,pid);
            }else{
                await db.query("UPDATE cart_items SET quantity=$1 WHERE product_id=$2 AND user_id=$3",[current_qty-1,pid,user_id]);
            }
        } else {
            return ({ok:false,message:"Invalid operation"});
        }
        return {ok:true,message:"Cart updated successfully"};
    }catch(err){
        return ({ok:false,message:"Error in cart management",error:err.message});
    }
}