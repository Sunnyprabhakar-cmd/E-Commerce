import db from "../database/database.js";

let isOrderSchemaReady = false;

const ensureOrderSchema = async () => {
    if (isOrderSchemaReady) {
        return;
    }
    // Existing DB uses integer product_id while app product IDs are UUID strings.
    await db.query("ALTER TABLE orders ALTER COLUMN product_id TYPE text USING product_id::text");
    isOrderSchemaReady = true;
};

export const placeOrder=async(product_id,user_id,quantity,product_price)=>{
    try{
        if(!product_id||!user_id||!quantity||!product_price){
            return ({message:"Invalid parameters try again"});
        }
        await ensureOrderSchema();
        const pid=String(product_id);
        const qty=Number(quantity);
        const unitPrice=Number(product_price);
        if(Number.isNaN(qty) || qty<=0 || Number.isNaN(unitPrice) || unitPrice<=0){
            return ({message:"Invalid quantity or product price"});
        }
        const total_cost=qty*unitPrice;
        try{
            const created=await db.query(
                "INSERT INTO orders(product_id,user_id,quantity,product_price,total_cost) VALUES ($1,$2,$3,$4,$5) RETURNING order_id",
                [pid,user_id,qty,unitPrice,total_cost]
            );
            return ({
                message:"your order is placed",
                tracking_id:created.rows?.[0]?.order_id ?? null,
                order:{product_id:pid,user_id,quantity:qty,product_price:unitPrice,total_cost}
            });
        }catch(err){
            return ({message:"error occured while placing order",error:err.message});
        }
    }catch(err){
        return ({message:"error occured while placing order",error:err.message});
    }
}
export const cancelOrder=async(product_id,user_id,order_id)=>{
    try{
        if(!user_id || (!product_id && !order_id)){
            return ({message:"Invalid parameters try again"});
        }
        await ensureOrderSchema();
        try{
            let orderRow;

            if (order_id) {
                const selectedById = await db.query(
                    "SELECT order_id,product_id,total_cost FROM orders WHERE order_id=$1 AND user_id=$2 LIMIT 1",
                    [order_id, user_id]
                );
                orderRow = selectedById.rows?.[0];
            } else {
                const pid=String(product_id);
                const selectedByProduct = await db.query(
                    "SELECT order_id,product_id,total_cost FROM orders WHERE product_id=$1 AND user_id=$2 ORDER BY order_id DESC LIMIT 1",
                    [pid, user_id]
                );
                orderRow = selectedByProduct.rows?.[0];
            }

            if(!orderRow){
                return ({message:"order not found"});
            }

            await db.query("DELETE FROM orders WHERE order_id=$1 AND user_id=$2", [orderRow.order_id, user_id]);

            return ({
                message:"your order is successfully cancelled",
                order_id: orderRow.order_id,
                product_id: orderRow.product_id,
                refund_amount: Number(orderRow.total_cost || 0),
            });
        }catch(err){
            return ({message:"error occured while cancelling order",error:err.message});
        }
    }catch(err){
        return ({message:"error occured while cancelling order",error:err.message});
    }
}
export const orderDetails=async(user_id)=>{
    try{
        if(!user_id){
            return ({message:"Invalid user"});
        }
        await ensureOrderSchema();
        try{
            let orderHistory=await db.query("SELECT * FROM orders WHERE user_id=$1",[user_id]);
            return ({message:"order details fetched",orders:orderHistory.rows || []});
        }catch(err){
            return ({message:"error occured while fetching order details",error:err.message});
        }
    }catch(err){
        return ({message:"error occured while fetching order details",error:err.message});
    }
}