require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { isSupabaseConfigured, supabaseConfigurationMessage } = require('./config/supabase');
const { getJwtSecret } = require('./config/jwt');

if (!getJwtSecret()) {
  console.warn('JWT_SECRET is not configured with a private value; set it in backend/.env before enabling authentication.');
}
if (!isSupabaseConfigured) {
  console.warn(supabaseConfigurationMessage());
}

const app = express();
const allowedOrigins = String(process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => res.json({
  ok: true,
  message: 'EcoSwap backend running',
  supabaseCredentialsConfigured: isSupabaseConfigured
}));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use((err, req, res, next) => {
  if (err) console.error(`[Request] ${err.message || 'Unhandled request error'}`);
  res.status(err.status || 400).json({ message: err.message || 'Request failed' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
