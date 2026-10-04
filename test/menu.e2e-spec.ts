import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

describe('Public menu (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant } = await createTestRestaurant(prisma, 'menu');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('renders the menu for a known slug', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Test Restaurant');
  });

  it('renders the Arabic name under the Arabic locale', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=ar`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('مطعم تجريبي');
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await request(app.getHttpServer()).get('/m/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('shows the table indicator when ?table= is present', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?table=7&lang=en`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Table 7');
  });
});
