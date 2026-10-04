import { I18nService } from 'nestjs-i18n';
import { Locale } from '../common/middleware/locale-view.middleware';

/**
 * All translated strings the admin component macros need, built once per
 * request and threaded through as a single `labels` argument. Nunjucks
 * macros imported from another file can't see the calling template's
 * globals (verified: `t` is undefined inside an imported macro, and a
 * `{% set %}` inside an `{% include %}` doesn't leak out to the caller
 * either) -- so resolving every string server-side, in one place, is
 * simpler than threading a dozen individual string parameters through
 * every macro signature.
 */
export function buildAdminLabels(i18n: I18nService, locale: Locale, defaultCurrency = 'ILS') {
  const t = (key: string, args?: Record<string, unknown>) => i18n.t(key, { lang: locale, args });

  return {
    defaultCurrency,
    form: {
      save: t('common.admin.form.save'),
      cancel: t('common.admin.form.cancel'),
      add: t('common.admin.form.add'),
      edit: t('common.admin.form.edit'),
      delete: t('common.admin.form.delete'),
      nameAr: t('common.admin.form.nameArLabel'),
      nameEn: t('common.admin.form.nameEnLabel'),
      descriptionAr: t('common.admin.form.descriptionArLabel'),
      descriptionEn: t('common.admin.form.descriptionEnLabel'),
      price: t('common.admin.form.priceLabel'),
      currency: t('common.admin.form.currencyLabel'),
      available: t('common.admin.form.availableLabel'),
      image: t('common.admin.form.imageLabel'),
      tags: t('common.admin.form.tagsLabel'),
      moveUp: t('common.admin.form.moveUp'),
      moveDown: t('common.admin.form.moveDown'),
    },
    categories: {
      title: t('common.admin.categories.title'),
      addCategory: t('common.admin.categories.addCategory'),
      emptyTitle: t('common.admin.categories.emptyTitle'),
      emptyDescription: t('common.admin.categories.emptyDescription'),
      deleteConfirmTitle: t('common.admin.categories.deleteConfirmTitle'),
      deleteConfirmBody: t('common.admin.categories.deleteConfirmBody'),
      availableFromLabel: t('common.admin.categories.availableFromLabel'),
      availableToLabel: t('common.admin.categories.availableToLabel'),
      availabilityHint: t('common.admin.categories.availabilityHint'),
    },
    items: {
      addItem: t('common.admin.items.addItem'),
      emptyTitle: t('common.admin.items.emptyTitle'),
      emptyDescription: t('common.admin.items.emptyDescription'),
      deleteConfirmTitle: t('common.admin.items.deleteConfirmTitle'),
      deleteConfirmBody: t('common.admin.items.deleteConfirmBody'),
      variantsLabel: t('common.admin.items.variantsLabel'),
      variantsHint: t('common.admin.items.variantsHint'),
      addVariant: t('common.admin.items.addVariant'),
      addonsLabel: t('common.admin.items.addonsLabel'),
      addonsHint: t('common.admin.items.addonsHint'),
      addAddon: t('common.admin.items.addAddon'),
      removeOption: t('common.admin.items.removeOption'),
      todaysSpecialLabel: t('common.admin.items.todaysSpecialLabel'),
    },
    tags: {
      SPICY: t('common.tags.spicy'),
      VEGETARIAN: t('common.tags.vegetarian'),
      NEW: t('common.tags.new'),
      POPULAR: t('common.tags.popular'),
    },
    qr: {
      title: t('common.admin.qr.title'),
      generalTitle: t('common.admin.qr.generalTitle'),
      generalCaption: t('common.admin.qr.generalCaption'),
      tablesTitle: t('common.admin.qr.tablesTitle'),
      tableLabel: t('common.admin.qr.tableLabel'),
      addTable: t('common.admin.qr.addTable'),
      emptyTitle: t('common.admin.qr.emptyTitle'),
      emptyDescription: t('common.admin.qr.emptyDescription'),
      deleteConfirmTitle: t('common.admin.qr.deleteConfirmTitle'),
      deleteConfirmBody: t('common.admin.qr.deleteConfirmBody'),
      savedToast: t('common.admin.qr.savedToast'),
      addedToast: t('common.admin.qr.addedToast'),
      deletedToast: t('common.admin.qr.deletedToast'),
      printAll: t('common.admin.qr.printAll'),
      printButton: t('common.admin.qr.printButton'),
      scanToView: t('common.admin.qr.scanToView'),
      downloadLinkLabel: t('common.admin.qr.downloadLinkLabel'),
    },
    branding: {
      title: t('common.admin.branding.title'),
      detailsTitle: t('common.admin.branding.detailsTitle'),
      whatsappLabel: t('common.admin.branding.whatsappLabel'),
      instagramLabel: t('common.admin.branding.instagramLabel'),
      workingHoursArLabel: t('common.admin.branding.workingHoursArLabel'),
      workingHoursEnLabel: t('common.admin.branding.workingHoursEnLabel'),
      openTimeLabel: t('common.admin.branding.openTimeLabel'),
      closeTimeLabel: t('common.admin.branding.closeTimeLabel'),
      hoursHint: t('common.admin.branding.hoursHint'),
      currencyLabel: t('common.admin.branding.currencyLabel'),
      currencyHint: t('common.admin.branding.currencyHint'),
      appearanceTitle: t('common.admin.branding.appearanceTitle'),
      primaryColorLabel: t('common.admin.branding.primaryColorLabel'),
      primaryColorHint: t('common.admin.branding.primaryColorHint'),
      resetColor: t('common.admin.branding.resetColor'),
      previewLabel: t('common.admin.branding.previewLabel'),
      previewButtonText: t('common.admin.branding.previewButtonText'),
      logoLabel: t('common.admin.branding.logoLabel'),
      coverImageLabel: t('common.admin.branding.coverImageLabel'),
      // Raw, uninterpolated templates for the client-side live contrast
      // check (public/js/color-contrast.js) -- same pattern as
      // menu-labels.ts's openStatus templates.
      contrastPassTemplate: t('common.admin.branding.contrastPassLabel'),
      contrastFailTemplate: t('common.admin.branding.contrastFailLabel'),
    },
    unavailable: t('common.menu.unavailable'),
  };
}

export type AdminLabels = ReturnType<typeof buildAdminLabels>;
