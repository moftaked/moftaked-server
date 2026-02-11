import multer from 'multer';

const storage = multer.diskStorage({
  destination: 'uploads/images',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.webp');
  },
});

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
    fileSize: 1024 * 1024 * 5,
  },
});

export { upload };
