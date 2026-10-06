import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

// A valid 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Category image (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let otherRestaurantId: string;
  let categoryId: string;
  let otherCategoryId: string;
  let slug: string;
  let agent: ReturnType<typeof request.agent>;
  const written: string[] = [];

  async function token(): Promise<string> {
    const res = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'catimg');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
    categoryId = (
      await prisma.category.create({ data: { restaurantId, nameAr: 'قسم', nameEn: 'Starters' } })
    ).id;
    const other = await createTestRestaurant(prisma, 'catimg-other');
    otherRestaurantId = other.restaurant.id;
    otherCategoryId = (
      await prisma.category.create({
        data: { restaurantId: otherRestaurantId, nameAr: 'آخر', nameEn: 'Other' },
      })
    ).id;
    agent = await loginAsAdmin(app, admin.email);
  });

  afterAll(async () => {
    for (const file of written) if (existsSync(file)) unlinkSync(file);
    await deleteTestRestaurant(prisma, restaurantId);
    await deleteTestRestaurant(prisma, otherRestaurantId);
    await app.close();
  });

  it('uploads a picture, stores it and shows it in the public category bar', async () => {
    const csrf = await token();
    const res = await agent
      .post(`/admin/categories/${categoryId}/image`)
      .set('X-CSRF-Token', csrf)
      .set('HX-Request', 'true')
      .set('Cookie', 'qaemati_locale=en')
      .attach('image', PNG, { filename: 'starters.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const row = await prisma.category.findUnique({ where: { id: categoryId } });
    expect(row?.imagePath).toMatch(/^\/uploads\/categories\/[0-9a-f-]+\.png$/);
    written.push(join(__dirname, '..', 'public', row!.imagePath!));
    expect(res.text).toContain(row!.imagePath!);
    expect(JSON.parse(res.headers['hx-trigger']).toast.variant).toBe('success');

    const page = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(page.text).toMatch(
      new RegExp(`data-chip-circle[\\s\\S]{0,300}src="${row!.imagePath!.replace(/\//g, '\\/')}"`),
    );
  });

  it('removes the picture so the chip falls back', async () => {
    const csrf = await token();
    const res = await agent
      .delete(`/admin/categories/${categoryId}/image`)
      .set('X-CSRF-Token', csrf)
      .set('HX-Request', 'true')
      .set('Cookie', 'qaemati_locale=en');
    expect(res.status).toBe(200);
    expect((await prisma.category.findUnique({ where: { id: categoryId } }))?.imagePath).toBeNull();
  });

  it('rejects a file that is not an image and stores nothing', async () => {
    const csrf = await token();
    const res = await agent
      .post(`/admin/categories/${categoryId}/image`)
      .set('X-CSRF-Token', csrf)
      .set('HX-Request', 'true')
      .attach('image', Buffer.from('not an image'), {
        filename: 'x.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
    expect((await prisma.category.findUnique({ where: { id: categoryId } }))?.imagePath).toBeNull();
  });

  it("does not let one restaurant change another restaurant's category image", async () => {
    const csrf = await token();
    const res = await agent
      .post(`/admin/categories/${otherCategoryId}/image`)
      .set('X-CSRF-Token', csrf)
      .set('HX-Request', 'true')
      .attach('image', PNG, { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
    expect(
      (await prisma.category.findUnique({ where: { id: otherCategoryId } }))?.imagePath,
    ).toBeNull();
  });

  it('shows the picture control and its hint on the dashboard', async () => {
    const res = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    expect(res.text).toContain(`category-${categoryId}-image-input`);
    expect(res.text).toContain('Category image');
  });
});
