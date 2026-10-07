import { MailMessage } from '../mail/mail.service';
import { NoticeKind } from './notice-rules';

export interface NoticeContext {
  restaurantAr: string;
  restaurantEn: string;
  planAr: string;
  planEn: string;
  /** ISO dates, yyyy-mm-dd. */
  endsOn: string;
  offlineOn: string;
  daysLeft: number;
  /** Where to renew, or empty when the site address is not configured. */
  billingUrl: string;
  contact: string;
}

const esc = (value: string): string => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

interface Words {
  subject: string;
  lines: string[];
}

function english(kind: NoticeKind, c: NoticeContext): Words {
  switch (kind) {
    case 'trial_ending':
      return {
        subject: `Your free trial ends on ${c.endsOn}`,
        lines: [
          `The free trial of ${c.restaurantEn} ends on ${c.endsOn}, in ${c.daysLeft} ${c.daysLeft === 1 ? 'day' : 'days'}.`,
          `To keep your menu online, choose a plan before then. Nothing you created is ever deleted.`,
        ],
      };
    case 'expiring_7d':
    case 'expiring_1d':
      return {
        subject: `Your ${c.planEn} plan ends on ${c.endsOn}`,
        lines: [
          `The ${c.planEn} plan of ${c.restaurantEn} ends on ${c.endsOn}.`,
          `Renew before then and nothing changes for your guests. After that there is a grace period, and then the public menu goes offline.`,
        ],
      };
    case 'grace_started':
      return {
        subject: `Your plan ended on ${c.endsOn}: your menu stays online until ${c.offlineOn}`,
        lines: [
          `The plan of ${c.restaurantEn} ended on ${c.endsOn}.`,
          `Your menu stays online until ${c.offlineOn}. After that the public menu goes offline and your admin becomes read only. Your data is kept.`,
        ],
      };
    case 'menu_offline':
      return {
        subject: `Your menu is offline`,
        lines: [
          `The menu of ${c.restaurantEn} went offline on ${c.offlineOn} because the plan was not renewed.`,
          `Your data is safe. Renew and the menu comes back at once, with everything as you left it.`,
        ],
      };
  }
}

function arabic(kind: NoticeKind, c: NoticeContext): Words {
  switch (kind) {
    case 'trial_ending':
      return {
        subject: `تنتهي تجربتك المجانية في ${c.endsOn}`,
        lines: [
          `تنتهي التجربة المجانية لـ ${c.restaurantAr} في ${c.endsOn}، أي بعد ${c.daysLeft} ${c.daysLeft === 1 ? 'يوم' : 'أيام'}.`,
          `لإبقاء قائمتك ظاهرة اختر باقة قبل ذلك. لا يُحذف شيء أنشأته أبدا.`,
        ],
      };
    case 'expiring_7d':
    case 'expiring_1d':
      return {
        subject: `تنتهي باقة ${c.planAr} في ${c.endsOn}`,
        lines: [
          `تنتهي باقة ${c.planAr} الخاصة بـ ${c.restaurantAr} في ${c.endsOn}.`,
          `جدّد قبل ذلك فلا يتغير شيء على ضيوفك. بعد ذلك تأتي فترة سماح، ثم تتوقف القائمة العامة عن الظهور.`,
        ],
      };
    case 'grace_started':
      return {
        subject: `انتهت باقتك في ${c.endsOn}: تبقى قائمتك ظاهرة حتى ${c.offlineOn}`,
        lines: [
          `انتهت باقة ${c.restaurantAr} في ${c.endsOn}.`,
          `تبقى قائمتك ظاهرة حتى ${c.offlineOn}. بعد ذلك تتوقف القائمة العامة وتصبح لوحة الإدارة للقراءة فقط. بياناتك محفوظة.`,
        ],
      };
    case 'menu_offline':
      return {
        subject: `قائمتك متوقفة`,
        lines: [
          `توقفت قائمة ${c.restaurantAr} في ${c.offlineOn} لأن الباقة لم تُجدَّد.`,
          `بياناتك بأمان. جدّد فتعود القائمة فورا كما تركتها.`,
        ],
      };
  }
}

