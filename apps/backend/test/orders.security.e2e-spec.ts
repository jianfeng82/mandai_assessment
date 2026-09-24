import request from 'supertest';

describe('OWASP Top 10 API Security & Concurrency Test Suite (Live API)', () => {
  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  let customerToken: string;
  let adminToken: string;
  let sharedInStockProductId: string;

  beforeAll(async () => {
    // Authenticate Customer
    const custRes = await request(appUrl)
      .post('/auth/login')
      .send({ email: 'customer@example.com', password: 'CustomerPass123!' });
    customerToken = custRes.body.access_token;

    // Authenticate Admin
    const adminRes = await request(appUrl)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPass123!' });
    adminToken = adminRes.body.access_token;

    // Create high-inventory test product for security suite
    const prodRes = await request(appUrl)
      .post('/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Security Test Item ' + Date.now(),
        description: 'High stock item for security suite',
        price_cents: 2500,
        stock: 500,
        is_active: true,
      });
    sharedInStockProductId = prodRes.body.id;
  });

  describe('OWASP API1: Broken Object Level Authorization (BOLA / IDOR)', () => {
    it('[API1 / BOLA] should scope customer order history strictly to authenticated user', async () => {
      const res = await request(appUrl)
        .get('/orders/my-orders')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const order of res.body) {
        expect(order.user_id).toBe('usr-cust-0000000000000000000000001');
      }
    });
  });

  describe('OWASP API2: Broken Authentication & Session Integrity', () => {
    it('[API2] should reject purchase request missing Authorization header with 401 Unauthorized', async () => {
      const res = await request(appUrl)
        .post('/orders/buy')
        .send({ productId: sharedInStockProductId, quantity: 1 });

      expect(res.status).toBe(401);
    });

    it('[API2] should reject request with forged / malformed JWT token with 401 Unauthorized', async () => {
      const res = await request(appUrl)
        .post('/orders/buy')
        .set('Authorization', 'Bearer forged_token_invalid_signature_12345')
        .send({ productId: sharedInStockProductId, quantity: 1 });

      expect(res.status).toBe(401);
    });
  });

  describe('OWASP API3: Input Validation, Injection & Boundary Testing', () => {
    it('[API3 / SQLi] should safely handle SQL injection payloads in catalog search without database error', async () => {
      const res = await request(appUrl)
        .get('/products')
        .query({ search: "' OR '1'='1' --" });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('[API3 / Boundary] should reject negative purchase quantity with 400 Bad Request', async () => {
      const res = await request(appUrl)
        .post('/orders/buy')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: sharedInStockProductId, quantity: -5 });

      expect(res.status).toBe(400);
    });

    it('[API3 / Boundary] should reject zero purchase quantity with 400 Bad Request', async () => {
      const res = await request(appUrl)
        .post('/orders/buy')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: sharedInStockProductId, quantity: 0 });

      expect(res.status).toBe(400);
    });

    it('[API3 / Boundary] should reject non-integer / string quantity with 400 Bad Request', async () => {
      const res = await request(appUrl)
        .post('/orders/buy')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: sharedInStockProductId, quantity: 'ten' });

      expect(res.status).toBe(400);
    });
  });

  describe('OWASP API4: TOCTOU & Concurrency / Race Condition Defense', () => {
    it('[API4 / Single-User Mutex] should serialize rapid multi-click submissions via Redis user lock', async () => {
      // Single customer rapidly sending 5 concurrent buy requests
      const rapidRequests = Array.from({ length: 5 }, (_, i) =>
        request(appUrl)
          .post('/orders/buy')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('Idempotency-Key', `owasp-single-user-race-${Date.now()}-${i}`)
          .send({ productId: sharedInStockProductId, quantity: 1 }),
      );

      const responses = await Promise.all(rapidRequests);
      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      // Mutex lock ensures at most 1 in-flight order per user at a time
      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
    });

    it('[API4 / Multi-User Concurrency] should atomically prevent overselling under parallel multi-buyer burst', async () => {
      // 1. Admin creates a flash sale product with strict stock = 2
      const createRes = await request(appUrl)
        .post('/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'OWASP Multi-User Flash Sale ' + Date.now(),
          description: 'Flash sale item with exactly 2 in stock',
          price_cents: 1500,
          stock: 2,
          is_active: true,
        });

      expect(createRes.status).toBe(201);
      const testProductId = createRes.body.id;

      // 2. Register 5 distinct customers
      const buyerTokens: string[] = [];
      for (let i = 0; i < 5; i++) {
        const regRes = await request(appUrl)
          .post('/auth/register')
          .send({
            email: `owasp_buyer_${Date.now()}_${i}@example.com`,
            password: 'BuyerPassword123!',
          });
        expect(regRes.status).toBe(201);
        buyerTokens.push(regRes.body.access_token);
      }

      // 3. Fire 5 simultaneous buy requests from the 5 different buyers (Demand = 5, Supply = 2)
      const concurrentRequests = buyerTokens.map((token, i) =>
        request(appUrl)
          .post('/orders/buy')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', `owasp-flash-sale-${Date.now()}-${i}`)
          .send({ productId: testProductId, quantity: 1 }),
      );

      const responses = await Promise.all(concurrentRequests);

      // 4. Exactly 2 must succeed (201), exactly 3 must fail (409 Conflict - Out of stock)
      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(successes.length).toBe(2);
      expect(conflicts.length).toBe(3);

      // 5. Verify remaining inventory in database is strictly 0 (Zero Overselling Guarantee)
      const finalProductRes = await request(appUrl).get(
        `/products/${testProductId}`,
      );
      expect(finalProductRes.status).toBe(200);
      expect(finalProductRes.body.stock).toBe(0);
    });
  });

  describe('OWASP API5: Broken Function Level Authorization (RBAC)', () => {
    it('[API5 / RBAC] should reject Customer attempting Admin product creation with 403 Forbidden', async () => {
      const res = await request(appUrl)
        .post('/admin/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Hacked Product',
          price_cents: 100,
          stock: 100,
        });

      expect(res.status).toBe(403);
    });

    it('[API5 / RBAC] should reject Customer attempting Admin stock adjustment with 403 Forbidden', async () => {
      const res = await request(appUrl)
        .post(`/admin/products/${sharedInStockProductId}/stock`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ amount: 50, reason: 'ILLEGAL_MANUAL_ADJUSTMENT' });

      expect(res.status).toBe(403);
    });

    it('[API5 / RBAC] should reject Customer attempting to view Admin inventory audit logs with 403 Forbidden', async () => {
      const res = await request(appUrl)
        .get('/admin/inventory/logs')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('OWASP API6: Business Logic Integrity & Replay Attacks', () => {
    it('[API6 / Idempotency] should return cached response and prevent double stock deduction on network replay', async () => {
      const uniqueKey = 'owasp-idem-key-' + Date.now();

      // First Request
      const firstRes = await request(appUrl)
        .post('/orders/buy')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uniqueKey)
        .send({ productId: sharedInStockProductId, quantity: 1 });

      expect(firstRes.status).toBe(201);
      const firstOrderId = firstRes.body.id;

      // Replay Request with identical Idempotency-Key
      const replayRes = await request(appUrl)
        .post('/orders/buy')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uniqueKey)
        .send({ productId: sharedInStockProductId, quantity: 1 });

      expect(replayRes.status).toBe(201);
      expect(replayRes.body.id).toBe(firstOrderId);
      expect(replayRes.body.is_idempotent_replay).toBe(true);
    });
  });

  describe('OWASP API7: Security Misconfiguration', () => {
    it('[API7 / Headers] should enforce Helmet secure HTTP headers against sniffing & clickjacking', async () => {
      const res = await request(appUrl).get('/products');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('OWASP API8: Mass Assignment & Strict Whitelisting', () => {
    it('[API8 / Whitelist] should reject unwhitelisted / malicious payload properties with 400 Bad Request', async () => {
      const res = await request(appUrl)
        .post('/orders/buy')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId: sharedInStockProductId,
          quantity: 1,
          malicious_role_injection: 'admin',
          override_price: 0,
        });

      expect(res.status).toBe(400);
    });
  });
});
