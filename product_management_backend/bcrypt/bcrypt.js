import bcrypt from "bcrypt";
const saltRounds = 10;
const plainPassword = 'user_password_123';

export async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Hashed Password:', hash);
    return hash;
  } catch (err) {
    console.error('Error hashing password:', err);
    throw err;
  }
}

export async function matchPassword(password,storedpass){
    try{
        const match = await bcrypt.compare(password, storedpass);
    if (match) {
      return(true);
    } else {
      return(false);
    }

    }catch(err){
        throw err;
    }
}