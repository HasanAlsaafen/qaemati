/**
 * Normalizes text for instant search matching: strips Arabic diacritics,
 * folds alef and taa marbuta variants to one form, lowercases Latin text.
 * The public menu's client-side search (public/js/menu.js) re-implements
 * this exact logic on the typed query; both sides must stay in sync since
 * matching happens by comparing normalized strings.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[ً-ْٰ]/g, '') // diacritics (tashkeel)
    .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ -> ا
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/ى/g, 'ي') // ى -> ي
    .toLowerCase()
    .trim();
}
