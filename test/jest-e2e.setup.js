// Loads .env.test before any e2e spec runs, so PrismaService/session/etc.
// connect to the dedicated qaemati_test database instead of dev data.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.test') });
