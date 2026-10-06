import { I18nService } from 'nestjs-i18n';
import { Locale } from '../common/middleware/locale-view.middleware';
import { ALL_TAGS, TAG_I18N_KEY } from '../common/tags';

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
    fromPrice: t('common.menu.fromPrice'),
    selectVariant: t('common.menu.selectVariant'),
    addonsTitle: t('common.menu.addonsTitle'),
    selectVariantPrompt: t('common.menu.selectVariantPrompt'),
    todaysSpecial: t('common.menu.todaysSpecial'),
    allergenNoteLabel: t('common.menu.allergenNoteLabel'),
    filter: {
      buttonLabel: t('common.menu.filter.buttonLabel'),
      title: t('common.menu.filter.title'),
      clearButton: t('common.menu.filter.clearButton'),
      closeLabel: t('common.menu.close'),
      // B1: every ItemTag, for the filter sheet's checkbox list --
      // built from the same ALL_TAGS/TAG_I18N_KEY source item cards
      // and the admin tag checkboxes already use, so a new tag added
      // there automatically gets a filter option here too.
      tagOptions: ALL_TAGS.map((code) => ({ code, label: t(TAG_I18N_KEY[code]) })),
    },
    share: {
      buttonLabel: t('common.menu.share.buttonLabel'),
      copied: t('common.menu.share.copied'),
    },
    pwa: {
      installButton: t('common.menu.pwa.installButton'),
      offlineBanner: t('common.menu.pwa.offlineBanner'),
    },
    // Raw templates (the literal "{time}" placeholder left
    // uninterpolated) for the client-side ticking open/closed badge
    // (restaurant-header.njk + public/js/open-status.js) to substitute
    // into on its own every 60s -- the server-rendered label passed via
    // menu.openStatus.label is already interpolated for the moment the
    // page was rendered.
    openStatus: {
      openUntil: t('common.menu.openStatus.openUntil'),
      closedUntil: t('common.menu.openStatus.closedUntil'),
    },
    selection: {
      addButton: t('common.menu.selection.addButton'),
      barLabel: t('common.menu.selection.barLabel'),
      closeLabel: t('common.menu.close'),
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
