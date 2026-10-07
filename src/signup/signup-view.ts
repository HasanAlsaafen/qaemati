import { SignupService } from './signup.service';

/** What the sign up page needs. Passwords are never sent back to the page. */
export async function signupFormView(
  signup: SignupService,
  values: Record<string, unknown> = {},
  fieldErrors: Record<string, string> = {},
  error?: string,
) {
  const {
    password: _password,
    confirm: _confirm,
    csrf_token: _csrf,
    website: _website,
    ...safe
  } = values;
  void _password;
  void _confirm;
  void _csrf;
  void _website;
  const plans = await signup.plans();
  return {
    plans: plans.map((plan) => ({
      id: plan.id,
      nameAr: plan.nameAr,
      nameEn: plan.nameEn,
      price: Number(plan.priceAmount).toFixed(2).replace(/\.00$/, ''),
      currency: plan.currency,
      interval: plan.interval === 'YEARLY' ? 'year' : 'month',
      trialDays: plan.trialDays,
    })),
    values: safe,
    fieldErrors,
    error,
  };
}
