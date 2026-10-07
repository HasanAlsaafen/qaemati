import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends mail through Gmail SMTP with an app password (MAIL_USER and
 * MAIL_APP_PASSWORD). With neither set nothing leaves the process: tests keep
 * messages in `outbox`, development logs them so a reset link can be copied
 * from the terminal, and production logs only that a message was skipped,
 * because the body carries a one use link.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: Transporter;
  private readonly from?: string;
  readonly outbox: MailMessage[] = [];

  constructor() {
    const user = process.env.MAIL_USER?.trim();
    const pass = process.env.MAIL_APP_PASSWORD?.replace(/\s+/g, '');
    if (user && pass) {
      this.from = process.env.MAIL_FROM?.trim() || `Qaemati <${user}>`;
      this.transport = createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      });
    }
  }

  get configured(): boolean {
    return Boolean(this.transport);
  }

  /** Resolves true when the message was handed to the mail server. Never throws. */
  async send(message: MailMessage): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' && !this.transport) {
      this.outbox.push(message);
      return true;
    }
    if (!this.transport) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(`Mail is not configured, skipped "${message.subject}"`);
      } else {
        this.logger.log(
          `Mail not configured. To ${message.to}: ${message.subject}\n${message.text}`,
        );
      }
      return false;
    }
    try {
      await this.transport.sendMail({ from: this.from, ...message });
      return true;
    } catch (error) {
      this.logger.error(
        `Sending "${message.subject}" failed: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }
}
