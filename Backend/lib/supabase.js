const { createClient } = require('@supabase/supabase-js');

// Load env variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if env vars exist
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required in .env:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_ANON_KEY=your-anon-key');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (optional for now)');
  console.log('\n📋 Get these from Supabase Dashboard → Settings → API');
  
  // Don't throw, just create a null client for now
  module.exports = { supabase: null };
} else {
  // Create client with anon key (service role optional)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase client initialized');
  module.exports = { supabase };
}