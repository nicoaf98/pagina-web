const express = require('express');
const multer = require('multer');
const {
  adminListProducts,
  bulkUpdatePrices,
} = require('../controllers/products.controller');
const {
  listProductImages,
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
} = require('../controllers/productImages.controller');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

const staffOnly = [authMiddleware, requireRole('admin', 'seller')];

// In-memory storage — small files (<= 3MB) forwarded immediately to Supabase.
// No disk writes (Vercel's filesystem is read-only outside /tmp).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// 4-arg signature → only runs when the previous middleware called next(err).
function multerErrorHandler(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return next(makeError(413, 'File too large (max 3MB)'));
  }
  if (err && err.name === 'MulterError') {
    return next(makeError(400, `Upload error: ${err.message}`));
  }
  return next(err);
}

router.get('/products',                               staffOnly, adminListProducts);
router.patch('/products/prices/bulk',                 staffOnly, bulkUpdatePrices);

router.get('/products/:id/images',                    staffOnly, listProductImages);
router.post('/products/:id/images',
  staffOnly,
  upload.single('file'),
  multerErrorHandler,
  uploadProductImage
);
router.delete('/products/:id/images/:imageId',        staffOnly, deleteProductImage);
router.patch('/products/:id/images/:imageId/primary', staffOnly, setPrimaryProductImage);

module.exports = router;
