import { spawn } from 'node:child_process';
import fetch from 'node-fetch';
import db from './database/database.js';

const BASE_URL = 'http://localhost:3000';
const wait = ms => new Promise(r => setTimeout(r, ms));

const serverProcess = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: 'inherit' });

const ensure = async () => {
  await wait(1800);
};

try {
  await ensure();

  // 1) Register admin and promote to admin via DB
  await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'admin', password: 'adminpass', email: 'admin@local.test', phone: '9000000000' })
  });

  // promote to admin (before login so token contains admin role)
  await db.query('UPDATE users SET role=$1 WHERE email=$2', ['admin', 'admin@local.test']);
  const loginAdmin = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@local.test', password: 'adminpass' })
  });
  const adminData = await loginAdmin.json();
  const adminToken = adminData.token;

  // 2) Create two products directly in the database (API create has stricter admin checks)
  await db.query("INSERT INTO products(id,name,price,category,piece,availability) VALUES (1,'prod-1',10.5,'cat',20,TRUE) ON CONFLICT (id) DO NOTHING");
  await db.query("INSERT INTO products(id,name,price,category,piece,availability) VALUES (2,'prod-2',25,'cat',10,TRUE) ON CONFLICT (id) DO NOTHING");
  const p1 = { id: 1, name: 'prod-1', price: 10.5 };
  const p2 = { id: 2, name: 'prod-2', price: 25 };

  // 3) Register customer
  await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'cust', password: 'custpass', email: 'cust@test.com', phone: '9111111111' })
  });

  const loginCust = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cust@test.com', password: 'custpass' })
  });
  const custData = await loginCust.json();
  const custToken = custData.token;

  // 4) Add both products to cart for customer
  const add1 = await fetch(`${BASE_URL}/addProductInCart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ product_id: p1.id || p1?.id || p1?.product_id || 1, quantity: 1 })
  });
  console.log('ADD1 STATUS:', add1.status);

  const add2 = await fetch(`${BASE_URL}/addProductInCart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ product_id: p2.id || p2?.id || 2, quantity: 2 })
  });
  console.log('ADD2 STATUS:', add2.status);

  // 5) Get cart and place grouped orders
  // read cart directly from DB to avoid cart endpoint type mismatches
  const userRow = await db.query('SELECT id FROM users WHERE email=$1 LIMIT 1', ['cust@test.com']);
  const custId = userRow.rows?.[0]?.id;
  const cartRows = await db.query('SELECT product_id,quantity FROM cart_items WHERE user_id=$1', [custId]);
  const items = cartRows.rows || [];
  console.log('CART ITEMS (db):', items.length, items);

  const groupId = 'group-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const placed = [];
  for (const it of items) {
    const prodRow = await db.query('SELECT price FROM products WHERE id=$1 LIMIT 1', [String(it.product_id)]);
    const price = Number(prodRow.rows?.[0]?.price || 0);
    const place = await fetch(`${BASE_URL}/placeOrder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: JSON.stringify({ product_id: String(it.product_id), quantity: it.quantity || 1, product_price: price, order_group_id: groupId, is_paid: false })
    });
    const pres = await place.json();
    placed.push(pres);
    console.log('PLACED', pres);
  }

  // 6) Admin collects payment for group
  const total = placed.reduce((s, p) => {
    const ord = p?.order || {};
    return s + Number(ord.product_price || 0) * Number(ord.quantity || 0);
  }, 0);
  console.log('GROUP ID:', groupId, 'TOTAL:', total);

  const collect = await fetch(`${BASE_URL}/admin/orderAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ order_id: groupId, action: 'collect_payment', amount_received: total })
  });
  const collectJson = await collect.json();
  console.log('COLLECT PAYMENT RESPONSE:', collectJson);

  // 7) Fetch admin orders
  const adminOrders = await fetch(`${BASE_URL}/orders`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const adminJson = await adminOrders.json();
  console.log('ADMIN ORDERS COUNT:', adminJson.length || adminJson?.orders?.length || Object.keys(adminJson || {}).length);

} catch (err) {
  console.error('FLOW_ERROR', err.message || err);
} finally {
  await db.end();
  serverProcess.kill('SIGTERM');
}
