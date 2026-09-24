import request from 'supertest';

describe('Auth Module OWASP Top 10 Security E2E (Live API)', () => {
  const appUrl = process.env.APP_URL || 'http://localhost:4000';

  describe('OWASP API2: Broken Authentication & Token Forgery', () => {
    it('[API2] should reject forged signature JWT tokens with 401 Unauthorized', async () => {
      const forgedToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImFkbWluIn0.forged_signature';
      const res = await request(appUrl)
        .get('/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
    });

    it('[API2] should reject invalid credentials without revealing user existence (timing/user enum defense)', async () => {
      const res = await request(appUrl).post('/auth/login').send({
        email: 'non_existent_user_99999@example.com',
        password: 'AnyPassword123!',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('OWASP API3: SQL Injection Defense on Authentication', () => {
    it('[API3 / SQLi] should safely reject SQL injection login payloads without database syntax error', async () => {
      const res = await request(appUrl)
        .post('/auth/login')
        .send({ email: "' OR '1'='1' --", password: 'random_password' });

      // Should be rejected by validation (invalid email format) or authentication (401)
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('OWASP API8: Mass Assignment & Privilege Escalation Defense', () => {
    it('[API8 / Escalation] should prevent privilege escalation by rejecting or ignoring role in registration', async () => {
      const testEmail = `hacker_attempt_${Date.now()}@example.com`;
      const res = await request(appUrl).post('/auth/register').send({
        email: testEmail,
        password: 'Password123!',
        role: 'ADMIN', // Malicious attempt to self-promote to ADMIN
      });

      // Either rejected by validation whitelist or account registered strictly as CUSTOMER
      if (res.status === 201) {
        expect(res.body.user.role).not.toBe('ADMIN');
      } else {
        expect(res.status).toBe(400);
      }
    });
  });
});
