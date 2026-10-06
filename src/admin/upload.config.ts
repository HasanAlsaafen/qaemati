import { BadRequestException } from '@nestjs/common';
import { diskStorage, memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ITEM_IMAGE_UPLOAD_DIR = join(__dirname, '..', '..', 'public', 'uploads', 'items');
export const RESTAURANT_IMAGE_UPLOAD_DIR = join(
  __dirname,
  '..',
  '..',
  'public',
  'uploads',
  'restaurants',
);

export const itemImageMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: ITEM_IMAGE_UPLOAD_DIR,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new BadRequestException('INVALID_IMAGE_TYPE'), false);
      return;
    }
    callback(null, true);
  },
};

/// A4: restaurant logo/cover uploads share the item image rules (same
/// allowed types, same size cap) but write to their own directory so a
/// restaurant's branding assets don't mix with its menu item photos.
export const restaurantImageMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: RESTAURANT_IMAGE_UPLOAD_DIR,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new BadRequestException('INVALID_IMAGE_TYPE'), false);
      return;
    }
    callback(null, true);
  },
};

/// B3: CSV import -- kept in memory (no disk write) since it's parsed
/// and discarded in one request; browsers send a variety of mime types
/// for .csv (text/csv, application/vnd.ms-excel, or the generic
/// octet-stream), so this checks the extension instead of trusting the
/// mime type.
const CSV_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const csvImportMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: CSV_MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      callback(new BadRequestException('INVALID_FILE_TYPE'), false);
      return;
    }
    callback(null, true);
  },
};
