import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

describe('SEO and health (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant } = await createTestRestaurant(prisma, 'seo');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('reports healthy when the database answers', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('keeps admin out of robots.txt and points at the sitemap', async () => {
    const res = await request(app.getHttpServer()).get('/robots.txt');
    expect(res.text).toContain('Disallow: /admin');
    expect(res.text).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  it('lists each menu in the sitemap', async () => {
    const res = await request(app.getHttpServer()).get('/sitemap.xml');
    expect(res.text).toContain(`/m/${slug}</loc>`);
  });

  it('adds canonical, Open Graph and Restaurant JSON-LD to the menu page', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).toContain(`rel="canonical" href="http`);
    expect(res.text).toContain('property="og:title"');
    expect(res.text).toContain('"@type":"Restaurant"');
  });
});
