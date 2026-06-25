import dotenv from "dotenv";
dotenv.config();

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
const explicitSsl = ['true', '1', 'yes'].includes(String(process.env.PG_SSL).toLowerCase());
const connectionStringRequiresSsl = typeof connectionString === 'string' && /sslmode=require/i.test(connectionString);

const dbConfig = connectionString
  ? {
      connectionString,
      ssl: explicitSsl || connectionStringRequiresSsl ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      ssl: explicitSsl ? { rejectUnauthorized: false } : false,
    };

const db = new pg.Client(dbConfig);

db.connect()
  .then(() => console.log("db connected"))
  .catch(err => console.log("error occured", err));

export default db;