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
import { placeOrder,cancelOrder,orderDetails,fetchAllOrders,changeOrderStatus,updatePaymentProgress,updatePaymentProgressForGroup,cancelOrderGroup,changeOrderQuantity,applyOrderDiscount,fetchOrderActions } from "../orders/order.js";
import {
    balance_check,
    diduct_balance,
    wallet_details as wallet_details_service,
    add_balance,
} from "../payment/wallet.js";
import {
    getAdminSummary,
    getRecentProducts,
    getRecentStockEntries,
    getStockEntries,
    createStockEntry,
    listEmployees,
    getEmployeeProfiles,
    saveEmployeeProfile,
    generateEmployeeInvite,
    activateEmployeeInvite,
    getSalarySummary,
    saveEmployeePermissions,
    adjustEmployeeSalary,
    getSalaryHistory,
    findRefreshToken,
    revokeRefreshToken,
    saveRefreshToken,
} from "../services/admin_portal.js";
import { createAccessToken, createRefreshToken, hashRefreshToken, persistRefreshToken } from "../login&registration/login.js";
import jwt from 'jsonwebtoken';
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
        if (!Array.isArray(result)) {
            return res.status(400).json(result);
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
        const page=Number(req.query.page)||1;
        const limit=Number(req.query.limit)||10;
        const result=paginate(temp,page,limit);
        return res.json(result);
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
        const user_id = req.user.id || req.user.email;
        const userName = req.user.name || req.user.username || null;
        const userPhone = req.user.phone || req.user.mobile || null;
        const is_paid = typeof req.body.is_paid === 'boolean' ? req.body.is_paid : true;
        const payment_mode = req.body.payment_mode || null;
        const payment_reference = req.body.payment_reference || null;
        const payment_notes = req.body.payment_notes || null;
        const order_group_id = req.body.order_group_id || null;
        let orderItem = await placeOrder(
            req.body.product_id,
            user_id,
            order_group_id,
            req.body.quantity,
            req.body.product_price,
            is_paid,
            payment_mode,
            payment_reference,
            payment_notes
        );
        return res.status(200).json(orderItem);
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

export const adminOrderAction = async (req, res) => {
    try {
        const userId = req.user.id || req.user.email;
        const userName = req.user.name || req.user.username || null;
        const userPhone = req.user.phone || req.user.mobile || null;
        const userRole = req.user.role || 'admin';
        const {
            order_id,
            orderId,
            action,
            action_type,
            amount_received,
            amountReceived,
            payment_mode,
            payment_reference,
            payment_notes,
            discount_percentage,
        } = req.body;

        const requestedOrderId = order_id || orderId;
        const requestedAction = action || action_type;
        const requestedAmount = amount_received ?? amountReceived;
        const requestedDiscount = discount_percentage ?? req.body.discountPercentage ?? req.body.discount;

        if (!requestedOrderId || !requestedAction) {
            return res.status(400).json({ message: "order_id and action are required" });
        }

        if (req.user.role !== 'admin' && requestedAction !== 'apply_discount') {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (requestedAction === 'apply_discount' && req.user.role !== 'admin' && !req.user.permissions?.can_apply_discount) {
            return res.status(403).json({ message: 'Access denied for discount actions' });
        }

        if (requestedAction === 'cancel') {
            // support cancelling an order group
            let reply;
            if (String(requestedOrderId).startsWith('group-')) {
                reply = await cancelOrderGroup(requestedOrderId, userId, userName, userPhone, userRole);
            } else {
                reply = await cancelOrder(null, null, requestedOrderId, userId, userName, userPhone, userRole);
            }
            if (reply?.message === "order not found") {
                return res.status(404).json(reply);
            }
            if (reply?.error) {
                return res.status(400).json(reply);
            }

            const refundAmount = Number(reply?.refund_amount || 0);
            if (refundAmount > 0) {
                const targetUserId = reply?.user_id || userId;
                const creditInfo = await add_balance(
                    targetUserId,
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
        }

        if (requestedAction === 'accept') {
            const reply = await changeOrderStatus(requestedOrderId, 'accepted', userId, userName, userPhone, userRole, 'Order accepted by admin');
            if (reply?.message === 'order not found') {
                return res.status(404).json(reply);
            }
            if (reply?.error) {
                return res.status(400).json(reply);
            }
            return res.status(200).json(reply);
        }

        if (requestedAction === 'collect_payment') {
            if (!requestedAmount || Number(requestedAmount) <= 0) {
                return res.status(400).json({ message: "amount_received is required for collect_payment" });
            }
            // allow collect_payment on a group id as well
            let reply;
            if (String(requestedOrderId).startsWith('group-')) {
                reply = await updatePaymentProgressForGroup(
                    requestedOrderId,
                    Number(requestedAmount),
                    payment_mode || 'cash',
                    payment_reference || null,
                    payment_notes || `Partial payment of ${requestedAmount}`,
                    userId,
                    userName,
                    userPhone,
                    userRole
                );
            } else {
                reply = await updatePaymentProgress(
                    requestedOrderId,
                    Number(requestedAmount),
                    payment_mode || 'cash',
                    payment_reference || null,
                    payment_notes || `Partial payment of ${requestedAmount}`,
                    userId,
                    userName,
                    userPhone,
                    userRole
                );
            }
            if (reply?.message === 'order not found') {
                return res.status(404).json(reply);
            }
            if (reply?.error) {
                return res.status(400).json(reply);
            }
            return res.status(200).json(reply);
        }

        if (requestedAction === 'increase_qty' || requestedAction === 'decrease_qty') {
            const delta = requestedAction === 'increase_qty' ? 1 : -1;
            const reply = await changeOrderQuantity(
                requestedOrderId,
                delta,
                userId,
                userName,
                userPhone,
                userRole
            );
            if (reply?.message === 'order not found') {
                return res.status(404).json(reply);
            }
            if (reply?.error) {
                return res.status(400).json(reply);
            }
            return res.status(200).json(reply);
        }

        if (requestedAction === 'apply_discount') {
            const discount_percentage = Number(requestedDiscount || 0);
            if (Number.isNaN(discount_percentage) || discount_percentage < 0 || discount_percentage > 100) {
                return res.status(400).json({ message: "discount_percentage must be between 0 and 100" });
            }
            const reply = await applyOrderDiscount(
                requestedOrderId,
                discount_percentage,
                userId,
                userName,
                userPhone,
                userRole
            );
            if (reply?.message === 'order not found') {
                return res.status(404).json(reply);
            }
            if (reply?.error) {
                return res.status(400).json(reply);
            }
            return res.status(200).json(reply);
        }

        return res.status(400).json({ message: "Unsupported admin action", action: requestedAction });
    } catch (err) {
        return res.status(400).json({ message: "some error occured", error: err });
    }
}

export const adminSummary = async (_req, res) => {
    try {
        const { startDate = null, endDate = null } = _req.query || {};
        const [summary, recentProducts, recentStockEntries] = await Promise.all([
            getAdminSummary({ startDate, endDate }),
            getRecentProducts(10),
            getRecentStockEntries(10),
        ]);
        return res.status(200).json({
            message: 'summary fetched',
            summary,
            recent_products: recentProducts,
            recent_stock_entries: recentStockEntries,
            filters: { startDate: startDate || null, endDate: endDate || null },
        });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const stockList = async (_req, res) => {
    try {
        const entries = await getStockEntries();
        return res.status(200).json({ message: 'stock entries fetched', entries });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const stockCreate = async (req, res) => {
    try {
        const result = await createStockEntry({
            product_id: String(req.body.product_id || req.body.productId || ''),
            units: req.body.units,
            notes: req.body.notes,
            recorded_by_user_id: req.user.id || req.user.email,
            recorded_by_name: req.user.name || req.user.username || null,
        });

        if (!result.ok) {
            return res.status(400).json(result);
        }

        return res.status(201).json({ message: 'stock entry created', entry: result.entry });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const employeeList = async (_req, res) => {
    try {
        const employees = await getEmployeeProfiles();
        return res.status(200).json({ message: 'employees fetched', employees });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const employeeProfileUpsert = async (req, res) => {
    try {
        const result = await saveEmployeeProfile({
            employee_id: req.params.id || req.body.employee_id,
            employee_name: req.body.employee_name || req.body.name,
            phone: req.body.phone,
            aadhar_card: req.body.aadhar_card || req.body.adharcard,
            salary: req.body.salary,
            notes: req.body.notes,
            created_by_user_id: req.user.id || req.user.email,
            created_by_name: req.user.name || req.user.username || null,
        });
        if (!result.ok) {
            return res.status(400).json(result);
        }
        return res.status(200).json({ message: 'employee profile saved', employee: result.employee });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const employeeInviteCreate = async (req, res) => {
    try {
        const result = await generateEmployeeInvite({
            employee_id: req.params.id || req.body.employee_id,
            created_by_user_id: req.user.id || req.user.email,
            created_by_name: req.user.name || req.user.username || null,
            daysValid: req.body.daysValid || 7,
        });
        if (!result.ok) {
            return res.status(400).json(result);
        }
        const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
        return res.status(200).json({
            message: 'invite created',
            invite: result.invite,
            invite_link: `${baseUrl}/employee-invite/${result.invite.invite_token}`,
        });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const employeeInviteActivate = async (req, res) => {
    try {
        const result = await activateEmployeeInvite({
            invite_token: req.params.token,
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            password: req.body.password,
        });
        if (!result.ok) {
            return res.status(400).json(result);
        }
        const accessToken = createAccessToken({
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            employee_id: result.employee_id,
        });
        const refreshToken = createRefreshToken({
            id: result.user.id,
            role: result.user.role,
            employee_id: result.employee_id,
        });
        await persistRefreshToken(result.user.id, refreshToken);
        return res.status(200).json({
            message: 'employee account created',
            ...result,
            token: accessToken,
            refreshToken,
        });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const refreshAuthToken = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token missing' });
        }

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET || process.env.SECRET || 'secretkey');
        const existing = await findRefreshToken(hashRefreshToken(refreshToken));
        if (!existing || existing.revoked_at || new Date(existing.expires_at).getTime() < Date.now()) {
            return res.status(401).json({ message: 'Refresh token expired' });
        }

        const employeeId = decoded?.employee_id || null;
        const newAccessToken = createAccessToken({
            id: decoded.id,
            role: decoded.role,
            employee_id: employeeId,
        });
        return res.status(200).json({
            message: 'token refreshed',
            token: newAccessToken,
        });
    } catch (err) {
        return res.status(401).json({ message: 'Refresh token expired', error: err.message });
    }
};

export const salarySummary = async (req, res) => {
    try {
        const summary = await getSalarySummary({
            employeeId: req.query.employeeId || null,
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
        });
        return res.status(200).json({ message: 'salary summary fetched', summary });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const employeeUpsert = async (req, res) => {
    try {
        const result = await saveEmployeePermissions(req.params.id || req.body.employee_id, req.body);
        if (!result.ok) {
            return res.status(400).json(result);
        }
        return res.status(200).json({ message: 'employee permissions saved', employee: result.employee });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const employeeSalaryAdjust = async (req, res) => {
    try {
        const result = await adjustEmployeeSalary(
            req.params.id || req.body.employee_id,
            req.body.amount,
            req.body.reason,
            req.body.adjustment_type,
            req.user.id || req.user.email,
            req.user.name || req.user.username || null
        );
        if (!result.ok) {
            return res.status(400).json(result);
        }
        return res.status(200).json({ message: 'salary updated', ...result });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const employeeSalaryHistory = async (req, res) => {
    try {
        const history = await getSalaryHistory(req.params.id);
        return res.status(200).json({ message: 'salary history fetched', history });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
    }
};

export const removeOrder=async(req,res)=>{
    try{
       const userId = req.user.id || req.user.email;
       const orderId = req.body.order_id || null;
       let reply;
       if (orderId && String(orderId).startsWith('group-')) {
           reply = await cancelOrderGroup(orderId, userId, req.user.name || req.user.username || null, req.user.phone || req.user.mobile || null, 'user');
       } else {
           reply = await cancelOrder(req.body.product_id, userId, orderId);
       }

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

export const adminOrderDetail=async(req,res)=>{
    try{
        let reply=await fetchAllOrders();
        return res.status(200).json(reply);
    }catch(err){
        return res.status(400).json({message:"some error occured",error:err});
    }
}

export const getOrderActionHistory = async (req, res) => {
    try {
        const orderId = req.params.id;
        if (!orderId) {
            return res.status(400).json({ message: 'order id is required' });
        }
        const actions = await fetchOrderActions(orderId);
        if (actions.length === 0 && String(orderId).startsWith('group-')) {
            const groupedOrders = await fetchAllOrders();
            const matchingGroup = groupedOrders.orders?.filter((order) => order.order_group_id === orderId) || [];
            const mergedActions = [];
            for (const order of matchingGroup) {
                const orderActions = await fetchOrderActions(order.order_id);
                mergedActions.push(...orderActions);
            }
            mergedActions.sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
            return res.status(200).json({ message: 'order action history fetched', actions: mergedActions });
        }
        return res.status(200).json({ message: 'order action history fetched', actions });
    } catch (err) {
        return res.status(400).json({ message: 'some error occured', error: err.message });
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