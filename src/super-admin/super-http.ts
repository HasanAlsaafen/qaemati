import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { Flash } from '../auth/session.types';
import { PlanLimitException } from '../tenancy/tenancy.exceptions';
import { Actor } from './audit.service';
import { FieldError } from './field-error';

export function actorOf(req: Request): Actor {
  return { id: req.session.superAdminId as string, label: req.session.superAdminName ?? '' };
}

export function translate(
  i18n: I18nService,
  req: Request,
  key: string,
  args?: Record<string, unknown>,
): string {
  return i18n.t(`common.${key}`, { lang: req.locale ?? 'ar', args });
}

export function flashSuccess(
  req: Request,
  i18n: I18nService,
  key: string,
  secret?: Flash['secret'],
): void {
  req.session.flash = {
    type: 'success',
    message: translate(i18n, req, `super.flash.${key}`),
    secret,
  };
}

/** Sends the user back to the form with a message under the field that is wrong. */
export function failField(
  req: Request,
  res: Response,
  i18n: I18nService,
  back: string,
  error: FieldError,
  values: Record<string, unknown> = {},
): void {
  req.session.flash = {
    type: 'danger',
    message: translate(i18n, req, 'validation.summary'),
    errors: { [error.field]: translate(i18n, req, `super.errors.${error.key}`) },
    values,
  };
  res.redirect(303, back);
}

export function failLimit(
  req: Request,
  res: Response,
  i18n: I18nService,
  back: string,
  error: PlanLimitException,
): void {
  req.session.flash = {
    type: 'danger',
    message: translate(i18n, req, `billing.limit.${error.resource}`, { limit: error.limit }),
  };
  res.redirect(303, back);
}

/** Never put a typed password back into the page. */
export function safeValues(body: object): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...body };
  delete copy.password;
  delete copy.csrf_token;
  return copy;
}
