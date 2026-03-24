export const paginate=(data,page,limit=10)=>{
    const startIndex=(page-1)*limit;
    const endIndex=page*limit;
    return{
        page,limit,
        total:data.length,
        totalPages:Math.ceil(data.length/limit),
        data:data.slice(startIndex,endIndex),
    };
};