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
    expect(res.text).toContain('Disallow: /super');
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

  it('gives the home page a canonical url and Open Graph title', async () => {
    const res = await request(app.getHttpServer()).get('/?lang=en');
    expect(res.text).toMatch(/rel="canonical" href="https?:\/\/[^"]+\/"/);
    expect(res.text).toContain('property="og:title"');
  });

  it('versions the stylesheet and scripts so a deploy cannot leave stale copies behind', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).toMatch(/href="\/css\/app\.css\?v=[0-9a-z]+"/);
    expect(res.text).toMatch(/src="\/js\/menu\.js\?v=[0-9a-z]+"/);
  });

  it('serves a service worker that fetches the stylesheet from the network first', async () => {
    const res = await request(app.getHttpServer()).get('/sw.js');
    expect(res.text).toContain('qaemati-shell-v2');
    expect(res.text).not.toContain('cached || fetch(request)');
  });
});
