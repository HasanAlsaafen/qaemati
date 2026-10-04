import { I18nService } from 'nestjs-i18n';
import { Locale } from '../common/middleware/locale-view.middleware';

/**
 * Public-menu strings needed inside imported Nunjucks macros (the
 * selection bar/sheet, menu item card). Same reasoning as
 * admin/admin-labels.ts: a macro imported via `{% from %}` can't see the
 * calling template's `t` global, so every string it needs has to arrive
 * as an explicit argument -- resolving them all here once per request is
 * simpler than threading a dozen individual strings through macro
 * signatures.
 */
export function buildMenuLabels(i18n: I18nService, locale: Locale) {
  const t = (key: string, args?: Record<string, unknown>) => i18n.t(key, { lang: locale, args });

  return {
    selection: {
      addButton: t('common.menu.selection.addButton'),
      barLabel: t('common.menu.selection.barLabel'),
      title: t('common.menu.selection.title'),
      emptyTitle: t('common.menu.selection.emptyTitle'),
      emptyDescription: t('common.menu.selection.emptyDescription'),
      quantityLabel: t('common.menu.selection.quantityLabel'),
      decreaseAriaLabel: t('common.menu.selection.decreaseAriaLabel'),
      increaseAriaLabel: t('common.menu.selection.increaseAriaLabel'),
      removeAriaLabel: t('common.menu.selection.removeAriaLabel'),
      noteLabel: t('common.menu.selection.noteLabel'),
      notePlaceholder: t('common.menu.selection.notePlaceholder'),
      totalLabel: t('common.menu.selection.totalLabel'),
      sendButton: t('common.menu.selection.sendButton'),
      disclaimer: t('common.menu.selection.disclaimer'),
      clearButton: t('common.menu.selection.clearButton'),
      noWhatsappNotice: t('common.menu.selection.noWhatsappNotice'),
      addedToast: t('common.menu.selection.addedToast'),
      messageTableLine: t('common.menu.selection.messageTableLine'),
      messageNoteLine: t('common.menu.selection.messageNoteLine'),
      messageTotalLine: t('common.menu.selection.messageTotalLine'),
      messageItemLine: t('common.menu.selection.messageItemLine'),
    },
  };
}

export type MenuLabels = ReturnType<typeof buildMenuLabels>;
