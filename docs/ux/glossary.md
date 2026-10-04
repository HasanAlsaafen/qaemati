# Bilingual UI glossary

Locks one Arabic term per concept so new features (Packs A/B) don't drift — e.g. "selection"
must not become "طلب" (order) in one screen and "اختيار" (choice) in another. Arabic terms are
written natively, not transliterated or word-for-word translated from English; tone is warm,
modern standard Arabic, matching the existing admin/menu copy (see examples pulled from
`i18n/ar/common.json`).

## Established terms (already in the product — do not change)

| Concept | English | Arabic | Notes |
|---|---|---|---|
| Category | Category | قسم | Not فئة (too clinical/academic register) |
| Item | Item | عنصر | |
| Table (QR) | Table | طاولة | |
| Available / unavailable | Available / Currently unavailable | متوفر / غير متوفر حاليًا | |
| Admin login | Log In | تسجيل الدخول | |
| Save | Save | حفظ | |
| Delete (action) | Delete | حذف | |
| Edit | Edit | تعديل | |
| Add | Add | إضافة | |
| Cancel | Cancel | إلغاء | |
| Move up/down | Move up / Move down | نقل لأعلى / نقل لأسفل | |
| Price | Price | السعر | |
| Currency | Currency | العملة | |
| Tag (Spicy/Vegetarian/New/Popular) | Tags | الوسوم | |
| Preview menu | Preview menu | معاينة القائمة | |
| QR & print | QR & print | رمز QR والطباعة | |

## New terms needed for Phases 9–11

| Concept | English | Arabic | Why this choice |
|---|---|---|---|
| Selection (A1, the customer's tap-to-build list) | My selection | طلبي | Deliberately **not** طلبي-as-order in the ordering-platform sense — the UI label must still make clear via surrounding copy ("a message to the restaurant, not an online order") that this isn't a transactional order. Using سلتي ("my basket/cart") was considered but reads as e-commerce, which is the wrong mental model for a WhatsApp message. "طلبي" here is used in its plain sense of "my request," paired with explicit microcopy disclaiming online ordering. |
| Send via WhatsApp | Send on WhatsApp | إرسال عبر واتساب | |
| Note (optional note on the selection) | Note (optional) | ملاحظة (اختياري) | |
| Variant / size | Size | الحجم | For size-based variants specifically; a generic "variant" concept, if ever more than size, becomes خيار (option) |
| Add-on / extra | Extra | إضافة | Reuses the existing "إضافة" (add) root deliberately — an add-on *is* an addition; context (appearing under an item, with a price) disambiguates it from the verb "Add" |
| Today's special | Today's special | عرض اليوم | عرض = "offer/showcase," reads naturally as a daily highlight, not a discount |
| Open now / closed | Open now / Closed | مفتوح الآن / مغلق | |
| Closes at / Opens at | Closes at {time} / Opens at {time} | يُغلق الساعة {time} / يفتح الساعة {time} | Time value itself stays Western numerals per the numerals rule in `principles.md` |
| Branding (admin section) | Branding | الهوية البصرية | Literally "visual identity" — more accurate than a literal "علامة تجارية" (brand/trademark), which overstates what a small cafe owner is doing here |
| Primary color | Primary color | اللون الأساسي | |
| Cover image | Cover image | صورة الغلاف | |
| Demo mode | Try the admin panel | جرّب لوحة التحكم | Action-oriented, not a label — matches "Try it" conventions better than a literal "وضع تجريبي" (demo mode) as the user-facing button text; "demo mode" as a concept stays internal/technical |
| Reset demo data | Reset demo data | إعادة تعيين البيانات التجريبية | |
| Guided tour | Quick tour | جولة سريعة | "Quick" signals it's short and skippable, matching the 3–5 step/skippable requirement |
| Dietary tag: vegetarian | Vegetarian | نباتي | |
| Dietary tag: vegan | Vegan | نباتي صرف | "Vegan" has no single traditional Arabic term; نباتي صرف ("strictly vegetarian/plant-only") is the common modern usage, clearer than transliterating "فيغان" for a general audience |
| Dietary tag: gluten-free | Gluten-free | خالٍ من الغلوتين | |
| Dietary tag: contains nuts | Contains nuts | يحتوي على مكسرات | |
| Dietary tag: dairy | Contains dairy | يحتوي على منتجات الألبان | |
| Allergen note (owner-editable) | Allergen note | ملاحظة حول الحساسية الغذائية | |
| Filter (sheet) | Filter | تصفية | |
| Analytics (admin section) | Analytics | الإحصائيات | |
| Menu views / scans | Menu views | مشاهدات القائمة | "Views," not "scans," as the user-facing label — a view can happen via the general QR, a table QR, or a shared link, so "scans" would be narrower than what's actually counted |
| Most viewed items | Most viewed | الأكثر مشاهدة | |
| Last 7 / 30 days | Last 7 days / Last 30 days | آخر 7 أيام / آخر 30 يومًا | |
| Bulk tools (admin section) | Bulk tools | أدوات جماعية | |
| CSV import/export | Import / Export | استيراد / تصدير | |
| Duplicate (item) | Duplicate | تكرار | |
| Price change (bulk, %) | Change prices | تعديل الأسعار | |
| Undo | Undo | تراجع | |
| Share | Share | مشاركة | |
| Add to Home Screen (PWA) | Add to Home Screen | إضافة إلى الشاشة الرئيسية | Matches the platform-native Arabic string Android/iOS already use, for recognition (Jakob's Law) |
| Offline (PWA fallback state) | You're offline | أنت غير متصل بالإنترنت | |

## Rules for adding a new term

1. Check this table first — if the concept already has a locked term, reuse it; don't introduce
   a synonym.
2. Write the Arabic from the concept, not by translating the English string — if the English and
   Arabic reviewer would phrase it differently because that's how each language naturally says
   it, that's correct, not an inconsistency.
3. Every new term gets added here in the same commit that adds it to `i18n/ar/common.json` /
   `i18n/en/common.json`, so the table never drifts out of date with the actual strings.
