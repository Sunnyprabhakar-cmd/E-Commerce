import { spawn } from 'node:child_process';
import db from './database/database.js';

const BASE_URL = 'http://localhost:3000';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const serverProcess = spawn('node', ['server.js'], {
  cwd: process.cwd(),
  stdio: 'inherit'
});

try {
  await wait(1800);

  const products = await db.query('SELECT id,price FROM products ORDER BY created_at DESC LIMIT 1');
  const product = products.rows?.[0];

  if (!product?.id) {
    console.log('No product found in database');
    process.exit(1);
  }

  const loginRes = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'cartuser@test.com',
      password: 'testpass123'
    })
  });
  const loginData = await loginRes.json();

  if (!loginData?.token) {
    console.log('LOGIN_FAIL', loginData);
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loginData.token}`
  };

  const placeRes = await fetch(`${BASE_URL}/placeOrder`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      product_id: product.id,
      quantity: 1,
      product_price: Number(product.price || 0)
    })
  });
  const placeData = await placeRes.json();
  console.log('PLACE_ORDER', placeRes.status, placeData);

  const detailRes = await fetch(`${BASE_URL}/orderDetail`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${loginData.token}` }
  });
  const detailData = await detailRes.json();
  console.log(
    'ORDER_DETAIL',
    detailRes.status,
    'count=',
    Array.isArray(detailData?.orders) ? detailData.orders.length : 'n/a'
  );

  const cancelRes = await fetch(`${BASE_URL}/cancelOrder`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ product_id: product.id })
  });
  const cancelData = await cancelRes.json();
  console.log('CANCEL_ORDER', cancelRes.status, cancelData);
} catch (error) {
  console.error('ORDER_SMOKE_ERROR', error.message);
} finally {
  await db.end();
  serverProcess.kill('SIGTERM');
}
