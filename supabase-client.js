/* JobSeek Supabase client foundation.
 * Safe for GitHub Pages: only the publishable/anon key belongs here.
 * Replace the placeholders with your Supabase project URL and publishable key.
 */
const JOBSEEK_SUPABASE_URL = window.JOBSEEK_SUPABASE_URL || 'https://eavamfsbasjvngeqsyua.supabase.co';
const JOBSEEK_SUPABASE_KEY = window.JOBSEEK_SUPABASE_KEY || '';

window.JobSeekSupabase = {
  configured: Boolean(JOBSEEK_SUPABASE_URL && JOBSEEK_SUPABASE_KEY),
  url: JOBSEEK_SUPABASE_URL,
  key: JOBSEEK_SUPABASE_KEY
};

// Supabase JS is loaded by pages that need authentication.
// Keeping this small wrapper avoids exposing a service-role key in the static site.
window.JobSeekAuth = {
  async signUp(email, password, metadata = {}) {
    if (!window.supabase?.createClient || !JOBSEEK_SUPABASE_KEY) throw new Error('Supabase client is not configured.');
    const client = window.supabase.createClient(JOBSEEK_SUPABASE_URL, JOBSEEK_SUPABASE_KEY);
    return client.auth.signUp({ email, password, options: { data: metadata } });
  },
  async signIn(email, password) {
    if (!window.supabase?.createClient || !JOBSEEK_SUPABASE_KEY) throw new Error('Supabase client is not configured.');
    const client = window.supabase.createClient(JOBSEEK_SUPABASE_URL, JOBSEEK_SUPABASE_KEY);
    return client.auth.signInWithPassword({ email, password });
  },
  async signOut() {
    if (!window.supabase?.createClient || !JOBSEEK_SUPABASE_KEY) throw new Error('Supabase client is not configured.');
    const client = window.supabase.createClient(JOBSEEK_SUPABASE_URL, JOBSEEK_SUPABASE_KEY);
    return client.auth.signOut();
  }
};
