import { MailService } from './mail.service';

describe('MailService without Gmail credentials', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('is not configured and keeps test mail in the outbox', async () => {
    delete process.env.MAIL_USER;
    delete process.env.MAIL_APP_PASSWORD;
    process.env.NODE_ENV = 'test';
    const mail = new MailService();
    expect(mail.configured).toBe(false);
    expect(await mail.send({ to: 'a@b.co', subject: 's', text: 't' })).toBe(true);
    expect(mail.outbox).toHaveLength(1);
  });

  it('reports a message as not sent when nothing is configured outside tests', async () => {
    delete process.env.MAIL_USER;
    delete process.env.MAIL_APP_PASSWORD;
    process.env.NODE_ENV = 'production';
    const mail = new MailService();
    expect(await mail.send({ to: 'a@b.co', subject: 's', text: 't' })).toBe(false);
    expect(mail.outbox).toHaveLength(0);
  });

  it('is configured once both Gmail values are set, ignoring spaces in the app password', () => {
    process.env.MAIL_USER = 'owner@gmail.com';
    process.env.MAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    expect(new MailService().configured).toBe(true);
  });
});
