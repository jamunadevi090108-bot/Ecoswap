const crypto = require('crypto');
const router = require('express').Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const { getSupabase, sendSupabaseError } = require('../config/supabase');

const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

router.post('/', (req, res, next) => {
  try {
    getSupabase();
    return next();
  } catch (error) {
    return sendSupabaseError(res, error);
  }
}, protect, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Image is required' });

  try {
    const supabase = getSupabase();
    const filename = `${req.user.id}/${crypto.randomUUID()}${extensions[req.file.mimetype]}`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error(`[Supabase Storage] ${error.message}`);
      return res.status(error.statusCode === '404' ? 503 : 502).json({
        message: 'Image upload failed. Confirm the public "product-images" bucket exists in Supabase Storage.'
      });
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
    return res.json({ imageUrl: data.publicUrl });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

module.exports = router;
