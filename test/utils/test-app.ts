import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  await configureApp(app);
  await app.init();
  return app;
}

export const TEST_ADMIN_PASSWORD = 'Test@Password123';

/**
 * A minimal restaurant + admin user fixture, independent of
 * prisma/seed.ts's larger demo dataset -- e2e specs create and tear down
 * their own restaurant per test file (unique slug) so they can run
 * concurrently without clobbering each other's data.
 */
export async function createTestRestaurant(prisma: PrismaService, slugSuffix: string) {
  const slug = `test-restaurant-${slugSuffix}`;
  const passwordHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);

  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      nameAr: 'مطعم تجريبي',
      nameEn: 'Test Restaurant',
      whatsapp: '+970599000000',
      adminUsers: {
        create: {
          email: `admin-${slugSuffix}@test.example.com`,
          passwordHash,
          name: 'Test Admin',
        },
      },
    },
    include: { adminUsers: true },
  });

  return { restaurant, admin: restaurant.adminUsers[0] };
}

export async function deleteTestRestaurant(prisma: PrismaService, restaurantId: string) {
  await prisma.restaurant.delete({ where: { id: restaurantId } }).catch(() => {});
}

/**
 * Logs in as the given admin via a real HTTP round trip (GET the login
 * page for a CSRF token, then POST credentials), returning a supertest
 * agent that carries the resulting session cookie on every subsequent
 * request. Exercises the actual login flow rather than forging a session,
 * matching the "test through the real stack" approach used throughout
 * this project's own manual verification in earlier phases.
 */
export async function loginAsAdmin(
  app: NestExpressApplication,
  email: string,
  password: string = TEST_ADMIN_PASSWORD,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app.getHttpServer());
  const loginPage = await agent.get('/admin/login');
  const tokenMatch = /name="csrf_token" value="([^"]*)"/.exec(loginPage.text);
  if (!tokenMatch) {
    throw new Error('Could not find csrf_token on the login page');
  }

  await agent
    .post('/admin/login')
    .type('form')
    .send({ csrf_token: tokenMatch[1], email, password, redirect: '/admin' })
    .expect(302);

  return agent;
}
