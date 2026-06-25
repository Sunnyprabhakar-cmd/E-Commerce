import express from "express";
import {createProduct, getAllProduct,deleteProduct, 
    getProductById,searchbar, sort_by_price, filterBasedOnPrice,
    addProductIntoCart,deleteProductIntoCart,updateProductIntoCart,
    cartInfo,addToOrders,removeOrder,orderDetail,adminOrderDetail,
    avlBalance,
    balance_sub,wallet_details,add_balancee} 
    from "../controller/controller.js";
import  update_product  from "../services/update_product.js";
import  registeration  from "../login&registration/register.js";
import  login_user  from "../login&registration/login.js";
import auth from "../JWT/jwt_token.js";
import isAdmin from "../JWT/authorization.js";
import { authlimiter } from "../middleware/middleware.js";
const router=express.Router();

// Auth routes (no auth needed)
router.post("/register",authlimiter,registeration);
router.post("/login",authlimiter,login_user);

// Protected routes - specific routes BEFORE generic ones
router.post("/search",auth,searchbar);
router.post("/filter",auth,filterBasedOnPrice);
router.post("/update/:id",auth,isAdmin,update_product);
router.get("/sort/:id",auth,sort_by_price);
router.get("/cartInfo",auth,cartInfo);
router.post("/addProductInCart",auth,addProductIntoCart);
router.post("/deleteProductFromCart",auth,deleteProductIntoCart);
router.post("/updateCart",auth,updateProductIntoCart);
router.post("/placeOrder",auth,addToOrders);
router.post("/cancelOrder",auth,removeOrder);
router.get("/orders",auth,isAdmin,adminOrderDetail);
router.get("/orderDetail",auth,orderDetail);
router.get("/walletDetail",auth,wallet_details);
router.get("/avlBalance",auth,avlBalance);
router.post("/afterOrder",auth,balance_sub);
router.post("/balanceCredit",auth,add_balancee);

// Generic routes - after specific ones
router.post("/",auth,isAdmin,createProduct);
router.get("/",auth,getAllProduct);
router.delete("/",auth,isAdmin,deleteProduct);
router.get("/:id",auth,getProductById);

export default router;
