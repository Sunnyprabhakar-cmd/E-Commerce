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

//Creating Product
export const createProduct=(req,res)=>{
    let {name,price,category,quantity}=req.body;
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
    if(!quantity){
        quantity=1;
    }
    const product =addProduct(name,price,category,quantity);
    return res.status(201).json(product);
}

//Get ALL product 
export const getAllProduct=(req,res)=>{
    const product=fetchAllProduct();
    const page=Number(req.query.page)||1;
    const limit=Number(req.query.limit)||10;
    const result=paginate(product,page,limit);
    return res.json(result);
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

        const productItem = fetchProductById(name);
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
    const name=req.body.name;
    console.log(name);
    if(!name){
        return res.status(400).json({
            message:"invalid id",
        })
    }
    const rmp=removeProduct(name);
    
    return res.status(201).json(rmp?{message:"Deleted Successfully"}:{message:"Product not found"});
}

//searching for a product
export const searchbar=(req,res)=>{
    if(!req.body || !req.body.keyword){
        return res.status(400).json({
            message:"invalid keyword",
        })
    }
    const page=Number(req.query.page)||1;
    const limit=Number(req.query.limit)||10;
    const result=search(req.body.keyword);
    if (result.message) {
        return res.status(404).json(result);
    }
    const paginatedResult=paginate(result,page,limit);
    return res.json(paginatedResult);
}

//filtering based on price
export const filterBasedOnPrice=(req,res)=>{
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
    const filtered=filter(from,to);
    const paginated=paginate(filtered,page,limit);
    return res.json(paginated);
}

//updating the product 
export const update=(req,res)=>{
    let {name,newName,category,price}=req.body;
    if(!name){
        return ({message:"invalid name"});
    }
    else if(!category){
        return ({message:"invalid update value"});
    }
    else{
        return ({message:"invalid update value"});
    }
    update_product(name,[newName,category,price]);
    return res.json({message:"update successful"});
}

export const sort_by_price=(req,res)=>{
    const temp=fetchAllProduct();
    const sortOrder = req.params.id; // assuming 'asc' or 'desc'
    if(sortOrder === 'asc'){
        temp.sort((a,b)=>a.price - b.price);
    } else if(sortOrder === 'desc'){
        temp.sort((a,b)=>b.price - a.price);
    }
    return res.json(temp);
}