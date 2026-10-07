import { MailMessage } from './mail.service';

type Locale = 'ar' | 'en';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(locale: Locale, lines: string[], url: string, button: string, footer: string) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const paragraphs = lines.map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`).join('');
  return `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b2a33">${paragraphs}<p style="margin:20px 0"><a href="${escapeHtml(url)}" style="background:#1565c0;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(button)}</a></p><p style="margin:0 0 12px;color:#5a6b75;font-size:13px">${escapeHtml(url)}</p><p style="margin:0;color:#5a6b75;font-size:13px">${escapeHtml(footer)}</p></div>`;
}

export function resetPasswordMail(
  locale: Locale,
  to: string,
  name: string,
  url: string,
  minutes: number,
): MailMessage {
  const ar = locale === 'ar';
  const subject = ar ? 'إعادة تعيين كلمة المرور' : 'Reset your password';
  const lines = ar
    ? [
        `مرحبا ${name}،`,
        `وصلنا طلب لإعادة تعيين كلمة مرور حسابك. الرابط صالح لمدة ${minutes} دقيقة ويعمل مرة واحدة.`,
      ]
    : [
        `Hello ${name},`,
        `We received a request to reset your password. The link works once and expires in ${minutes} minutes.`,
      ];
  const button = ar ? 'اختيار كلمة مرور جديدة' : 'Choose a new password';
  const footer = ar
    ? 'إذا لم تطلب ذلك فتجاهل هذه الرسالة، ولن يتغير شيء.'
    : 'If you did not ask for this, ignore this message and nothing changes.';
  return {
    to,
    subject,
    text: `${lines.join('\n\n')}\n\n${url}\n\n${footer}`,
    html: layout(locale, lines, url, button, footer),
  };
}

export function inviteMail(
  locale: Locale,
  to: string,
  name: string,
  restaurant: string,
  url: string,
  days: number,
): MailMessage {
  const ar = locale === 'ar';
  const subject = ar
    ? `تم إنشاء حسابك في ${restaurant}`
    : `Your account for ${restaurant} is ready`;
  const lines = ar
    ? [
        `مرحبا ${name}،`,
        `تم إنشاء حساب لإدارة قائمة ${restaurant}. اختر كلمة مرورك من الرابط التالي، وهو صالح لمدة ${days} أيام.`,
      ]
    : [
        `Hello ${name},`,
        `An account was created for you to manage the menu of ${restaurant}. Choose your password with the link below, valid for ${days} days.`,
      ];
  const button = ar ? 'اختيار كلمة المرور' : 'Choose your password';
  const footer = ar
    ? 'إذا لم تتوقع هذه الرسالة فتجاهلها.'
    : 'If you did not expect this message, ignore it.';
  return {
    to,
    subject,
    text: `${lines.join('\n\n')}\n\n${url}\n\n${footer}`,
    html: layout(locale, lines, url, button, footer),
  };
}
