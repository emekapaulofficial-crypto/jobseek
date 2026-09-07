/* JobSeek Supabase client foundation.
 * The publishable/anon key is safe for browser use; never put a service-role key here.
 */
const JOBSEEK_SUPABASE_URL = window.JOBSEEK_SUPABASE_URL || 'https://eavamfsbasjvngeqsyua.supabase.co';
const JOBSEEK_SUPABASE_KEY = window.JOBSEEK_SUPABASE_KEY || 'sb_publishable_E40QKzlb3dtIoawvmxPHfA_07t2XIxu';

window.JobSeekSupabase = {
  configured: Boolean(JOBSEEK_SUPABASE_URL && JOBSEEK_SUPABASE_KEY),
  url: JOBSEEK_SUPABASE_URL,
  key: JOBSEEK_SUPABASE_KEY
};

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
