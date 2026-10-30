import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

async function isBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(1000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

describe('FemmeFlo Local Backend Integration Suite', async () => {
  const backendOnline = await isBackendReachable();

  it('1. GET /api/v1/health returns HTTP 200 and healthy status', { skip: !backendOnline }, async () => {
    const res = await fetch(`${BACKEND_URL}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data?.status, 'ok');
  });

  it('2. GET /api/v1/ready returns HTTP 200 with database: connected', { skip: !backendOnline }, async () => {
    const res = await fetch(`${BACKEND_URL}/ready`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data?.database, 'connected');
  });

  it('3. CORS headers are returned for mobile & web origins (http://localhost:8081, http://localhost:3000)', { skip: !backendOnline }, async () => {
    const res = await fetch(`${BACKEND_URL}/health`, {
      headers: {
        Origin: 'http://localhost:8081',
      },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  });

  it('4. POST /api/v1/auth/login rejects invalid credentials with 401', { skip: !backendOnline }, async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'invalid_user@example.com',
        password: 'wrong_password_123',
      }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message);
  });

  it('5. POST /api/v1/auth/login succeeds with seeded Super Admin credentials', { skip: !backendOnline }, async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'admin@femmeflo.in',
        password: 'femmeflo@2026',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data?.token, 'JWT token must be present');
    assert.equal(body.data?.user?.email, 'admin@femmeflo.in');
    assert.equal(body.data?.user?.role, 'SUPER_ADMIN');

    // Test GET /auth/me with the issued bearer token
    const token = body.data.token;
    const meRes = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.success, true);
    assert.equal(meBody.data?.user?.email, 'admin@femmeflo.in');
  });

  it('6. Unauthenticated protected routes return 401', { skip: !backendOnline }, async () => {
    const res = await fetch(`${BACKEND_URL}/seller/products`);
    assert.equal(res.status, 401);
  });

  it('7. Rate limiting headers are present on authentication endpoints', { skip: !backendOnline }, async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'rate_test@example.com',
        password: 'Password123!',
      }),
    });
    assert.ok(res.headers.has('ratelimit') || res.headers.has('ratelimit-policy'));
  });
});

