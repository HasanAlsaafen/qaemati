import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ValidationFailedException } from '../common/validation/validation-failed.exception';
import { SignupService } from './signup.service';
import { signupFormView } from './signup-view';

/** A sign up form with something wrong goes back to the same form, with the messages and what was typed. */
@Catch(ValidationFailedException)
export class SignupValidationFilter implements ExceptionFilter {
  constructor(
    private readonly signup: SignupService,
    private readonly i18n: I18nService,
  ) {}

  async catch(exception: ValidationFailedException, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const lang = req.locale ?? 'ar';
    const errors: Record<string, string> = {};
    for (const [field, keys] of Object.entries(exception.fieldErrors)) {
      errors[field] = this.i18n.t(`common.validation.${keys[0]}`, { lang });
    }
    res
      .status(HttpStatus.UNPROCESSABLE_ENTITY)
      .render(
        'pages/signup',
        await signupFormView(
          this.signup,
          exception.values,
          errors,
          this.i18n.t('common.validation.summary', { lang }),
        ),
      );
  }
}
