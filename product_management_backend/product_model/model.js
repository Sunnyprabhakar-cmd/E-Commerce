import product from "../product_data/data.js";
import {v4 as uuidv4} from "uuid";
import { saveProducts } from "../utils/storage.js";
export const addProduct=(name,price,category,quantity)=>{
    const newProduct={
        id:uuidv4(),
        name,
        price,
        category,
        quantity,
    }
    product.push(newProduct);
    saveProducts();
    return newProduct;
};

export const fetchAllProduct=()=>{
    return product;
}

export const fetchProductById=(name)=>{
    // return first matching name (exact match) or null if not found
    return product.find(p=>p.name===name) || null;
}

export const removeProduct=(name)=>{
    const index=product.findIndex(product=>product.name===name);
    if(index===-1){
        return false;
    }
    product.splice(index,1);
    saveProducts();
    return true;
};
