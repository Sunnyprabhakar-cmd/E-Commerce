import dotenv from "dotenv";
dotenv.config();

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
const explicitSsl = ['true', '1', 'yes'].includes(String(process.env.PG_SSL).toLowerCase());
const connectionStringRequiresSsl = typeof connectionString === 'string' && /sslmode=require/i.test(connectionString);

const isValidConnectionString = (conn) => {
  if (!conn || typeof conn !== 'string') return false;
  try {
    const url = new URL(conn);
    const password = url.password || '';
    if (!password.trim()) return false;
    if (/your_password/i.test(password)) return false;
    return true;
  } catch {
    return false;
  }
};

const shouldUseSslForHost = (host) => {
  if (!host || typeof host !== 'string') return false;
  const normalizedHost = host.toLowerCase().trim();
  return !/^(localhost|127\.0\.0\.1|::1)$/.test(normalizedHost);
};

const dbConfig = isValidConnectionString(connectionString)
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
      ssl: explicitSsl || shouldUseSslForHost(process.env.PG_HOST)
        ? { rejectUnauthorized: false }
        : false,
    };

if (!isValidConnectionString(connectionString) && connectionString) {
  console.warn('DATABASE_URL is present but appears invalid. Falling back to explicit PG_* environment variables.');
}

const db = new pg.Pool(dbConfig);

db.query('SELECT 1')
  .then(() => console.log('db connected'))
  .catch((err) => console.log('error occured', err));

db.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

export default db;