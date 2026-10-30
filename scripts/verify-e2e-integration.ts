import fs from 'node:fs';

function loadEnv() {
  try {
    const raw = fs.readFileSync('.env', 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = (match[2] || '').trim();
      }
    }
  } catch {}
}
loadEnv();

interface BenchmarkRecord {
  feature: string;
  method: string;
  endpoint: string;
  status: number;
  expectedStatus: number;
  durationMs: number;
  payloadSizeBytes: number;
  result: 'PASS' | 'FAIL';
  notes?: string;
}

const records: BenchmarkRecord[] = [];
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.106:5000/api/v1').replace(/\/+$/, '');

async function recordCall(
  feature: string,
  method: string,
  endpoint: string,
  expectedStatus: number,
  options: { token?: string; body?: any; headers?: Record<string, string> } = {}
): Promise<{ status: number; data: any; raw: Response }> {
  const url = `${BASE_URL}/${endpoint.replace(/^\/+/, '')}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let bodyStr: string | undefined;
  if (options.body) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(options.body);
  }

  const start = performance.now();
  let status = 0;
  let payloadSizeBytes = 0;
  let data: any = null;
  let raw: Response;

  try {
    raw = await fetch(url, {
      method,
      headers,
      body: bodyStr,
    });
    status = raw.status;
    const contentType = raw.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await raw.json();
      payloadSizeBytes = JSON.stringify(data).length;
    } else {
      const buf = await raw.arrayBuffer();
      payloadSizeBytes = buf.byteLength;
      data = { bytes: payloadSizeBytes };
    }
  } catch (err: any) {
    status = 0;
    data = { error: err.message };
    raw = new Response(null, { status: 0 });
  }
  const durationMs = Math.round(performance.now() - start);
  const isPass = status === expectedStatus;

  records.push({
    feature,
    method,
    endpoint,
    status,
    expectedStatus,
    durationMs,
    payloadSizeBytes,
    result: isPass ? 'PASS' : 'FAIL',
    notes: isPass ? undefined : JSON.stringify(data),
  });

  return { status, data, raw };
}

async function runFullAudit() {
  console.log(`========================================================================`);
  console.log(`FEMMEFLO LOCAL INTEGRATION & PERFORMANCE VERIFICATION SUITE`);
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log(`========================================================================\n`);

  // 1. Health & Readiness
  await recordCall('System Health', 'GET', 'health', 200);
  await recordCall('Database Readiness', 'GET', 'ready', 200);

  // 2. Authentication Testing
  await recordCall('Auth Login - Invalid Credentials', 'POST', 'auth/login', 401, {
    body: { login: 'nonexistent@femmeflo.in', password: 'wrongpassword' },
  });
  await recordCall('Auth Login - Missing Fields', 'POST', 'auth/login', 400, {
    body: {},
  });

  // Admin Login
  const adminLogin = await recordCall('Super Admin Login', 'POST', 'auth/login', 200, {
    body: { login: 'admin@femmeflo.in', password: 'demo123' },
  });
  const adminToken = adminLogin.data?.data?.token;

  // Manager Login
  const mgrLogin = await recordCall('Manager Login', 'POST', 'auth/login', 200, {
    body: { login: 'manager@femmeflo.com', password: 'demo123' },
  });
  const mgrToken = mgrLogin.data?.data?.token;

  // Seller Login
  const sellerLogin = await recordCall('Seller Login', 'POST', 'auth/login', 200, {
    body: { login: 'seller@femmeflo.com', password: 'demo123' },
  });
  const sellerToken = sellerLogin.data?.data?.token;

  // 3. User Profile Verification
  await recordCall('Current User (Admin)', 'GET', 'auth/me', 200, { token: adminToken });
  await recordCall('Current User (Manager)', 'GET', 'auth/me', 200, { token: mgrToken });
  await recordCall('Current User (Seller)', 'GET', 'auth/me', 200, { token: sellerToken });

  // 4. Product Catalog & Categories
  const catRes = await recordCall('Category Master List', 'GET', 'categories', 200, { token: sellerToken });
  const prodRes = await recordCall('Product Catalog (Seller)', 'GET', 'seller/products', 200, { token: sellerToken });

  // 5. Seller Operations
  await recordCall('Seller Dashboard', 'GET', 'seller/dashboard', 200, { token: sellerToken });
  await recordCall('Seller Inventory', 'GET', 'seller/inventory', 200, { token: sellerToken });
  const custRes = await recordCall('Seller Customers List', 'GET', 'seller/customers', 200, { token: sellerToken });

  const categoryId = catRes.data?.data?.items?.[0]?.id || '4b9121d5-bcda-4bc5-a13a-a1da15f33669';
  const customerId = custRes.data?.data?.items?.[0]?.id;
  const product = prodRes.data?.data?.items?.[0];

  // Customer Onboarding
  const newPhone = '+9199' + Math.floor(10000000 + Math.random() * 90000000);
  await recordCall('Seller Onboard Customer', 'POST', 'seller/customers', 201, {
    token: sellerToken,
    body: {
      shopName: 'Kailash Medical',
      contactName: 'Kailash Mehra',
      phone: newPhone,
      email: 'kailash' + Math.floor(Math.random() * 1000) + '@example.com',
      categoryId,
      address: 'Main Chowk, Diva West',
      pincode: '400612',
      state: 'Maharashtra',
      district: 'Thane',
      village: 'Diva',
      latitude: 19.1895,
      longitude: 73.0442,
    },
  });

  // Shift Operations
  await recordCall('Seller Start Shift', 'POST', 'seller/shifts/start', 201, {
    token: sellerToken,
    body: { latitude: 19.1895, longitude: 73.0442, address: 'Diva Hub' },
  });
  await recordCall('Seller Current Shift', 'GET', 'seller/shifts/current', 200, { token: sellerToken });
  const checkInRes = await recordCall('Seller Customer Check-In', 'POST', 'seller/shifts/check-in', 201, {
    token: sellerToken,
    body: { latitude: 19.1895, longitude: 73.0442, shopName: 'Kailash Medical', customerId },
  });
  const visitId = checkInRes.data?.data?.visit?.id;
  if (visitId) {
    await recordCall('Seller Customer Check-Out', 'POST', 'seller/shifts/check-out', 200, {
      token: sellerToken,
      body: { visitId, latitude: 19.1895, longitude: 73.0442, notes: 'Visit completed' },
    });
  }
  await recordCall('Seller End Shift', 'POST', 'seller/shifts/end', 200, {
    token: sellerToken,
    body: { latitude: 19.19, longitude: 73.045, address: 'Diva Depot' },
  });

  // POS Sale Recording
  if (customerId && product) {
    const saleRes = await recordCall('Seller Create POS Sale', 'POST', 'seller/sales', 201, {
      token: sellerToken,
      body: {
        customerId,
        paymentMode: 'CASH',
        items: [{ productId: product.id, quantity: 1, unitPricePaise: product.basePricePaise }],
      },
    });
    const saleId = saleRes.data?.data?.sale?.id;
    const invoiceId = saleRes.data?.data?.sale?.invoice?.id;

    if (saleId) {
      await recordCall('Seller Sale Details', 'GET', `seller/sales/${saleId}`, 200, { token: sellerToken });
    }
    if (invoiceId) {
      await recordCall('Tax Invoice PDF Binary Stream', 'GET', `invoices/${invoiceId}/pdf`, 200, {
        token: sellerToken,
      });
    }
  }

  await recordCall('Seller Sales History', 'GET', 'seller/sales', 200, { token: sellerToken });

  // 6. Manager Operations
  await recordCall('Manager Dashboard', 'GET', 'manager/dashboard', 200, { token: mgrToken });
  await recordCall('Manager Supervised Sellers', 'GET', 'manager/sellers', 200, { token: mgrToken });
  await recordCall('Manager Territory Customers', 'GET', 'manager/customers', 200, { token: mgrToken });
  await recordCall('Manager Territory Sales', 'GET', 'manager/sales', 200, { token: mgrToken });
  await recordCall('Manager Products Catalog', 'GET', 'manager/products', 200, { token: mgrToken });

  // 7. Super Admin Operations
  await recordCall('Super Admin Dashboard', 'GET', 'admin/dashboard', 200, { token: adminToken });
  await recordCall('Super Admin Managers List', 'GET', 'admin/managers', 200, { token: adminToken });
  await recordCall('Super Admin Sellers List', 'GET', 'admin/sellers', 200, { token: adminToken });
  await recordCall('Super Admin Customers List', 'GET', 'admin/customers', 200, { token: adminToken });
  await recordCall('Super Admin Approvals Queue', 'GET', 'admin/approvals', 200, { token: adminToken });
  await recordCall('Super Admin Business Settings', 'GET', 'admin/incentives/settings', 200, { token: adminToken });
  await recordCall('Super Admin Products Catalog', 'GET', 'admin/products', 200, { token: adminToken });

  console.log('\n--- VERIFICATION RESULTS TABLE ---');
  console.log('| Feature | Method | Endpoint | HTTP Status | Duration | Size | Result |');
  console.log('|---|:---:|---|:---:|:---:|:---:|:---:|');
  for (const r of records) {
    console.log(
      `| ${r.feature} | ${r.method} | \`/${r.endpoint}\` | ${r.status} | ${r.durationMs}ms | ${r.payloadSizeBytes} B | ${r.result === 'PASS' ? '✅ PASS' : '❌ FAIL'} |`
    );
  }

  const passed = records.filter((r) => r.result === 'PASS').length;
  const failed = records.filter((r) => r.result === 'FAIL').length;
  console.log(`\nTOTAL TESTS: ${records.length} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

runFullAudit().catch(console.error);
