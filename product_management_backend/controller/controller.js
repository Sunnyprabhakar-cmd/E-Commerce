import {
    addProduct,
    fetchAllProduct,
    fetchProductById,
    removeProduct,
} from "../product_model/model.js";
import search from "../services/search.js";
import filter from "../services/fileter.js";
import update_product from "../services/update_product.js";
import { paginate } from "../utils/pagination.js";
import { add_to_cart,cart_info,delete_info_cart,update_cart } from "../cart/cart.js";
import { placeOrder,cancelOrder,orderDetails } from "../orders/order.js";
import {
    balance_check,
    diduct_balance,
    wallet_details as wallet_details_service,
    add_balance,
} from "../payment/wallet.js";
//Creating Product
export const createProduct=(req,res)=>{
    try{
    let {id,name,price,category,piece,availability}=req.body;
    if(!name){
        return res.status(400).json({
            message:"invalid name",
        })}
    if(!price || price<=0){
        return res.status(400).json({
            message:"invalid price",
        })
    }
    if(!category ){
        return res.status(400).json({
            message:"invalid category",
        })
    }
    if(!piece || piece<0){
        return res.status(400).json({
            message:"invalid piece",
        })
    }
    const persist = async () => {
        const product = await addProduct(id,name,price,category,piece,availability);
        return res.status(201).json(product);
    };
    return persist().catch((err)=>res.status(400).json({message:"some error occured",error:err.message}));
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

//Get ALL product 
export const getAllProduct=(req,res)=>{
    try{
    const run = async () => {
        const product=await fetchAllProduct();
        const page=Number(req.query.page)||1;
        const limit=Number(req.query.limit)||10;
        const result=paginate(product,page,limit);
        return res.json(result);
    };
    return run().catch((err)=>res.status(400).json({message:"some error occured",error:err.message}));
    }
    catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

//Get product by name
export const getProductById=async(req,res)=>{
    try{
        const name = req.params.id;
        console.log('lookup name:', name);

        if(!name){
            return res.status(400).json({
                message:"invalid name",
            });
        }

        const productItem = await fetchProductById(name);
        console.log('found product:', productItem);

        if (!productItem) {
            return res.status(404).json({ message: "Product not found" });
        }

        return res.status(200).json(productItem);
    } catch(err) {
        console.error(err);
        return res.status(500).json({ message: "internal error" });
    }
}

//Delete a product by id
export const deleteProduct=(req,res)=>{
    try{
    const id=req.body.id;
    if(!id){
        return res.status(400).json({
            message:"invalid id",
        })
    }
    const run = async () => {
        const rmp=await removeProduct(id);
        return res.status(201).json(rmp?{message:"Deleted Successfully"}:{message:"Product not found"});
    };
    return run().catch((err)=>res.status(400).json({message:"some error occured",error:err.message}));
   }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

//searching for a product
export const searchbar=(req,res)=>{
    try{
    if(!req.body || !req.body.keyword){
        return res.status(400).json({
            message:"invalid keyword",
        })
    }
    const page=Number(req.query.page)||1;
    const limit=Number(req.query.limit)||10;
    const run = async () => {
        const result=await search(req.body.keyword);
        if (result.message) {
            return res.status(404).json(result);
        }
        const paginatedResult=paginate(result,page,limit);
        return res.json(paginatedResult);
    };
    return run().catch((err)=>res.status(400).json({message:"some error occured",error:err.message}));
   }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

//filtering based on price
export const filterBasedOnPrice=(req,res)=>{
    try{
    let {from,to}=req.body;
    if(from == null || from === ''){
        from = 0;
    }
    if(to == null || to === ''){
        to = Number.MAX_VALUE;
    }
    from = Number(from);
    to = Number(to);
    if (Number.isNaN(from) || Number.isNaN(to)) {
        return res.status(400).json({message:'invalid from/to values'});
    }
    const page=Number(req.query.page)||1;
    const limit=Number(req.query.limit)||10;
    const run = async () => {
        const filtered=await filter(from,to);
        const paginated=paginate(filtered,page,limit);
        return res.json(paginated);
    };
    return run().catch((err)=>res.status(400).json({message:"some error occured",error:err.message}));
   }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

//updating the product 
// updating the product
export const update = (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                message: "Invalid product id",
            });
        }

        return update_product(req, res);

    } catch (err) {
        return res.status(400).json({
            message: "Some error occurred",
            error: err.message,
        });
    }
};
//Sorting product based on price
export const sort_by_price=(req,res)=>{
    try{
    const run = async () => {
        const temp=await fetchAllProduct();
        const sortOrder = req.params.id; 
        if(sortOrder === 'asc'){
            temp.sort((a,b)=>Number(a.price) - Number(b.price));
        } else if(sortOrder === 'desc'){
            temp.sort((a,b)=>Number(b.price) - Number(a.price));
        }
        return res.json(temp);
    };
    return run().catch((err)=>res.status(400).json({message:"some error occured",error:err.message}));
   }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}
export const addProductIntoCart=async(req,res)=>{
    try{
        const userId = req.user.id || req.user.email;
        const result = await add_to_cart(userId,req.body.product_id,req.body.quantity);
        if (!result?.ok) {
            return res.status(400).json({message: result?.message || "Error in cart management", error: result?.error});
        }
        return res.status(200).json({message:result.message});
    }catch(err){
        return res.status(400).json({message:"Error in cart management",error:err.message});
    }
}

export const deleteProductIntoCart=async(req,res)=>{
    try{
        const userId = req.user.id || req.user.email;
        const result = await delete_info_cart(userId,req.body.product_id);
        if (!result?.ok) {
            return res.status(400).json({message: result?.message || "Error in cart management", error: result?.error});
        }
        return res.status(200).json({message:result.message});
    }catch(err){
        return res.status(400).json({message:"Error in cart management",error:err.message});
    }
}

export const updateProductIntoCart=async(req,res)=>{
    try{
        const userId = req.user.id || req.user.email;
        const result = await update_cart(userId,req.body.product_id,req.body.operation);
        if (!result?.ok) {
            return res.status(400).json({message: result?.message || "Error in cart management", error: result?.error});
        }
        return res.status(200).json({message:result.message});
    }catch(err){
        return res.status(400).json({message:"Error in cart management",error:err.message});
    }
}

export const cartInfo=async(req,res)=>{
    try{
        const userId = req.user.id || req.user.email;
        const pro=await cart_info(userId);
        return res.status(200).json({data:pro});
    }catch(err){
        return res.status(400).json({message:"Error in cart management",error:err.message});
    }
}

export const addToOrders=async(req,res)=>{
    try{
        let user_id=req.user.id || req.user.email;
        let orderItem=await placeOrder(req.body.product_id,user_id,req.body.quantity,req.body.product_price);
        return res.status(200).json(orderItem);
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

export const removeOrder=async(req,res)=>{
    try{
       const userId = req.user.id || req.user.email;
       const reply = await cancelOrder(req.body.product_id, userId, req.body.order_id);

       if (reply?.message === "order not found") {
           return res.status(404).json(reply);
       }
       if (reply?.error) {
           return res.status(400).json(reply);
       }

       const refundAmount = Number(reply?.refund_amount || 0);
       if (refundAmount > 0) {
           const creditInfo = await add_balance(
               userId,
               refundAmount,
               "credit",
               "order_cancel",
               `Refund for cancelled order ${reply.order_id}`,
               reply.order_id
           );

           if (!creditInfo.ok) {
               return res.status(400).json({
                   message: "Order cancelled but wallet refund failed",
                   cancel: reply,
                   refund: creditInfo,
               });
           }

           return res.status(200).json({
               ...reply,
               wallet_balance: creditInfo.balance,
               refund_status: "credited",
           });
       }

       return res.status(200).json(reply);
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

export const orderDetail=async(req,res)=>{
    try{
        let reply=await orderDetails(req.user.id || req.user.email);
        return res.status(200).json(reply);
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

export const wallet_details=async(req,res)=>{
    try{
        const userId = req.user.id || req.user.email;
        const detail = await wallet_details_service(userId);
        if (!detail.ok) {
            return res.status(400).json(detail);
        }
        return res.status(200).json(detail);
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}
export const avlBalance=async(req,res)=>{
    try{
        const userId = req.user.id || req.user.email;
        const detail = await balance_check(userId);
        if (!detail.ok) {
            return res.status(400).json(detail);
        }
        return res.status(200).json(detail);
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}
export const balance_sub=async(req,res)=>{
    try{
        const user_id = req.user.id || req.user.email;
        const amount = req.body.price;
        const type = req.body.type;
        const reference_type = req.body.reference_type;
        const description = req.body.message;
        const reference_id = req.body.order_id;
        const info = await diduct_balance(user_id,amount,type,reference_type,description,reference_id);
        if (!info.ok) {
            return res.status(400).json(info);
        }
        return res.status(200).json(info);
    }catch(err){
       return res.status(400).json({message:"some error occured",error:err});
    }
}
export const add_balancee=async(req,res)=>{
    try{
        const user_id = req.user.id || req.user.email;
        const amount = req.body.price;
        const type = req.body.type;
        const reference_type = req.body.reference_type;
        const description = req.body.message;
        const reference_id = req.body.order_id;
        const info = await add_balance(user_id,amount,type,reference_type,description,reference_id);
        if (!info.ok) {
            return res.status(400).json(info);
        }
        return res.status(200).json(info);
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}