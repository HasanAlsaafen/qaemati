import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

/**
 * .env.test sets DEMO_MODE=true, so these run against the real gated
 * behavior rather than a mocked flag. The reset test re-seeds the whole
 * demo dataset (by design -- see demo.controller.ts's comment on why
 * this isn't scoped to one restaurant), so it cleans up the two demo
 * restaurants it creates in afterAll to avoid leaving them behind for
 * whichever spec file runs next in this same --runInBand run.
 */
describe('Demo mode (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;

  async function csrfToken(): Promise<string> {
    const res = await agent.get('/?lang=en').set('Cookie', 'qaemati_locale=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.restaurant.deleteMany({
      where: { slug: { in: ['bayt-al-zaytoun', 'al-sanabel'] } },
    });
    await app.close();
  });

  it('shows the demo panel on the home page', async () => {
    const res = await agent.get('/?lang=en').set('Cookie', 'qaemati_locale=en');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Try the admin panel');
  });

  it('re-seeds the demo restaurants on reset and redirects with a success flag', async () => {
    // Start from a known "dirtied" state: delete both demo restaurants
    // if a prior run left them, plus a throwaway unrelated restaurant,
    // so this test proves reset actually recreates the demo set rather
    // than finding it already there, and wipes whatever else existed.
    await prisma.restaurant.deleteMany({
      where: { slug: { in: ['bayt-al-zaytoun', 'al-sanabel'] } },
    });
    const { restaurant: throwaway } = await createTestRestaurant(prisma, 'demo-reset');

    const token = await csrfToken();
    const res = await agent
      .post('/demo/reset')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ csrf_token: token });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?demoReset=success');

    const demoRestaurants = await prisma.restaurant.findMany({
      where: { slug: { in: ['bayt-al-zaytoun', 'al-sanabel'] } },
    });
    expect(demoRestaurants).toHaveLength(2);

    const throwawayStillExists = await prisma.restaurant.findUnique({
      where: { id: throwaway.id },
    });
    expect(throwawayStillExists).toBeNull();

    await deleteTestRestaurant(prisma, throwaway.id);
  });

  it('shows the credentials for a seeded restaurant and the success banner after a reset redirect', async () => {
    const res = await agent.get('/?demoReset=success&lang=en').set('Cookie', 'qaemati_locale=en');
    expect(res.text).toContain('Demo data has been reset');
    expect(res.text).toContain('Qaemati@Demo123');
    expect(res.text).toContain('admin@baytalzaytoun.example.com');
  });

  it('asks for confirmation before a reset through a handler the CSP allows', async () => {
    const res = await agent.get('/?lang=en').set('Cookie', 'qaemati_locale=en');
    // An inline onsubmit is blocked by script-src-attr 'none', so the reset
    // would have run with no question.
    expect(res.text).not.toContain('onsubmit=');
    expect(res.text).toContain('x-on:submit="if (!confirm(');
    expect(res.headers['content-security-policy']).toContain("script-src-attr 'none'");
  });

  it('lists the platform admin demo login', async () => {
    const res = await agent.get('/?lang=en').set('Cookie', 'qaemati_locale=en');
    expect(res.text).toContain('super@qaemati.example.com');
    expect(res.text).toContain('/super/login');
  });
});
