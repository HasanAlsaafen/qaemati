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
export function buildAdminLabels(i18n: I18nService, locale: Locale) {
  const t = (key: string, args?: Record<string, unknown>) => i18n.t(key, { lang: locale, args });

  return {
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
    },
    items: {
      addItem: t('common.admin.items.addItem'),
      emptyTitle: t('common.admin.items.emptyTitle'),
      emptyDescription: t('common.admin.items.emptyDescription'),
      deleteConfirmTitle: t('common.admin.items.deleteConfirmTitle'),
      deleteConfirmBody: t('common.admin.items.deleteConfirmBody'),
    },
    tags: {
      SPICY: t('common.tags.spicy'),
      VEGETARIAN: t('common.tags.vegetarian'),
      NEW: t('common.tags.new'),
      POPULAR: t('common.tags.popular'),
    },
    unavailable: t('common.menu.unavailable'),
  };
}

export type AdminLabels = ReturnType<typeof buildAdminLabels>;
