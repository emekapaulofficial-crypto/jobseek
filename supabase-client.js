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

/* Admin-only workflow fixes. */
(function () {
  if (!/admin-dashboard\.html$/i.test(window.location.pathname)) return;

  function bootAdminWorkflowFixes() {
    // Manual Job Upload: application URL is optional.
    const apply = document.getElementById('mjApply');
    if (apply) {
      apply.required = false;
      apply.removeAttribute('required');
      apply.placeholder = 'Original application URL (optional)';
    }

    // Employer selection is optional when publishing a client job request.
    document.querySelectorAll('[data-lead-employer]').forEach(function (select) {
      const first = select.querySelector('option[value=""]');
      if (first) first.textContent = 'Choose employer (optional)';
    });

    // The existing admin script blocks publication when no employer is chosen.
    // Intercept only that case and publish the client job to the public Jobs feed.
    document.addEventListener('click', async function (event) {
      const button = event.target.closest('[data-publish-lead]');
      if (!button) return;

      const leadId = button.dataset.publishLead;
      const select = document.querySelector('[data-lead-employer="' + CSS.escape(leadId) + '"]');
      const employerId = select && select.value ? select.value : '';
      if (employerId) return; // Existing agency-vacancy flow remains unchanged.

      event.preventDefault();
      event.stopImmediatePropagation();
      if (!confirm('No employer selected. Publish this client job directly to the public Jobs page?')) return;

      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = 'Publishing…';

      try {
        const adminClient = JobSeekSupabase.getClient();
        const result = await adminClient.rpc('jobseek_publish_lead_to_jobs', { p_lead_id: leadId });
        if (result.error) throw result.error;
        button.textContent = 'Published';
        window.location.reload();
      } catch (error) {
        alert('Could not publish this job: ' + (error.message || error));
        button.disabled = false;
        button.textContent = originalText;
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAdminWorkflowFixes, { once: true });
  } else {
    bootAdminWorkflowFixes();
  }
})();
