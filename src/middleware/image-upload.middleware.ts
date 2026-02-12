import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = 'uploads/images';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Use memory storage so we can process with sharp before saving
const storage = multer.memoryStorage();

const ALLOWED_MIMETYPES = ['image/webp', 'image/jpeg', 'image/png'];

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error('Only webp, jpeg, and png image files are allowed!'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 10, // 10MB raw upload limit (will be compressed)
  },
});

// Size variants for profile photos (all square)
const IMAGE_SIZES = {
  sm: 64,   // Small thumbnail for data tables
  md: 256,  // Medium for person profile page
  lg: 800,  // Large for fullscreen viewing
} as const;

type SizeKey = keyof typeof IMAGE_SIZES;

/**
 * Given a base name (without extension), generates the filename for a specific size.
 * e.g. baseFilename = "photo-1234567890-123456789"
 *      size = "sm"
 *      => "photo-1234567890-123456789-sm.webp"
 */
function sizedFilename(baseFilename: string, size: SizeKey): string {
  return `${baseFilename}-${size}.webp`;
}

/**
 * Process an uploaded image buffer into multiple square WebP sizes.
 * Returns the base filename (without size suffix or extension).
 *
 * The stored files will be:
 *   {baseFilename}-sm.webp  (64x64)
 *   {baseFilename}-md.webp  (256x256)
 *   {baseFilename}-lg.webp  (800x800)
 */
async function processAndSaveImage(buffer: Buffer, fieldname: string): Promise<string> {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const baseFilename = fieldname + '-' + uniqueSuffix;

  const promises = (Object.keys(IMAGE_SIZES) as SizeKey[]).map(async (size) => {
    const dimension = IMAGE_SIZES[size];
    const filename = sizedFilename(baseFilename, size);
    const outputPath = path.join(UPLOAD_DIR, filename);

    await sharp(buffer)
      .resize(dimension, dimension, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({
        quality: size === 'sm' ? 70 : size === 'md' ? 80 : 85,
      })
      .toFile(outputPath);
  });

  await Promise.all(promises);

  return baseFilename;
}

/**
 * Delete all size variants for a given base filename.
 * Silently ignores missing files.
 */
function deleteImageVariants(baseFilename: string): void {
  for (const size of Object.keys(IMAGE_SIZES) as SizeKey[]) {
    const filename = sizedFilename(baseFilename, size);
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.unlink(filePath, () => {}); // fire-and-forget
  }
}

/**
 * Given a base filename stored in the DB, return the filename for a specific size.
 * If the baseFilename already has a file extension (legacy single-file uploads),
 * strip it and use the base.
 */
function getImageUrl(baseFilename: string, size: SizeKey): string {
  // Handle legacy filenames that include .webp extension
  const base = baseFilename.replace(/\.webp$/, '');
  // If the base already has a size suffix (e.g. from legacy), strip it
  const cleanBase = base.replace(/-(sm|md|lg)$/, '');
  return sizedFilename(cleanBase, size);
}

export {
  upload,
  processAndSaveImage,
  deleteImageVariants,
  getImageUrl,
  sizedFilename,
  IMAGE_SIZES,
};
export type { SizeKey };