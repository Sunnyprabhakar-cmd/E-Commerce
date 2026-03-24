import product from "../product_data/data.js";
const search=(keyword)=>{
    const pro=[];
    if(!keyword){
        return ({message:"invalid keyword"});
    }
    for(var i=0;i<product.length;i++){
        if(product[i].category===keyword){
            pro.push(product[i]);
        }
    }
    if(pro.length===0){
        return ({message:"no product available"});
    }
    return pro;
} 
export default search;