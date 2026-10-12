CREATE TABLE "BrandTheme" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "fontTheme" TEXT NOT NULL,
    "cornerStyle" TEXT NOT NULL,
    "cardStyle" TEXT NOT NULL,
    "buttonShape" TEXT NOT NULL,
    "categoryDivider" TEXT NOT NULL,
    "categoryMarker" TEXT NOT NULL,
    "headingAlign" TEXT NOT NULL,
    "priceStyle" TEXT NOT NULL,
    "backgroundStyle" TEXT NOT NULL,
    "backgroundPattern" TEXT NOT NULL,
    "themeDecor" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandTheme_key_key" ON "BrandTheme"("key");

-- The themes that shipped with the product. The platform owner edits them from
-- the platform area, so they are rows, not code.
INSERT INTO "BrandTheme" ("id","key","nameAr","nameEn","descriptionAr","descriptionEn","primaryColor","secondaryColor","backgroundColor","fontTheme","cornerStyle","cardStyle","buttonShape","categoryDivider","categoryMarker","headingAlign","priceStyle","backgroundStyle","backgroundPattern","themeDecor","sortOrder","updatedAt") VALUES ('builtin-classic', 'classic', 'كلاسيكي', 'Classic', 'المظهر النظيف اليومي.', 'The clean everyday look.', '#1565C0', '#FF9800', '#F2F9FA', 'classic', 'rounded', 'flat', 'rounded', 'none', 'none', 'start', 'plain', 'solid', 'dots', 'none', 0, CURRENT_TIMESTAMP);
INSERT INTO "BrandTheme" ("id","key","nameAr","nameEn","descriptionAr","descriptionEn","primaryColor","secondaryColor","backgroundColor","fontTheme","cornerStyle","cardStyle","buttonShape","categoryDivider","categoryMarker","headingAlign","priceStyle","backgroundStyle","backgroundPattern","themeDecor","sortOrder","updatedAt") VALUES ('builtin-ramadan', 'ramadan', 'رمضان', 'Ramadan', 'نيلي عميق وذهبي، خط خطّي وخلفية شبكية.', 'Deep indigo and gold, calligraphic type, a lattice background.', '#2E3A87', '#C9971C', '#FFF9EC', 'naskh', 'soft', 'outlined', 'pill', 'ornament', 'rule', 'center', 'badge', 'pattern', 'diamonds', 'ramadan', 1, CURRENT_TIMESTAMP);
INSERT INTO "BrandTheme" ("id","key","nameAr","nameEn","descriptionAr","descriptionEn","primaryColor","secondaryColor","backgroundColor","fontTheme","cornerStyle","cardStyle","buttonShape","categoryDivider","categoryMarker","headingAlign","priceStyle","backgroundStyle","backgroundPattern","themeDecor","sortOrder","updatedAt") VALUES ('builtin-eidFitr', 'eidFitr', 'عيد الفطر', 'Eid Al-Fitr', 'أخضر احتفالي وذهبي مع بطاقات مستديرة بهيجة.', 'Festive green and gold with rounded, joyful cards.', '#0E7C5A', '#E0A526', '#F4FBF5', 'cairo', 'soft', 'raised', 'pill', 'fade', 'dot', 'center', 'badge', 'pattern', 'polka', 'eidFitr', 2, CURRENT_TIMESTAMP);
INSERT INTO "BrandTheme" ("id","key","nameAr","nameEn","descriptionAr","descriptionEn","primaryColor","secondaryColor","backgroundColor","fontTheme","cornerStyle","cardStyle","buttonShape","categoryDivider","categoryMarker","headingAlign","priceStyle","backgroundStyle","backgroundPattern","themeDecor","sortOrder","updatedAt") VALUES ('builtin-eidAdha', 'eidAdha', 'عيد الأضحى', 'Eid Al-Adha', 'قرميدي دافئ ورملي مع خط ذي زوائد.', 'Warm terracotta and sand with a serif face.', '#8B3A1E', '#D4A24C', '#FDF4EA', 'serif', 'soft', 'outlined', 'rounded', 'double', 'rule', 'center', 'plain', 'pattern', 'waves', 'eidAdha', 3, CURRENT_TIMESTAMP);
INSERT INTO "BrandTheme" ("id","key","nameAr","nameEn","descriptionAr","descriptionEn","primaryColor","secondaryColor","backgroundColor","fontTheme","cornerStyle","cardStyle","buttonShape","categoryDivider","categoryMarker","headingAlign","priceStyle","backgroundStyle","backgroundPattern","themeDecor","sortOrder","updatedAt") VALUES ('builtin-olive', 'olive', 'موسم الزيتون', 'Olive harvest', 'زيتوني وكهرماني ترابي، هادئ وطبيعي.', 'Earthy olive and amber, calm and natural.', '#566B2D', '#C47F1A', '#F7F5EC', 'almarai', 'rounded', 'flat', 'rounded', 'dotted', 'underline', 'start', 'muted', 'solid', 'dots', 'olive', 4, CURRENT_TIMESTAMP);
INSERT INTO "BrandTheme" ("id","key","nameAr","nameEn","descriptionAr","descriptionEn","primaryColor","secondaryColor","backgroundColor","fontTheme","cornerStyle","cardStyle","buttonShape","categoryDivider","categoryMarker","headingAlign","priceStyle","backgroundStyle","backgroundPattern","themeDecor","sortOrder","updatedAt") VALUES ('builtin-summer', 'summer', 'الصيف', 'Summer', 'أزرق بحري ومرجاني، مشرق وخفيف.', 'Sea blue and coral, bright and breezy.', '#0B7FAB', '#FF7A59', '#F0FAFD', 'cairo', 'rounded', 'raised', 'pill', 'zigzag', 'dot', 'start', 'badge', 'pattern', 'waves', 'summer', 5, CURRENT_TIMESTAMP);
INSERT INTO "BrandTheme" ("id","key","nameAr","nameEn","descriptionAr","descriptionEn","primaryColor","secondaryColor","backgroundColor","fontTheme","cornerStyle","cardStyle","buttonShape","categoryDivider","categoryMarker","headingAlign","priceStyle","backgroundStyle","backgroundPattern","themeDecor","sortOrder","updatedAt") VALUES ('builtin-winter', 'winter', 'الشتاء', 'Winter', 'رمادي بارد وتوتي، هادئ ومرتب.', 'Cool slate and berry, quiet and tidy.', '#3F5F7A', '#B5483B', '#F4F6F8', 'modern', 'soft', 'outlined', 'rounded', 'line', 'bar', 'start', 'plain', 'pattern', 'lines', 'winter', 6, CURRENT_TIMESTAMP);
INSERT INTO "BrandTheme" ("id","key","nameAr","nameEn","descriptionAr","descriptionEn","primaryColor","secondaryColor","backgroundColor","fontTheme","cornerStyle","cardStyle","buttonShape","categoryDivider","categoryMarker","headingAlign","priceStyle","backgroundStyle","backgroundPattern","themeDecor","sortOrder","updatedAt") VALUES ('builtin-evening', 'evening', 'السهرة', 'Evening', 'كحلي ليلي ونحاسي، حاد وأنيق.', 'Midnight navy and brass, sharp and elegant.', '#1F2A44', '#B08D57', '#FAF7F2', 'serif', 'sharp', 'outlined', 'square', 'double', 'rule', 'center', 'muted', 'solid', 'dots', 'evening', 7, CURRENT_TIMESTAMP);
