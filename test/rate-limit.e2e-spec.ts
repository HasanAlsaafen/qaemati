import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('POST rate limiting (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cuts off repeated demo resets before CSRF or the seed run', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await request(app.getHttpServer()).post('/demo/reset')).status);
    }
    // Without a CSRF token the first three are rejected as 403, the fourth never gets that far.
    expect(statuses).toEqual([403, 403, 403, 429]);
  });
});
