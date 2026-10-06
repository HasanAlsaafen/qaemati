import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, ModulesContainer } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('Validation, CSRF and error responses (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let categoryId: string;
  let agent: ReturnType<typeof request.agent>;

  async function csrfToken(): Promise<string> {
    const res = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'validation');
    restaurantId = restaurant.id;
    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'قسم', nameEn: 'Section' },
    });
    categoryId = category.id;
    agent = await loginAsAdmin(app, admin.email);
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('answers an invalid price with 422, a message per field, and creates nothing', async () => {
    const token = await csrfToken();
    const res = await agent
      .post(`/admin/categories/${categoryId}/items`)
      .set('X-CSRF-Token', token)
      .set('HX-Request', 'true')
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ nameAr: 'صنف', nameEn: 'Dish', price: 'abc', currency: 'ILS' });

    expect(res.status).toBe(422);
    expect(res.body.errors.price).toEqual(['Enter a number, for example 12.50.']);
    expect(res.body.errors).not.toHaveProperty('nameEn');
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');
    expect(await prisma.item.count({ where: { categoryId } })).toBe(0);
  });

  it('localises the same failure in Arabic', async () => {
    const token = await csrfToken();
    const res = await agent
      .post(`/admin/categories/${categoryId}/items`)
      .set('X-CSRF-Token', token)
      .set('HX-Request', 'true')
      .set('Cookie', 'qaemati_locale=ar')
      .type('form')
      .send({ nameAr: 'صنف', nameEn: 'Dish', price: 'abc' });

    expect(res.status).toBe(422);
    expect(res.body.errors.price[0]).toContain('رقمًا');
  });

  it('rejects a form field the DTO does not declare', async () => {
    const token = await csrfToken();
    const res = await agent
      .post('/admin/categories')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ nameAr: 'a', nameEn: 'b', restaurantId: 'someone-else' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty('restaurantId');
  });

  it('re-renders the login form with the field message and the typed email', async () => {
    const anon = request.agent(app.getHttpServer());
    const page = await anon.get('/admin/login?lang=en');
    const token = /name="csrf_token" value="([^"]*)"/.exec(page.text)?.[1] ?? '';
    const longEmail = `${'a'.repeat(260)}@test.example.com`;
    const res = await anon
      .post('/admin/login')
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ csrf_token: token, email: longEmail, password: 'x', redirect: '/admin' });

    expect(res.status).toBe(422);
    expect(res.text).toContain('This is too long.');
    expect(res.text).toContain(longEmail);
    expect(res.text).not.toContain('value="x"');
    expect(res.text).toContain('aria-invalid="true"');
  });

  it('rejects an htmx write with a wrong CSRF token as 403 and changes nothing', async () => {
    const res = await agent
      .post('/admin/categories')
      .set('X-CSRF-Token', 'not-the-token')
      .set('HX-Request', 'true')
      .type('form')
      .send({ nameAr: 'x', nameEn: 'y' });

    expect(res.status).toBe(403);
    expect(await prisma.category.count({ where: { restaurantId, nameEn: 'y' } })).toBe(0);
  });

  it('refuses every state-changing route when no CSRF token is sent', async () => {
    const writes: Array<{ method: string; path: string }> = [];
    for (const wrapper of new DiscoveryService(app.get(ModulesContainer)).getControllers()) {
      const controller = wrapper.metatype as (new () => object) | null;
      if (!controller) continue;
      const base = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name] as object;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (method === undefined) continue;
        const verb = RequestMethod[method].toLowerCase();
        if (!['post', 'put', 'patch', 'delete'].includes(verb)) continue;
        const path = `/${[base, Reflect.getMetadata(PATH_METADATA, handler)]
          .filter((part) => part && part !== '/')
          .join('/')}`.replace(/\/+/g, '/');
        writes.push({ method: verb, path: path.replace(/:\w+/g, 'x') });
      }
    }

    expect(writes.length).toBeGreaterThan(25);
    for (const { method, path } of writes) {
      const server = request(app.getHttpServer()) as unknown as Record<
        string,
        (p: string) => request.Test
      >;
      const res = await server[method](path);
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 403 });
    }
  });

  it('answers a JSON client with JSON and no stack trace', async () => {
    const res = await request(app.getHttpServer())
      .get('/nothing-here')
      .set('Accept', 'application/json');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ statusCode: 404 });
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js):\d+/);
  });

  it('answers a browser with the designed 404 page', async () => {
    const res = await request(app.getHttpServer()).get('/nothing-here').set('Accept', 'text/html');
    expect(res.status).toBe(404);
    expect(res.text).toContain('<html');
  });
});