/** One message in both languages, Arabic first, since an owner's language is not stored. */
export function billingNoticeMail(to: string, kind: NoticeKind, c: NoticeContext): MailMessage {
  const ar = arabic(kind, c);
  const en = english(kind, c);
  const action = (label: string) => (c.billingUrl ? `${label}: ${c.billingUrl}` : '');
  const contactAr = c.contact ? `للتجديد تواصل معنا: ${c.contact}` : '';
  const contactEn = c.contact ? `To renew, contact us: ${c.contact}` : '';

  const text = [
    ...ar.lines,
    action('صفحة الاشتراك'),
    contactAr,
    '',
    '---',
    '',
    ...en.lines,
    action('Subscription page'),
    contactEn,
  ]
    .filter((line, index, all) => line !== '' || all[index - 1] !== '')
    .join('\n');

  const block = (dir: 'rtl' | 'ltr', lines: string[], label: string, contact: string) =>
    `<div dir="${dir}" style="margin:0 0 20px">${lines
      .map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`)
      .join('')}${
      c.billingUrl
        ? `<p style="margin:14px 0"><a href="${esc(c.billingUrl)}" style="background:#1565c0;color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none;display:inline-block">${esc(label)}</a></p>`
        : ''
    }${contact ? `<p style="margin:0;color:#5a6b75;font-size:13px">${esc(contact)}</p>` : ''}</div>`;

  const html = `<div style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b2a33">${block('rtl', ar.lines, 'صفحة الاشتراك', contactAr)}<hr style="border:0;border-top:1px solid #d8e2e6;margin:0 0 20px">${block('ltr', en.lines, 'Subscription page', contactEn)}</div>`;
  return { to, subject: `${ar.subject} | ${en.subject}`, text, html };
}

export interface ReceiptContext {
  restaurantAr: string;
  restaurantEn: string;
  receiptNo: string;
  amount: string;
  symbol: string;
  method: string;
  paidOn: string;
  periodStart: string;
  periodEnd: string;
  receiptUrl: string;
}

export function receiptMail(to: string, c: ReceiptContext): MailMessage {
  const arLines = [
    `استلمنا دفعتك لـ ${c.restaurantAr}. شكرا لك.`,
    `الإيصال ${c.receiptNo}: ${c.amount} ${c.symbol} بتاريخ ${c.paidOn}.`,
    `تغطي المدة من ${c.periodStart} إلى ${c.periodEnd}.`,
  ];
  const enLines = [
    `We received your payment for ${c.restaurantEn}. Thank you.`,
    `Receipt ${c.receiptNo}: ${c.amount} ${c.symbol} on ${c.paidOn}.`,
    `It covers ${c.periodStart} to ${c.periodEnd}.`,
  ];
  const text = [
    ...arLines,
    c.receiptUrl ? `الإيصال: ${c.receiptUrl}` : '',
    '',
    '---',
    '',
    ...enLines,
    c.receiptUrl ? `Receipt: ${c.receiptUrl}` : '',
  ]
    .filter((line, index, all) => line !== '' || all[index - 1] !== '')
    .join('\n');
  const block = (dir: 'rtl' | 'ltr', lines: string[], label: string) =>
    `<div dir="${dir}" style="margin:0 0 20px">${lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join('')}${
      c.receiptUrl
        ? `<p style="margin:14px 0"><a href="${esc(c.receiptUrl)}" style="background:#1565c0;color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none;display:inline-block">${esc(label)}</a></p>`
        : ''
    }</div>`;
  const html = `<div style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b2a33">${block('rtl', arLines, 'عرض الإيصال')}<hr style="border:0;border-top:1px solid #d8e2e6;margin:0 0 20px">${block('ltr', enLines, 'View receipt')}</div>`;
  return { to, subject: `إيصال ${c.receiptNo} | Receipt ${c.receiptNo}`, text, html };
}
