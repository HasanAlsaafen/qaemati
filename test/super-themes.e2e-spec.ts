import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { checkThemeValues } from '../src/admin/themes';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

const SUPER_PASSWORD = 'Super@Password123';
const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';

describe('Platform themes (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let superId: string;
  let operator: ReturnType<typeof request.agent>;
  let restaurantId: string;
  let owner: ReturnType<typeof request.agent>;
  const keys: string[] = [];
  const tag = Date.now().toString(36);

  const look = {
    primaryColor: '#2E3A87',
    secondaryColor: '#C9971C',
    backgroundColor: '#FFF9EC',
    fontTheme: 'naskh',
    cornerStyle: 'soft',
    cardStyle: 'outlined',
    buttonShape: 'pill',
    categoryDivider: 'ornament',
    categoryMarker: 'rule',
    headingAlign: 'center',
    priceStyle: 'badge',
    backgroundStyle: 'pattern',
    backgroundPattern: 'diamonds',
    themeDecor: 'ramadan',
  };

  async function send(path: string, body: Record<string, string>, form = path) {
    const page = await operator.get(form).set('Cookie', 'qaemati_locale=en');
    return operator
      .post(path)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), ...body });
  }

  const create = (key: string, extra: Record<string, string> = {}) => {
    // A key that already belongs to a built-in theme must never be cleaned up.
    if (!key.startsWith('ramadan')) keys.push(key);
    return send(
      '/super/themes',
      { key, nameAr: 'سمة', nameEn: `Theme ${key}`, sortOrder: '99', ...look, ...extra },
      '/super/themes/new',
    );
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const email = `themes-${tag}@sa-test.example.com`;
    superId = (
      await prisma.superAdmin.create({
        data: {
          email,
          name: 'Theme Operator',
          passwordHash: await bcrypt.hash(SUPER_PASSWORD, 10),
        },
      })
    ).id;
    operator = request.agent(app.getHttpServer());
    const page = await operator.get('/super/login');
    await operator
      .post('/super/login')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), email, password: SUPER_PASSWORD });

    const fixture = await createTestRestaurant(prisma, 'themes');
    restaurantId = fixture.restaurant.id;
    owner = await loginAsAdmin(app, fixture.admin.email);
  });

  afterAll(async () => {
    await prisma.brandTheme.deleteMany({ where: { key: { in: keys } } });
    await prisma.superAdmin.delete({ where: { id: superId } });
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('ships the built-in themes, each one valid', async () => {
    const rows = await prisma.brandTheme.findMany({ where: { id: { startsWith: 'builtin-' } } });
    expect(rows.map((r) => r.key).sort()).toEqual(
      ['classic', 'eidAdha', 'eidFitr', 'evening', 'olive', 'ramadan', 'summer', 'winter'].sort(),
    );
    for (const row of rows) expect(checkThemeValues(row)).toBeNull();
  });

  it('lists the themes for the platform owner', async () => {
    const res = await operator.get('/super/themes').set('Cookie', 'qaemati_locale=en');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Ramadan');
    expect(res.text).toContain('/super/themes/new');
  });

  it('creates a theme that owners then see on their branding page', async () => {
    const key = `nationalDay${tag}`;
    const res = await create(key, { nameEn: `National Day ${tag}`, sortOrder: '50' });
    expect(res.status).toBe(303);
    const row = await prisma.brandTheme.findUniqueOrThrow({ where: { key } });
    expect(row).toMatchObject({ primaryColor: '#2E3A87', themeDecor: 'ramadan', isActive: true });

    const page = await owner.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
    expect(page.text).toContain(`National Day ${tag}`);
    expect(page.text).toContain(`applyTheme('${key}')`);
  });

  it('edits a theme and leaves its key alone', async () => {
    const key = `editable${tag}`;
    await create(key);
    const row = await prisma.brandTheme.findUniqueOrThrow({ where: { key } });
    const res = await send(
      `/super/themes/${row.id}`,
      { nameAr: 'اسم', nameEn: 'Renamed', primaryColor: '#0E7C5A', ...pick() },
      `/super/themes/${row.id}`,
    );
    expect(res.status).toBe(303);
    const after = await prisma.brandTheme.findUniqueOrThrow({ where: { id: row.id } });
    expect(after).toMatchObject({ key, nameEn: 'Renamed', primaryColor: '#0E7C5A' });

    function pick() {
      const { primaryColor: _skip, ...rest } = look;
      void _skip;
      return rest;
    }
  });

  it('refuses a key that is taken, a color that is unreadable and an unknown choice', async () => {
    const taken = await create('ramadan');
    expect(taken.status).toBe(303);
    expect(taken.headers.location).toBe('/super/themes/new');
    expect(await prisma.brandTheme.count({ where: { key: 'ramadan' } })).toBe(1);

    const bad = await create(`bad${tag}`, { primaryColor: '#FFEB3B' });
    expect(bad.headers.location).toBe('/super/themes/new');
    expect(await prisma.brandTheme.count({ where: { key: `bad${tag}` } })).toBe(0);

    const odd = await create(`odd${tag}`, { fontTheme: 'comic' });
    expect(odd.headers.location).toBe('/super/themes/new');
    expect(await prisma.brandTheme.count({ where: { key: `odd${tag}` } })).toBe(0);
  });

  it('hides an archived theme from owners and shows it again when restored', async () => {
    const key = `seasonal${tag}`;
    await create(key, { nameEn: `Seasonal ${tag}` });
    const row = await prisma.brandTheme.findUniqueOrThrow({ where: { key } });

    await send(`/super/themes/${row.id}/archive`, {}, '/super/themes');
    let page = await owner.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
    expect(page.text).not.toContain(`Seasonal ${tag}`);

    await send(`/super/themes/${row.id}/restore`, {}, '/super/themes');
    page = await owner.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
    expect(page.text).toContain(`Seasonal ${tag}`);
  });

  it('is closed to a restaurant owner and to a visitor', async () => {
    expect((await owner.get('/super/themes')).status).not.toBe(200);
    const visitor = await request(app.getHttpServer()).get('/super/themes');
    expect(visitor.status).not.toBe(200);
  });
});
