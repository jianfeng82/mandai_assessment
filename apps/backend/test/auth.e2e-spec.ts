import request from 'supertest';

describe('Auth Module E2E (Authentication, JWT Lifecycle & Registration)', () => {
  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  const testEmail = `auth_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let jwtToken: string;

  it('should register a new user account', async () => {
    const res = await request(appUrl)
      .post('/auth/register')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
  });

  it('should reject registration with duplicate email with 409 Conflict', async () => {
    const res = await request(appUrl)
      .post('/auth/register')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(409);
  });

  it('should log in with valid credentials and return JWT token', async () => {
    const res = await request(appUrl)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    jwtToken = res.body.access_token;
  });

  it('should reject login with wrong password with 401 Unauthorized', async () => {
    const res = await request(appUrl)
      .post('/auth/login')
      .send({ email: testEmail, password: 'WrongPassword999!' });

    expect(res.status).toBe(401);
  });

  it('should get current user profile with valid Bearer token', async () => {
    const res = await request(appUrl)
      .get('/auth/me')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
    expect(res.body.role).toBe('CUSTOMER');
  });

  it('should reject get profile without Bearer token with 401 Unauthorized', async () => {
    const res = await request(appUrl).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
