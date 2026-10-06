-- The logo is now the placeholder for dishes and categories without a photo,
-- so the between-dishes divider setting no longer exists.
ALTER TABLE "Restaurant" DROP COLUMN "itemDivider";
