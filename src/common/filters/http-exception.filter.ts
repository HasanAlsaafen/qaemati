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

function hasHttpStatusCode(error: unknown): error is { statusCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  );
}

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Not every thrown error is a Nest HttpException: doubleCsrfProtection
    // (applied as raw Express middleware, before Nest's own exception
    // layer) throws a plain `http-errors`-style ForbiddenError with a
    // `.statusCode`, not an HttpException. Without this fallback, every
    // CSRF rejection -- including the ordinary kind (a stale tab, an
    // expired session), not just an actual attack -- surfaced as a
    // generic 500 "Something went wrong" instead of a clear 403. Found by
    // the Phase 9 e2e test suite, not by inspection.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : hasHttpStatusCode(exception)
          ? exception.statusCode
          : HttpStatus.INTERNAL_SERVER_ERROR;

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
      // See htmx-toast.ts: header values can't carry raw non-ASCII bytes.
      response.setHeader(
        'HX-Trigger',
        JSON.stringify({ toast: { message: encodeURIComponent(message), variant: 'danger' } }),
      );
      response.status(status).send('');
      return;
    }

    const template = status === HttpStatus.NOT_FOUND ? 'pages/errors/404' : 'pages/errors/500';
    response.status(status).render(template, { statusCode: status });
  }
}
