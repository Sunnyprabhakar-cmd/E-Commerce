import product from "../product_data/data.js";

 const filter=(from,to)=>{
    const pro=[];
    for(var i=0;i<product.length;i++){
        if(product[i].price>=from && product[i].price<=to){
            pro.push(product[i]);
        }
    }
    return pro;
}
export default filter;