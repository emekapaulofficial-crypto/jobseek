/* JobSeek Supabase client foundation.
 * The publishable/anon key is safe for browser use; never put a service-role key here.
 */
const JOBSEEK_SUPABASE_URL = window.JOBSEEK_SUPABASE_URL || 'https://eavamfsbasjvngeqsyua.supabase.co';
const JOBSEEK_SUPABASE_KEY = window.JOBSEEK_SUPABASE_KEY || 'sb_publishable_E40QKzlb3dtIoawvmxPHfA_07t2XIxu';

window.JobSeekSupabase = {
  configured: Boolean(JOBSEEK_SUPABASE_URL && JOBSEEK_SUPABASE_KEY),
  url: JOBSEEK_SUPABASE_URL,
  key: JOBSEEK_SUPABASE_KEY,
  getClient(options = {}) {
    if (!window.supabase?.createClient || !JOBSEEK_SUPABASE_KEY) {
      throw new Error('Supabase client is not configured.');
    }
    return window.supabase.createClient(JOBSEEK_SUPABASE_URL, JOBSEEK_SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      ...options
    });
  }
};

window.JobSeekAuth = {
  async signUp(email, password, metadata = {}) {
    const client = JobSeekSupabase.getClient();
    return client.auth.signUp({ email, password, options: { data: metadata } });
  },
  async signIn(email, password) {
    const client = JobSeekSupabase.getClient();
    return client.auth.signInWithPassword({ email, password });
  },
  async signOut() {
    const client = JobSeekSupabase.getClient();
    return client.auth.signOut();
  }
};
