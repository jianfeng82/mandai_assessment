import request from 'supertest';

describe('E2E Integration Test: Customer & Admin Full E-Commerce Workflows', () => {
  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  let customerToken: string;
  let adminToken: string;
  let createdProductId: string;

  beforeAll(async () => {
    // 1. Register dedicated E2E Customer to avoid mutex lock collision
    const testCustEmail = `e2e_customer_${Date.now()}@example.com`;
    const custRes = await request(appUrl)
      .post('/auth/register')
      .send({ email: testCustEmail, password: 'CustomerPass123!' });
    expect(custRes.status).toBe(201);
    customerToken = custRes.body.access_token;

    // 2. Authenticate Admin
    const adminRes = await request(appUrl)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPass123!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.access_token;
  });

  describe('Customer Storefront Journey', () => {
    it('should fetch public products catalog', async () => {
      const res = await request(appUrl).get('/products');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should successfully buy an in-stock product', async () => {
      const catalogRes = await request(appUrl).get('/products');
      const inStockProduct = catalogRes.body.find((p: any) => p.stock > 0);
      expect(inStockProduct).toBeDefined();

      const buyRes = await request(appUrl)
        .post('/orders/buy')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: inStockProduct.id, quantity: 1 });

      expect(buyRes.status).toBe(201);
      expect(buyRes.body.status).toBe('PAID');
      expect(buyRes.body.item.product_id).toBe(inStockProduct.id);
    });

    it('should retrieve customer personal order history', async () => {
      const res = await request(appUrl)
        .get('/orders/my-orders')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('Admin Operations & Inventory Journey', () => {
    it('should create a new catalog product', async () => {
      const res = await request(appUrl)
        .post('/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'E2E Test Widget ' + Date.now(),
          description: 'Created via automated E2E integration test',
          price_cents: 3999,
          stock: 15,
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      createdProductId = res.body.id;
    });

    it('should restock product inventory and record audit reason', async () => {
      const res = await request(appUrl)
        .post(`/admin/products/${createdProductId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 10, reason: 'E2E_SHIPMENT_RESTOCK' });

      expect([200, 201]).toContain(res.status);
      expect(res.body.stock).toBe(25);
    });

    it('should retrieve immutable inventory audit logs', async () => {
      const res = await request(appUrl)
        .get(`/admin/inventory/logs?productId=${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].product_id).toBe(createdProductId);
      expect(res.body[0].change_amount).toBeDefined();
    });
  });
});
