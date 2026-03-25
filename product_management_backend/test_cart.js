import { spawn } from 'child_process';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

let serverProcess;
let authToken = '';
let userId = '';

const startServer = () => {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: 'inherit' });
    serverProcess.on('error', reject);
    setTimeout(resolve, 2000);
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
    if (authToken) {
      options.headers = { ...options.headers, 'Authorization': `Bearer ${authToken}` };
    }
    const response = await fetch(`${BASE_URL}${url}`, options);
    if (response.status === expectedStatus) {
      console.log(`✅ ${description}: ${response.status}`);
      return await response.json();
    } else {
      console.log(`❌ ${description}: Expected ${expectedStatus}, got ${response.status}`);
      const data = await response.json();
      console.log('   Response:', data);
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

    // Register user
    const registerResult = await testEndpoint('POST', '/register', {
      name: 'cartuser',
      password: 'testpass123',
      email: 'cartuser@test.com',
      phone: '9876543210'
    }, 201, '✓ Register User');

    // Login to get token
    const loginResult = await testEndpoint('POST', '/login', {
      email: 'cartuser@test.com',
      password: 'testpass123'
    }, 200, '✓ Login User');

    if (loginResult && loginResult.token) {
      authToken = loginResult.token;
      console.log('   Token obtained:', authToken.substring(0, 20) + '...');
    }

    // Create a test product
    const createResult = await testEndpoint('POST', '/', {
      name: 'test-product',
      price: 29.99,
      category: 'electronics',
      quantity: 50
    }, 201, '✓ Create Product');

    let productId = null;
    if (createResult && createResult.id) {
      productId = createResult.id;
      console.log('   Product ID:', productId);
    } else {
      console.log('   Assuming product name as ID for cart operations');
      productId = 1;
    }

    console.log('\n🛒 Testing Cart Operations...\n');

    // Add product to cart
    await testEndpoint('POST', '/addProductInCart', {
      product_id: productId,
      quantity: 2
    }, 200, '✓ Add Product to Cart');

    // Get cart info
    const cartResult = await testEndpoint('GET', '/cartInfo', null, 200, '✓ Get Cart Info');
    if (cartResult) {
      console.log('   Cart items:', cartResult.data?.length || 0);
    }

    // Update cart (increase quantity)
    await testEndpoint('POST', '/updateCart', {
      product_id: productId,
      operation: 'add'
    }, 200, '✓ Increase Cart Item Quantity');

    // Update cart (decrease quantity)
    await testEndpoint('POST', '/updateCart', {
      product_id: productId,
      operation: 'subtract'
    }, 200, '✓ Decrease Cart Item Quantity');

    // Add another product to test multiple items
    const product2 = await testEndpoint('POST', '/', {
      name: 'another-product',
      price: 49.99,
      category: 'books',
      quantity: 20
    }, 201, '✓ Create Second Product');

    const productId2 = product2?.id || 2;
    
    await testEndpoint('POST', '/addProductInCart', {
      product_id: productId2,
      quantity: 1
    }, 200, '✓ Add Second Product to Cart');

    // Get cart info again
    const cartResult2 = await testEndpoint('GET', '/cartInfo', null, 200, '✓ Get Updated Cart Info');
    if (cartResult2) {
      console.log('   Total items in cart:', cartResult2.data?.length || 0);
    }

    // Delete product from cart
    await testEndpoint('POST', '/deleteProductFromCart', {
      product_id: productId2
    }, 200, '✓ Remove Product from Cart');

    // Final cart check
    const finalCart = await testEndpoint('GET', '/cartInfo', null, 200, '✓ Final Cart Check');
    if (finalCart) {
      console.log('   Items remaining:', finalCart.data?.length || 0);
    }

    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    stopServer();
  }
};

runTests();
