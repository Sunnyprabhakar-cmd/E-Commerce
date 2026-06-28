import db from "../database/database.js";
import { matchPassword } from "../bcrypt/bcrypt.js";
import { hashPassword } from "../bcrypt/bcrypt.js";
import env from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { saveRefreshToken, loadEmployeeAccountByUserId } from "../services/admin_portal.js";
env.config();

const normalizePhone = (value = '') => String(value || '').replace(/[^\d+]/g, '');

export const createAccessToken = (payload) => jwt.sign(payload, process.env.SECRET || "secretkey", { expiresIn: "15m" });

export const createRefreshToken = (payload) => jwt.sign(payload, process.env.REFRESH_SECRET || process.env.SECRET || "secretkey", { expiresIn: "30d" });

export const hashRefreshToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export const persistRefreshToken = async (userId, refreshToken) => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await saveRefreshToken({ user_id: userId, token_hash: hashRefreshToken(refreshToken), expires_at: expiresAt });
};

export const hashLoginPassword = async (password) => hashPassword(password);

 const login_user=async(req,res)=>{
    try{
     const{email,password}=req.body;
     const identifier = String(email || '').trim();
      if (!identifier || !password) {
          return res.status(400).json({ message: "Email or phone and password are required" });
      }

      let verification;
      if (identifier.includes('@')) {
          verification = await db.query(
                "SELECT id,name,email,password,role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
                [identifier]
          );
      } else {
          const normalizedPhone = normalizePhone(identifier);
          const phoneDigits = normalizedPhone.replace(/\D/g, '');
          verification = await db.query(
                `SELECT id,name,email,password,role
                 FROM users
                 WHERE phone = $1
                     OR regexp_replace(phone, '[^0-9]', '', 'g') = $2
                     OR right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = right($2, 10)
                 LIMIT 1`,
                [normalizedPhone, phoneDigits]
          );
      }
    
    if(verification.rows.length === 0){
        return res.status(401).json({message:"Invalid email or password"});
    }
    const verified=await matchPassword(password,verification.rows[0].password);
    if(verified){
        console.log(verification.rows[0].role);
        const employeeAccount = await loadEmployeeAccountByUserId(verification.rows[0].id);
        const accessToken = createAccessToken(
            {
                id: verification.rows[0].id,
                name: verification.rows[0].name,
                email: verification.rows[0].email,
                role: verification.rows[0].role,
                employee_id: employeeAccount?.employee_id || null,
            },
        );
        const refreshToken = createRefreshToken(
            {
                id: verification.rows[0].id,
                role: verification.rows[0].role,
                employee_id: employeeAccount?.employee_id || null,
            },
        );
        await persistRefreshToken(verification.rows[0].id, refreshToken);
        return res.status(200).json({
            message:"Login successful",
            token: accessToken,
            refreshToken,
            employee_id: employeeAccount?.employee_id || null,
        });
    } else {
        return res.status(401).json({message:"Invalid email or password"});
    }
    }catch(err){
        console.log(err);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export default login_user;