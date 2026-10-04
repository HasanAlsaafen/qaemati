import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

/**
 * A1 ("My selection" + WhatsApp send) is almost entirely client-side
 * (Alpine store backed by localStorage -- see public/js/selection.js),
 * so the part an HTTP-level e2e test can actually exercise is the
 * server-rendered half: the add-to-selection UI and its scripts must be
 * present when the restaurant has a WhatsApp number, and genuinely
 * absent (not just hidden) when it doesn't, per the brief's "hide
 * gracefully" requirement. The message-building logic itself is unit
 * tested in src/common/text/build-whatsapp-message.spec.ts.
 */
describe('Selection UI / WhatsApp send (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let withWhatsappId: string;
  let withWhatsappSlug: string;
  let withoutWhatsappId: string;
  let withoutWhatsappSlug: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const withWhatsapp = await createTestRestaurant(prisma, 'selection-with-wa');
    withWhatsappId = withWhatsapp.restaurant.id;
    withWhatsappSlug = withWhatsapp.restaurant.slug;

    const withoutWhatsapp = await createTestRestaurant(prisma, 'selection-no-wa');
    withoutWhatsappId = withoutWhatsapp.restaurant.id;
    withoutWhatsappSlug = withoutWhatsapp.restaurant.slug;
    await prisma.restaurant.update({
      where: { id: withoutWhatsappId },
      data: { whatsapp: null },
    });
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, withWhatsappId);
    await deleteTestRestaurant(prisma, withoutWhatsappId);
    await app.close();
  });

  it('loads the selection scripts and shows the shared add button when WhatsApp is set', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${withWhatsappSlug}?lang=en`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('/js/selection.js');
    expect(res.text).toContain('/js/whatsapp-message.js');
    expect(res.text).toContain('store.selection.add');
  });

  it('loads selection.js before alpine.min.js in document order', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${withWhatsappSlug}?lang=en`);
    const selectionIndex = res.text.indexOf('/js/selection.js');
    const alpineIndex = res.text.indexOf('/js/vendor/alpine.min.js');
    expect(selectionIndex).toBeGreaterThan(-1);
    expect(alpineIndex).toBeGreaterThan(-1);
    expect(selectionIndex).toBeLessThan(alpineIndex);
  });

  it('does not load the selection scripts when there is no WhatsApp number', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${withoutWhatsappSlug}?lang=en`);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('/js/selection.js');
    expect(res.text).not.toContain('/js/whatsapp-message.js');
  });

  it('renders the Arabic selection labels under the Arabic locale', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${withWhatsappSlug}?lang=ar`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('طلبي');
  });
});
