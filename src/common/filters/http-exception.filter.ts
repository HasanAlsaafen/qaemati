import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status !== HttpStatus.NOT_FOUND) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // htmx only swaps 2xx responses into the DOM by default, so a full
    // error *page* for a failed htmx request is never actually injected
    // anywhere -- but it also means the user sees nothing happen at all.
    // Fire a toast instead of rendering the page, and skip the render
    // work entirely since the HTML body would be thrown away either way.
    if (request.headers['hx-request'] === 'true') {
      const locale = request.locale ?? 'ar';
      const message = this.i18n.t('common.errors.serverErrorTitle', { lang: locale });
      response.setHeader('HX-Trigger', JSON.stringify({ toast: { message, variant: 'danger' } }));
      response.status(status).send('');
      return;
    }

    const template = status === HttpStatus.NOT_FOUND ? 'pages/errors/404' : 'pages/errors/500';
    response.status(status).render(template, { statusCode: status });
  }
}
