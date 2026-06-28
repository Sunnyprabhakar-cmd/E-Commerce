import db from "../database/database.js";
import { hashPassword } from "../bcrypt/bcrypt.js";
import { create_wallet } from "../payment/wallet.js";

const normalizePhone = (value = '') => String(value || '').replace(/[^\d+]/g, '');

const registeration=async(req,res)=>{
   try{
    const{name,password,email,phone} =req.body||{};
    if(!email||!phone||!name||!password){
        return res.status(400).json({message:"All fields are required"});
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const userquery=await db.query(
        `SELECT email,phone FROM users
         WHERE LOWER(email) = LOWER($1)
            OR phone = $2
            OR regexp_replace(phone, '[^0-9]', '', 'g') = $3
            OR right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = right($3, 10)`,
        [normalizedEmail, normalizedPhone, phoneDigits]
    );
    const emailExists = userquery.rows.some((row) => String(row.email || '').toLowerCase() === normalizedEmail);
    const phoneExists = userquery.rows.some((row) => {
        const storedPhone = normalizePhone(row.phone);
        return storedPhone === normalizedPhone || storedPhone.replace(/\D/g, '') === phoneDigits;
    });

    if(emailExists){
        return res.status(409).json({message:"The email is already registered"});
    }
    if(phoneExists){
         return res.status(409).json({message:"The phone number is already registered"});
    }

    const hashpass=await hashPassword(password);
    const addUser=await db.query(
        "INSERT INTO users(name,password,email,phone,role) values($1,$2,$3,$4,$5) RETURNING id,name,email,phone,role",
        [name,hashpass, normalizedEmail, normalizedPhone, "user"]
    );

    // Make sure wallet exists for every registered user.
    await create_wallet(addUser.rows[0].id);

    return res.status(201).json({
        message:"User registered successfully",
        user:addUser.rows[0],
    });
    }
    catch(err){
        return res.status(500).json({ message: "Internal server error" });
    }
}
export default registeration;