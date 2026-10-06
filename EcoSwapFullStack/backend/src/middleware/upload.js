const multer = require('multer');

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error('Only JPG, PNG and WEBP images are supported.'));
    }
    return callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});
