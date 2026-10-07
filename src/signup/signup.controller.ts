import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { getBaseUrl } from '../seo/seo';
import { SignupDto } from './dto/signup.dto';
import { SignupService } from './signup.service';
import { SignupValidationFilter } from './signup-validation.filter';
import { signupFormView } from './signup-view';

/** A person filling the form faster than this is a script, not a person. */
const minFillMs = (): number => Number(process.env.SIGNUP_MIN_FILL_MS ?? 2500);

@Controller('signup')
@UseFilters(SignupValidationFilter)
export class SignupController {
  constructor(
    private readonly signup: SignupService,
    private readonly i18n: I18nService,
  ) {}

  private async requireAvailable(): Promise<void> {
    if (!(await this.signup.available())) throw new NotFoundException();
  }

  @Get()
  async form(@Query('plan') plan: string | undefined, @Req() req: Request, @Res() res: Response) {
    await this.requireAvailable();
    req.session.signupStartedAt = Date.now();
    res.render('pages/signup', await signupFormView(this.signup, plan ? { planId: plan } : {}));
  }

  @Post()
  async submit(@Body() body: SignupDto, @Req() req: Request, @Res() res: Response) {
    await this.requireAvailable();
    const lang = req.locale === 'en' ? 'en' : 'ar';
    const sent = () =>
      res
        .status(HttpStatus.OK)
        .render('pages/signup-sent', { email: body.email.trim().toLowerCase() });

    // A bot fills the hidden field or posts at once. It is told it worked and nothing happens.
    const startedAt = req.session.signupStartedAt ?? 0;
    if (body.website || Date.now() - startedAt < minFillMs()) return sent();

    const problem = await this.signup.request(body, {
      ip: req.ip ?? 'unknown',
      baseUrl: getBaseUrl(req),
      locale: lang,
    });
    if (!problem) {
      delete req.session.signupStartedAt;
      return sent();
    }
    const message = this.i18n.t(`common.signup.errors.${problem.key}`, { lang });
    const status =
      problem.key === 'tooMany'
        ? HttpStatus.TOO_MANY_REQUESTS
        : problem.key === 'mailDown'
          ? HttpStatus.SERVICE_UNAVAILABLE
          : HttpStatus.UNPROCESSABLE_ENTITY;
    const fieldErrors = problem.field === 'form' ? {} : { [problem.field]: message };
    res
      .status(status)
      .render(
        'pages/signup',
        await signupFormView(
          this.signup,
          { ...body },
          fieldErrors,
          problem.field === 'form' ? message : this.i18n.t('common.validation.summary', { lang }),
        ),
      );
  }

  /** The link in the email only shows a button. Opening it (an email scanner does) creates nothing. */
  @Get('verify/:token')
  async confirm(@Param('token') token: string, @Res() res: Response) {
    const request = await this.signup.peek(token);
    if (!request) return res.status(HttpStatus.GONE).render('pages/signup-verify', { gone: true });
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.render('pages/signup-verify', { token, request });
  }

  @Post('verify/:token')
  async create(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    const result = await this.signup.complete(token);
    if (result === 'gone')
      return res.status(HttpStatus.GONE).render('pages/signup-verify', { gone: true });
    if (result === 'taken')
      return res.status(HttpStatus.CONFLICT).render('pages/signup-verify', { taken: true });

    // Signed in as the new owner, with the first login tour waiting.
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.adminUserId = result.ownerId;
    req.session.restaurantId = result.restaurant.id;
    req.session.restaurantSlug = result.restaurant.slug;
    req.session.adminName = result.ownerName;
    req.session.adminRole = 'OWNER';
    req.session.hasSeenTour = false;
    req.session.save((err) => {
      if (err) throw err;
      res.redirect(303, '/admin');
    });
  }
}
