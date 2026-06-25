import db from "../database/database.js";
import { matchPassword } from "../bcrypt/bcrypt.js";
import env from "dotenv";
import jwt from "jsonwebtoken";
env.config();
 const login_user=async(req,res)=>{
    try{
    const{email,password}=req.body;
     const verification=await db.query("SELECT id,name,email,password,role FROM users WHERE email=$1",[email]);
    
    if(verification.rows.length === 0){
        return res.status(401).json({message:"Invalid email or password"});
    }
    const verified=await matchPassword(password,verification.rows[0].password);
    if(verified){
        console.log(verification.rows[0].role);
        const token=jwt.sign(
            {
                id: verification.rows[0].id,
                name: verification.rows[0].name,
                email: verification.rows[0].email,
                role: verification.rows[0].role,
            },
            process.env.SECRET || "secretkey",
            {expiresIn:"1h"}
        );
        return res.status(200).json({message:"Login successful",token:token});
    } else {
        return res.status(401).json({message:"Invalid email or password"});
    }
    }catch(err){
        console.log(err);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export default login_user;