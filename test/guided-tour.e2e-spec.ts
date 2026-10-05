import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('Guided tour (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let adminId: string;
  let adminEmail: string;

  async function csrfToken(agent: ReturnType<typeof request.agent>): Promise<string> {
    const res = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'tour');
    restaurantId = restaurant.id;
    adminId = admin.id;
    adminEmail = admin.email;
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('shows the tour on a fresh admin login', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const res = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    expect(res.text).toContain('Welcome to your menu');
  });

  it('marks the tour dismissed in the database and stops showing it', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const token = await csrfToken(agent);

    const dismissRes = await agent
      .post('/admin/tour/dismiss')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en');
    expect(dismissRes.status).toBe(204);

    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
    expect(admin?.hasSeenTour).toBe(true);

    // Same session, no new login: the dashboard must not show the tour
    // again without a fresh page load even having to re-check the DB.
    const dashboardRes = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    expect(dashboardRes.text).not.toContain('Welcome to your menu');
  });

  it('does not show the tour again on a subsequent fresh login', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const res = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    expect(res.text).not.toContain('Welcome to your menu');
  });
});
