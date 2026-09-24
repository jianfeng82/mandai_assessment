import request from 'supertest';

describe('Products Module E2E (Storefront Catalog & Admin Inventory Management)', () => {
  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  let adminToken: string;
  let createdProductId: string;

  beforeAll(async () => {
    const adminRes = await request(appUrl)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPass123!' });
    adminToken = adminRes.body.access_token;
  });

  describe('Storefront Public Browsing', () => {
    it('should list all active products', async () => {
      const res = await request(appUrl).get('/products');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should filter products by search term', async () => {
      const res = await request(appUrl)
        .get('/products')
        .query({ search: 'Headphones' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const p of res.body) {
        expect(p.title.toLowerCase() + p.description.toLowerCase()).toContain(
          'headphone',
        );
      }
    });

    it('should retrieve a single product by ID', async () => {
      const res = await request(appUrl).get(
        '/products/prod-headphone-anc-0000000000002',
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('prod-headphone-anc-0000000000002');
      expect(res.body.title).toContain('Studio Pro');
    });

    it('should return 404 for non-existent product ID', async () => {
      const res = await request(appUrl).get(
        '/products/non-existent-uuid-99999',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Admin Product Lifecycle Management', () => {
    it('should allow admin to create a new product', async () => {
      const res = await request(appUrl)
        .post('/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Product E2E Test Item ' + Date.now(),
          description: 'Created for testing product catalog lifecycle',
          price_cents: 4999,
          stock: 20,
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      createdProductId = res.body.id;
    });

    it('should allow admin to update product details', async () => {
      const res = await request(appUrl)
        .patch(`/admin/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Product E2E Title',
          price_cents: 5999,
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Product E2E Title');
      expect(res.body.price_cents).toBe(5999);
    });

    it('should allow admin to soft delete a product', async () => {
      const res = await request(appUrl)
        .delete(`/admin/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify product is now deactivated in public storefront
      const publicRes = await request(appUrl).get('/products');
      const foundInPublic = publicRes.body.find(
        (p: any) => p.id === createdProductId,
      );
      expect(foundInPublic).toBeUndefined();
    });
  });
});
