import dotenv from "dotenv";
dotenv.config();

import pg from "pg";

const useSsl = process.env.PG_SSL === 'true';
const db = new pg.Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

db.connect()
  .then(() => console.log("db connected"))
  .catch(err => console.log("error occured", err));

export default db;