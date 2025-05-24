
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Verify Cloudinary configuration
console.log('Cloudinary configuration:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET ? '****' : undefined,
});

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Cloudinary configuration failed: Missing environment variables');
  throw new Error('Cloudinary configuration failed: Missing environment variables');
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce',
    allowed_formats: ['jpg', 'png', 'webp'],
  },
});

// Upload instance for fields (categories/subcategories)
const uploadFields = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    console.log('Multer processing file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    if (!allowedTypes.includes(file.mimetype)) {
      console.error('File rejected - Invalid type:', file.mimetype);
      return cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'), false);
    }
    cb(null, true);
  },
}).fields([{ name: 'image', maxCount: 1 }]);

// Upload instance for array (products)
const uploadArray = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    console.log('Multer processing file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    if (!allowedTypes.includes(file.mimetype)) {
      console.error('File rejected - Invalid type:', file.mimetype);
      return cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'), false);
    }
    if (file.size > 1 * 1024 * 1024) {
      console.error('File rejected - Size exceeds 1MB:', file.size);
      return cb(new Error('File size exceeds 1MB limit.'), false);
    }
    cb(null, true);
  },
}).array('images', 5);

// Error handling middleware for Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size exceeds 1MB limit.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files uploaded. Maximum 5 images allowed.' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

module.exports = { cloudinary, uploadFields, uploadArray, handleMulterError };