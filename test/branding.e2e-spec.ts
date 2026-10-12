import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('Branding settings (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let adminEmail: string;
  let agent: ReturnType<typeof request.agent>;

  async function csrfToken(path: string): Promise<string> {
    const res = await agent.get(path).set('Cookie', 'qaemati_locale=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'branding');
    restaurantId = restaurant.id;
    adminEmail = admin.email;
    agent = await loginAsAdmin(app, adminEmail);
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('saves restaurant details and a primary color that passes AA contrast', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        whatsapp: '+970599000123',
        currency: 'JOD',
        primaryColor: '#1E5F74',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Branding saved');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.nameEn).toBe('Updated Test Restaurant');
    expect(restaurant?.currency).toBe('JOD');
    expect(restaurant?.primaryColor).toBe('#1E5F74');
  });

  it('rejects a primary color too light for white text, with a visible toast', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        primaryColor: '#FFD1A9',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');

    // The rejected color must not have been saved over the valid one
    // from the previous test.
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.primaryColor).toBe('#1E5F74');

    // The error is attached to the primary color field specifically (not
    // just a toast) -- the P1-4 gap from docs/ux/audit.md.
    expect(res.text).toContain('field-primaryColor-error');
    expect(res.text).not.toContain('field-secondaryColor-error');
  });

  it('rejects a malformed primary color hex, distinctly from a contrast failure', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        primaryColor: 'not-a-color',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Enter a valid color.');
    expect(res.text).toContain('field-primaryColor-error');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.primaryColor).toBe('#1E5F74');
  });

  it('keeps what was typed in the other fields when a save is rejected', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي',
        nameEn: 'Test Restaurant',
        currency: 'JOD',
        primaryColor: 'not-a-color',
        whatsapp: '+970599123456',
        workingHoursEn: 'Daily 8 to 10',
      });

    expect(res.text).toContain('field-primaryColor-error');
    expect(res.text).toContain('value="+970599123456"');
    expect(res.text).toContain('value="Daily 8 to 10"');
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.whatsapp).not.toBe('+970599123456');
  });

  it('requires both a nameAr and nameEn, flagging only the one left blank', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: '',
        currency: 'JOD',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');
    expect(res.text).toContain('field-nameEn-error');
    expect(res.text).not.toContain('field-nameAr-error');
  });

  it('rejects a one-sided open/close time window', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        openTime: '09:00',
        closeTime: '',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.openTime).toBeNull();

    // closeTime is the one left blank -- openTime (which was filled in)
    // isn't the problem and shouldn't be flagged.
    expect(res.text).toContain('field-closeTime-error');
    expect(res.text).not.toContain('field-openTime-error');
  });

  it('applies the saved primary color to the public menu as a CSS override', async () => {
    const res = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(res.status).toBe(200);
    // #1E5F74 -> "30 95 116"
    expect(res.text).toContain('--color-primary: 30 95 116');
  });

  it('saves a background color, card style, and button shape, applied to the public menu', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        backgroundColor: '#F0F0F0',
        cardStyle: 'raised',
        buttonShape: 'pill',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Branding saved');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.backgroundColor).toBe('#F0F0F0');
    expect(restaurant?.cardStyle).toBe('raised');
    expect(restaurant?.buttonShape).toBe('pill');

    const menuRes = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(menuRes.status).toBe(200);
    // #F0F0F0 -> "240 240 240"
    expect(menuRes.text).toContain('--color-bg: 240 240 240');
    expect(menuRes.text).toContain('--radius-button: 9999px');
    expect(menuRes.text).toContain('data-card-style="raised"');
  });

  it('rejects a background color too dark for the fixed body text', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        backgroundColor: '#2B2622',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');
    expect(res.text).toContain('field-backgroundColor-error');

    // The rejected background must not overwrite the valid one saved above.
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.backgroundColor).toBe('#F0F0F0');
  });

  it('saves category divider and a pattern background, applied to the public menu', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        categoryDivider: 'dashed',
        backgroundStyle: 'pattern',
        backgroundPattern: 'grid',
        sectionSpacing: 'spacious',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Branding saved');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.categoryDivider).toBe('dashed');
    expect(restaurant?.backgroundStyle).toBe('pattern');
    expect(restaurant?.backgroundPattern).toBe('grid');
    expect(restaurant?.sectionSpacing).toBe('spacious');

    const menuRes = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(menuRes.status).toBe(200);
    expect(menuRes.text).toContain('data-category-divider="dashed"');
    expect(menuRes.text).toContain('data-background-style="pattern"');
    expect(menuRes.text).toContain('data-background-pattern="grid"');
    expect(menuRes.text).toContain('data-section-spacing="spacious"');
  });

  describe('the look of dish cards and category titles', () => {
    const save = async (extra: Record<string, string>) => {
      const token = await csrfToken('/admin/branding?lang=en');
      return agent
        .patch('/admin/branding')
        .set('X-CSRF-Token', token)
        .set('Cookie', 'qaemati_locale=en')
        .type('form')
        .send({ nameAr: 'مطعم تجريبي', nameEn: 'Test Restaurant', currency: 'JOD', ...extra });
    };

    it('saves layout, photo visibility, photo shape and category marker, and applies them to the public menu', async () => {
      const res = await save({
        menuLayout: 'list',
        itemImages: 'hide',
        itemImageShape: 'round',
        categoryMarker: 'underline',
      });
      expect(res.status).toBe(200);
      const saved = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      expect(saved).toMatchObject({
        menuLayout: 'list',
        itemImages: 'hide',
        itemImageShape: 'round',
        categoryMarker: 'underline',
      });
      const menu = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
      for (const attr of [
        'data-menu-layout="list"',
        'data-item-images="hide"',
        'data-image-shape="round"',
        'data-category-marker="underline"',
      ]) {
        expect(menu.text).toContain(attr);
      }
    });

    it.each([['menuLayout'], ['itemImages'], ['itemImageShape'], ['categoryMarker']])(
      'rejects an unknown %s and keeps what was saved',
      async (field) => {
        await save({
          menuLayout: 'grid',
          itemImages: 'show',
          itemImageShape: 'standard',
          categoryMarker: 'bar',
        });
        const res = await save({ [field]: 'sparkles' });
        expect(res.status).not.toBe(500);
        const saved = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
        expect((saved as Record<string, unknown>)[field]).not.toBe('sparkles');
      },
    );

    it('saves the header and text looks and the extra choices, and applies them to the public menu', async () => {
      const res = await save({
        logoShape: 'round',
        coverHeight: 'large',
        priceStyle: 'badge',
        headingAlign: 'center',
        fontTheme: 'clean',
        cornerStyle: 'soft',
        cardStyle: 'outlined',
        buttonShape: 'square',
        menuLayout: 'grid3',
        itemImageShape: 'tall',
        categoryMarker: 'rule',
        categoryDivider: 'dotted',
        backgroundStyle: 'pattern',
        backgroundPattern: 'checks',
      });
      expect(res.status).toBe(200);
      const saved = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      expect(saved).toMatchObject({
        logoShape: 'round',
        coverHeight: 'large',
        priceStyle: 'badge',
        headingAlign: 'center',
        fontTheme: 'clean',
        cornerStyle: 'soft',
        cardStyle: 'outlined',
        buttonShape: 'square',
        menuLayout: 'grid3',
        itemImageShape: 'tall',
        categoryMarker: 'rule',
        categoryDivider: 'dotted',
        backgroundPattern: 'checks',
      });
      const menu = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
      for (const attr of [
        'data-logo-shape="round"',
        'data-cover-height="large"',
        'data-price-style="badge"',
        'data-heading-align="center"',
        'data-menu-layout="grid3"',
        'data-image-shape="tall"',
        'data-category-marker="rule"',
      ]) {
        expect(menu.text).toContain(attr);
      }
      expect(menu.text).toContain('--radius-card: 24px');
      expect(menu.text).toContain('--radius-button: 2px');
      expect(menu.text).toContain("'Inter'");
    });

    it.each([
      ['cairo', "'Cairo'"],
      ['almarai', "'Almarai'"],
      ['naskh', "'Noto Naskh Arabic'"],
      ['serif', "'Playfair Display'"],
    ])('applies the %s typeface to the public menu', async (fontTheme, family) => {
      const res = await save({ fontTheme });
      expect(res.status).toBe(200);
      const menu = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
      expect(menu.text).toContain(`--font-sans: ${family}`);
      await save({ fontTheme: 'classic' });
    });

    it('applies Thmanyah when the web license is confirmed and falls back to Classic when not', async () => {
      const res = await save({ fontTheme: 'thmanyah' });
      expect(res.status).toBe(200);
      const on = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
      expect(on.text).toContain("--font-sans: 'Thmanyah Sans'");
      expect(on.text).toContain('/css/thmanyah.css');
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const off = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
        expect(off.text).not.toContain('Thmanyah');
        await save({ fontTheme: 'classic' });
        await save({ fontTheme: 'thmanyah' });
        const saved = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
        expect(saved?.fontTheme).toBe('classic');
      } finally {
        process.env.NODE_ENV = prev;
      }
      await save({ fontTheme: 'classic' });
    });

    it('guards the settings form against leaving with unsaved changes', async () => {
      const page = await agent.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
      expect(page.text).toContain('data-dirty-guard="branding"');
      expect(page.text).toContain('/js/dirty-guard.js');
    });

    it('groups the look choices into tabs on the branding page', async () => {
      const page = await agent.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
      for (const tab of ['colors', 'text', 'header', 'layout', 'dishes']) {
        expect(page.text).toContain(`id="look-panel-${tab}"`);
      }
    });

    it.each(['waves', 'zigzag', 'diamonds', 'rings', 'polka', 'stripes'])(
      'saves and applies the %s background pattern',
      async (pattern) => {
        const res = await save({ backgroundStyle: 'pattern', backgroundPattern: pattern });
        expect(res.status).toBe(200);
        const menu = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
        expect(menu.text).toContain(`data-background-pattern="${pattern}"`);
        await save({ backgroundStyle: 'solid', backgroundPattern: 'dots' });
      },
    );

    it.each(['double', 'fade', 'ornament', 'zigzag'])(
      'saves and applies the %s category separator',
      async (divider) => {
        const res = await save({ categoryDivider: divider });
        expect(res.status).toBe(200);
        const menu = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
        expect(menu.text).toContain(`data-category-divider="${divider}"`);
        await save({ categoryDivider: 'none' });
      },
    );

    it.each(['ramadan', 'eidFitr', 'eidAdha', 'olive', 'summer', 'winter', 'evening'])(
      'draws the %s decoration band on the public menu',
      async (decor) => {
        const res = await save({ themeDecor: decor });
        expect(res.status).toBe(200);
        const menu = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
        expect(menu.text).toContain(`data-theme-decor="${decor}"`);
        expect(menu.text).toContain(`id="decor-${decor}"`);
        await save({ themeDecor: 'none' });
        const plain = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
        expect(plain.text).not.toContain('class="theme-decor"');
      },
    );

    it('rejects an unknown decoration', async () => {
      await save({ themeDecor: 'sparkles' });
      const saved = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      expect(saved?.themeDecor).not.toBe('sparkles');
    });

    it('offers every ready-made theme on the branding page', async () => {
      const page = await agent.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
      for (const key of [
        'classic',
        'ramadan',
        'eidFitr',
        'eidAdha',
        'olive',
        'summer',
        'winter',
        'evening',
      ]) {
        expect(page.text).toContain(`applyTheme('${key}')`);
      }
    });

    it('lets a chosen background color and pattern show through the page bands', async () => {
      await save({ backgroundColor: '#F0E6D6', backgroundStyle: 'solid' });
      const color = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
      expect(color.text).toContain('data-custom-bg="true"');
      await save({ backgroundColor: '', backgroundStyle: 'solid' });
      const plain = await request(app.getHttpServer()).get('/m/test-restaurant-branding?lang=en');
      expect(plain.text).toContain('data-custom-bg="false"');
      expect(plain.text).toContain('menu-band');
    });

    it.each([['logoShape'], ['coverHeight'], ['priceStyle'], ['headingAlign']])(
      'rejects an unknown %s',
      async (field) => {
        const res = await save({ [field]: 'sparkles' });
        expect(res.status).not.toBe(500);
        const saved = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
        expect((saved as Record<string, unknown>)[field]).not.toBe('sparkles');
      },
    );

    it('draws the preview in the same phone frame as the landing page', async () => {
      const res = await agent.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
      for (const part of [
        'class="iphone"',
        'iphone__island',
        'iphone__home',
        'class="iphone__page"',
      ])
        expect(res.text).toContain(part);
      expect(res.text).not.toContain('rounded-[3rem]');
    });

    it('shows the four choices on the branding page in both languages', async () => {
      const en = await agent.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
      for (const label of [
        'Dish cards',
        'Dish photos',
        'Photo shape',
        'Mark before category titles',
      ])
        expect(en.text).toContain(label);
      const ar = await agent.get('/admin/branding').set('Cookie', 'qaemati_locale=ar');
      for (const label of ['بطاقات الأطباق', 'صور الأطباق', 'شكل الصورة'])
        expect(ar.text).toContain(label);
    });

    it('only previews an unsaved choice for the signed in owner', async () => {
      await save({ menuLayout: 'grid' });
      const guest = await request(app.getHttpServer()).get(
        '/m/test-restaurant-branding?previewMenuLayout=large',
      );
      expect(guest.text).toContain('data-menu-layout="grid"');
      const owner = await agent.get('/m/test-restaurant-branding?previewMenuLayout=large');
      expect(owner.text).toContain('data-menu-layout="large"');
    });

    it('serves the image editor on every admin page that uploads', async () => {
      const res = await agent.get('/admin/branding').set('Cookie', 'qaemati_locale=en');
      expect(res.text).toContain('id="image-editor-template"');
      expect(res.text).toContain('/js/image-editor.js');
      expect(res.text).toContain('data-crop-aspect="1.7778"');
    });
  });

  it('uploads a background image and applies it as an inline style when backgroundStyle is image', async () => {
    const saveToken = await csrfToken('/admin/branding?lang=en');
    await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', saveToken)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        backgroundStyle: 'image',
      });

    const uploadToken = await csrfToken('/admin/branding?lang=en');
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const res = await agent
      .post('/admin/branding/background')
      .set('X-CSRF-Token', uploadToken)
      .set('Cookie', 'qaemati_locale=en')
      .attach('image', pngBytes, { filename: 'bg.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Background image updated');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.backgroundImagePath).toMatch(/^\/uploads\/restaurants\//);

    const menuRes = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(menuRes.status).toBe(200);
    expect(menuRes.text).toContain(`background-image: url('${restaurant?.backgroundImagePath}')`);
  });

  it('removes the logo, cover and background photos', async () => {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        logoPath: '/uploads/restaurants/a.png',
        coverImagePath: '/uploads/restaurants/b.png',
        backgroundImagePath: '/uploads/restaurants/c.png',
        backgroundStyle: 'image',
      },
    });
    const token = await csrfToken('/admin/branding?lang=en');
    for (const kind of ['logo', 'cover', 'background']) {
      const res = await agent
        .delete(`/admin/branding/${kind}/image`)
        .set('X-CSRF-Token', token)
        .set('Cookie', 'qaemati_locale=en');
      expect(res.status).toBe(200);
    }
    const saved = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(saved).toMatchObject({
      logoPath: null,
      coverImagePath: null,
      backgroundImagePath: null,
      backgroundStyle: 'solid',
    });
    const bad = await agent
      .delete('/admin/branding/nope/image')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en');
    expect(bad.status).toBe(400);
  });

  it('rejects a non-image file upload for the logo', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .post('/admin/branding/logo')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .attach('image', Buffer.from('not an image'), {
        filename: 'fake.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });
});
