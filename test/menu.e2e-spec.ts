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

  it('serves a per-restaurant web app manifest scoped to this slug', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}/manifest.webmanifest?lang=en`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/manifest+json');
    expect(res.body.name).toBe('Test Restaurant');
    expect(res.body.start_url).toBe(`/m/${slug}`);
    expect(res.body.scope).toBe(`/m/${slug}`);
    expect(res.body.icons.length).toBeGreaterThan(0);
  });

  it('404s the manifest for an unknown slug', async () => {
    const res = await request(app.getHttpServer()).get('/m/does-not-exist/manifest.webmanifest');
    expect(res.status).toBe(404);
  });

  it('links the manifest and registers the service worker on a real (non-embed) menu page', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).toContain(`/m/${slug}/manifest.webmanifest`);
    expect(res.text).toContain('/js/pwa.js');
  });

  it('omits the manifest link on the embedded branding-preview page', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?embed=1&lang=en`);
    expect(res.text).not.toContain('manifest.webmanifest');
    expect(res.text).not.toContain('/js/pwa.js');
  });

  it('serves the offline fallback page the service worker falls back to', async () => {
    const res = await request(app.getHttpServer()).get('/offline?lang=en');
    expect(res.status).toBe(200);
    expect(res.text).toContain('You&#39;re offline');
  });
});
