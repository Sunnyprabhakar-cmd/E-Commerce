import express from "express";
import {createProduct, getAllProduct,deleteProduct, 
    getProductById,searchbar, sort_by_price, filterBasedOnPrice,
    addProductIntoCart,deleteProductIntoCart,updateProductIntoCart,
    cartInfo,addToOrders,removeOrder,orderDetail,adminOrderDetail,adminOrderAction,getOrderActionHistory,
    avlBalance,
    balance_sub,wallet_details,add_balancee,adminSummary,stockList,stockCreate,employeeList,employeeProfileUpsert,employeeUpsert,employeeSalaryAdjust,employeeSalaryHistory,salarySummary} 
    from "../controller/controller.js";
import  update_product  from "../services/update_product.js";
import  registeration  from "../login&registration/register.js";
import  login_user  from "../login&registration/login.js";
import auth from "../JWT/jwt_token.js";
import isAdmin from "../JWT/authorization.js";
import { requirePermission } from "../JWT/permissions.js";
import { authlimiter } from "../middleware/middleware.js";
const router=express.Router();

// Auth routes (no auth needed)
router.post("/register",authlimiter,registeration);
router.post("/login",authlimiter,login_user);

// Protected routes - specific routes BEFORE generic ones
router.post("/search",auth,searchbar);
router.post("/filter",auth,filterBasedOnPrice);
router.post("/update/:id",auth,requirePermission("can_update_product"),update_product);
router.get("/sort/:id",auth,sort_by_price);
router.get("/cartInfo",auth,cartInfo);
router.post("/addProductInCart",auth,addProductIntoCart);
router.post("/deleteProductFromCart",auth,deleteProductIntoCart);
router.post("/updateCart",auth,updateProductIntoCart);
router.post("/placeOrder",auth,addToOrders);
router.post("/cancelOrder",auth,removeOrder);
router.post("/admin/orderAction",auth,adminOrderAction);
router.post("/admin/order-action",auth,adminOrderAction);
router.get("/admin/orderActions/:id",auth,isAdmin,getOrderActionHistory);
router.get("/admin/order-actions/:id",auth,isAdmin,getOrderActionHistory);
router.get("/orders",auth,isAdmin,adminOrderDetail);
router.get("/admin/summary",auth,isAdmin,adminSummary);
router.get("/admin/stock",auth,requirePermission("can_manage_stock"),stockList);
router.post("/admin/stock",auth,requirePermission("can_manage_stock"),stockCreate);
router.get("/admin/employees",auth,isAdmin,employeeList);
router.get("/admin/salary-summary",auth,isAdmin,salarySummary);
router.post("/admin/employees/:id/profile",auth,isAdmin,employeeProfileUpsert);
router.post("/admin/employees/:id/permissions",auth,isAdmin,employeeUpsert);
router.post("/admin/employees/:id/salary",auth,isAdmin,employeeSalaryAdjust);
router.get("/admin/employees/:id/salary",auth,isAdmin,employeeSalaryHistory);
router.get("/orderDetail",auth,orderDetail);
router.get("/walletDetail",auth,wallet_details);
router.get("/avlBalance",auth,avlBalance);
router.post("/afterOrder",auth,balance_sub);
router.post("/balanceCredit",auth,add_balancee);

// Generic routes - after specific ones
router.post("/",auth,requirePermission("can_create_product"),createProduct);
router.get("/",auth,getAllProduct);
router.delete("/",auth,requirePermission("can_delete_product"),deleteProduct);
router.get("/:id",auth,getProductById);

export default router;
