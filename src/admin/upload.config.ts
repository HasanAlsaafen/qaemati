import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
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
