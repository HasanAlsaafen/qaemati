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
import { ValidationFailedException } from '../validation/validation-failed.exception';
import {
  FeatureUnavailableException,
  MenuUnavailableException,
  PlanLimitException,
  SubscriptionBlockedException,
} from '../../tenancy/tenancy.exceptions';

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

    if (exception instanceof ValidationFailedException) {
      this.respondValidationFailure(exception, request, response);
      return;
    }

    if (
      exception instanceof SubscriptionBlockedException ||
      exception instanceof PlanLimitException ||
      exception instanceof FeatureUnavailableException ||
      exception instanceof MenuUnavailableException
    ) {
      this.respondBilling(exception, request, response);
      return;
    }

    if (status !== HttpStatus.NOT_FOUND) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // API clients get JSON and never a stack trace or an internal error
    // message: 5xx details stay in the log.
    if (request.headers['hx-request'] !== 'true' && request.accepts(['html', 'json']) === 'json') {
      response.status(status).json({
        statusCode: status,
        error: HttpStatus[status] ?? 'Error',
        message:
          status < 500 && exception instanceof Error ? exception.message : 'Internal server error',
      });
      return;
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

  /** Subscription, plan limit and feature refusals. These are expected
   *  business answers, so they are not logged as errors. */
  private respondBilling(
    exception:
      | SubscriptionBlockedException
      | PlanLimitException
      | FeatureUnavailableException
      | MenuUnavailableException,
    request: Request,
    response: Response,
  ): void {
    const locale = request.locale ?? 'ar';
    const t = (key: string, args?: Record<string, unknown>): string =>
      this.i18n.t(`common.billing.${key}`, { lang: locale, args });
    const isHtmx = request.headers['hx-request'] === 'true';
    const wantsJson = !isHtmx && request.accepts(['html', 'json']) === 'json';

    if (exception instanceof MenuUnavailableException) {
      response.setHeader('Retry-After', '3600');
      if (wantsJson) {
        response.status(503).json({ statusCode: 503, code: 'MENU_UNAVAILABLE' });
      } else {
        response.status(503).render('pages/errors/menu-unavailable', { statusCode: 503 });
      }
      return;
    }

    let code = 'SUBSCRIPTION_BLOCKED';
    let kind = 'blocked';
    let message = t('blockedToast');
    if (exception instanceof PlanLimitException) {
      code = 'PLAN_LIMIT';
      kind = 'limit';
      message = t(`limit.${exception.resource}`, { limit: exception.limit });
    } else if (exception instanceof FeatureUnavailableException) {
      code = 'FEATURE_UNAVAILABLE';
      kind = 'feature';
      message = t('featureUnavailable');
    }

    if (isHtmx) {
      response.setHeader(
        'HX-Trigger',
        JSON.stringify({ toast: { message: encodeURIComponent(message), variant: 'danger' } }),
      );
      response.status(HttpStatus.PAYMENT_REQUIRED).send('');
      return;
    }
    if (wantsJson) {
      response.status(HttpStatus.PAYMENT_REQUIRED).json({ statusCode: 402, code, message });
      return;
    }
    response
      .status(HttpStatus.PAYMENT_REQUIRED)
      .render('pages/errors/billing', { statusCode: 402, kind, message });
  }

  private respondValidationFailure(
    exception: ValidationFailedException,
    request: Request,
    response: Response,
  ): void {
    const locale = request.locale ?? 'ar';
    const t = (key: string): string => this.i18n.t(`common.validation.${key}`, { lang: locale });
    const errors: Record<string, string[]> = {};
    for (const [field, keys] of Object.entries(exception.fieldErrors)) {
      errors[field] = keys.map(t);
    }
    const summary = t('summary');

    // The login form is the one plain HTML form: re-render it in place
    // with the message under each field and the typed email kept.
    if (request.method === 'POST' && request.path === '/admin/login') {
      const redirect = exception.values.redirect;
      response.status(HttpStatus.UNPROCESSABLE_ENTITY).render('admin/login', {
        redirect:
          typeof redirect === 'string' && redirect.startsWith('/admin') ? redirect : '/admin',
        email: typeof exception.values.email === 'string' ? exception.values.email : '',
        error: summary,
        fieldErrors: Object.fromEntries(Object.entries(errors).map(([f, m]) => [f, m[0]])),
      });
      return;
    }

    // htmx does not swap a 4xx response, so the form on screen keeps what
    // was typed. public/js/form-errors.js reads this body and marks the
    // fields; the toast covers anything it cannot place.
    if (request.headers['hx-request'] === 'true') {
      response.setHeader(
        'HX-Trigger',
        JSON.stringify({ toast: { message: encodeURIComponent(summary), variant: 'danger' } }),
      );
    }
    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: 'Unprocessable Entity',
      message: summary,
      errors,
    });
  }
}
