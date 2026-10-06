require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getSupabase } = require('./src/config/supabase');

(async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const password = process.argv[3];
  if (!email || !password) throw new Error('Usage: node createAdmin.js <email> <password>');
  if (password.length < 8) throw new Error('Admin password must be at least 8 characters long.');
  const supabase = getSupabase();

  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    const { error } = await supabase
      .from('users')
      .update({ role: 'admin', password: await bcrypt.hash(password, 10) })
      .eq('id', existing.id);

    if (error) throw error;
    console.log('Admin ready:', email);
    return;
  }

  const { error } = await supabase.from('users').insert({
    name: 'EcoSwap Admin',
    email,
    password: await bcrypt.hash(password, 10),
    phoneNumber: '',
    address: {
      addressLine: '',
      city: '',
      state: '',
      pinCode: '',
      country: ''
    },
    role: 'admin'
  });

  if (error) throw error;
  console.log('Admin ready:', email);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
