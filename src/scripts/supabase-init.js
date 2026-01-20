// scripts/supabase-init.js - FIXED
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// REPLACE THESE WITH YOUR ACTUAL VALUES from Supabase → Settings → API
const supabaseUrl = 'https://nprlovwpmcrotocvvbxy.supabase.co';  // Use your actual URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcmxvdndwbWNyb3RvY3Z2Ynh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTk1ODgsImV4cCI6MjA4Mzk3NTU4OH0.NUeIa92q541nUNxhQ8r20InluN1_NGRzCDGPyYFh-8M';  // Use your actual anon key from .env

// Create and export supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Make it globally available for non-module scripts
window.supabase = supabase;

// Test connection
supabase.auth.getSession().then(({ data }) => {
  console.log('✅ Supabase connected! URL:', supabaseUrl);
  console.log('Session:', data.session ? 'Active' : 'No session');
}).catch(err => {
  console.error('❌ Supabase connection failed:', err);
});