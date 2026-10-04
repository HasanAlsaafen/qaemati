import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
  TEST_ADMIN_PASSWORD,
} from './utils/test-app';

describe('Admin auth (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let adminEmail: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'auth');
    restaurantId = restaurant.id;
    adminEmail = admin.email;
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('redirects to login when visiting /admin unauthenticated', async () => {
    const res = await request(app.getHttpServer()).get('/admin');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/admin/login');
  });

  it('rejects a POST with no CSRF token', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/login')
      .type('form')
      .send({ email: adminEmail, password: TEST_ADMIN_PASSWORD });
    expect(res.status).toBe(403);
  });

  it('rejects the wrong password with a bilingual error, not a crash', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginPage = await agent.get('/admin/login');
    const token = /name="csrf_token" value="([^"]*)"/.exec(loginPage.text)?.[1];

    const res = await agent.post('/admin/login').type('form').send({
      csrf_token: token,
      email: adminEmail,
      password: 'wrong-password',
      redirect: '/admin',
    });

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/incorrect|غير صحيح/i);
  });

  it('rejects the wrong password under the Arabic locale without crashing', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginPage = await agent.get('/admin/login?lang=ar');
    const token = /name="csrf_token" value="([^"]*)"/.exec(loginPage.text)?.[1];

    const res = await agent.post('/admin/login?lang=ar').type('form').send({
      csrf_token: token,
      email: adminEmail,
      password: 'wrong-password',
      redirect: '/admin',
    });

    expect(res.status).toBe(200);
    expect(res.text).toContain('غير صحيح');
  });

  it('logs in with correct credentials and can reach /admin', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const res = await agent.get('/admin');
    expect(res.status).toBe(200);
  });

  it('logs out and can no longer reach /admin', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    await agent.get('/admin').expect(200);

    const logoutPage = await agent.get('/admin');
    const token = /name="csrf_token" value="([^"]*)"/.exec(logoutPage.text)?.[1];
    await agent.post('/admin/logout').type('form').send({ csrf_token: token }).expect(302);

    const res = await agent.get('/admin');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/admin/login');
  });
});
