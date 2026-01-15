// scripts/supabase-init.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Get these EXACT values from Supabase → Settings → API
const supabaseUrl = 'https://nprlovwpmcrotocvvbxy.supabase.co'; // Your actual URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcmxvdndwbWNyb3RvY3Z2Ynh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTk1ODgsImV4cCI6MjA4Mzk3NTU4OH0.NUeIa92q541nUNxhQ8r20InluN1_NGRzCDGPyYFh-8M'; // Your actual anon key

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
// Test connection
supabase.auth.getSession().then(({ data }) => {
  console.log('✅ Supabase connected! URL:', supabaseUrl);
  console.log('Session:', data.session ? 'Active' : 'No session');
}).catch(err => {
  console.error('❌ Supabase connection failed:', err);
});