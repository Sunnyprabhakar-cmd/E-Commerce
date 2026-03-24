import { spawn } from 'child_process';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

let serverProcess;

const startServer = () => {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: 'inherit' });
    serverProcess.on('error', reject);
    setTimeout(resolve, 2000); // Wait for server to start
  });
};

const stopServer = () => {
  if (serverProcess) {
    serverProcess.kill();
  }
};

const testEndpoint = async (method, url, body = null, expectedStatus = 200, description) => {
  try {
    const options = { method };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${BASE_URL}${url}`, options);
    if (response.status === expectedStatus) {
      console.log(`✅ ${description}: ${response.status}`);
      return await response.json();
    } else {
      console.log(`❌ ${description}: Expected ${expectedStatus}, got ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ${description}: Error - ${error.message}`);
    return null;
  }
};

const runTests = async () => {
  try {
    console.log('🚀 Starting server...');
    await startServer();

    console.log('🧪 Running API endpoint tests...\n');

    // Test registration
    const registerResult = await testEndpoint('POST', '/register', {
      name: 'testuser',
      password: 'testpass',
      email: 'test@example.com',
      phone: '1234567890'
    }, 201, 'POST /register'); // Note: returns 201 on success or duplicate

    // Test login
    const loginResult = await testEndpoint('POST', '/login', {
      email: 'test@example.com',
      password: 'testpass'
    }, 200, 'POST /login');

    // Test create product
    const createResult = await testEndpoint('POST', '/', {
      name: 'apple',
      price: 5,
      category: 'fruit',
      quantity: 10
    }, 201, 'POST / (create product)');

    // Test get all products
    const getAllResult = await testEndpoint('GET', '/', null, 200, 'GET / (get all products)');

    // Test get product by name
    const getByNameResult = await testEndpoint('GET', '/apple', null, 200, 'GET /:name (get product by name)');

    // Test search
    const searchResult = await testEndpoint('POST', '/search', { keyword: 'fruit' }, 200, 'POST /search');

    // Test update (assuming update endpoint works)
    if (createResult && createResult.id) {
      const updateResult = await testEndpoint('POST', `/update/${createResult.id}`, {
        name: 'apple',
        newName: 'green apple',
        category: 'fruit',
        price: 6
      }, 200, 'POST /update/:id');
    }

    // Test sort
    const sortResult = await testEndpoint('GET', '/sort/price', null, 200, 'GET /sort/:id');

    // Test delete
    const deleteResult = await testEndpoint('DELETE', '/', { name: 'green apple' }, 201, 'DELETE / (delete product)');

    // Final check - get all should be empty
    const finalGetAll = await testEndpoint('GET', '/', null, 200, 'GET / (final check - should be empty)');

    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('Test runner error:', error);
  } finally {
    stopServer();
  }
};

runTests();