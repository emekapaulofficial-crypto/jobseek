/* JobSeek Application Administration
 * Uses only the Supabase publishable/anon key. Never place a service-role key in the browser.
 */
(function(){
  const clientReady=()=>window.JobSeekSupabase?.configured&&window.supabase?.createClient;
  let client=null;
  function getClient(){
    if(!clientReady()) throw new Error('Supabase is not configured on this site yet.');
    if(!client) client=window.supabase.createClient(JobSeekSupabase.url,JobSeekSupabase.key);
    return client;
  }
  async function submitRequest(data){
    const c=getClient();
    const {data:userData,error:userError}=await c.auth.getUser();
    if(userError||!userData.user) throw new Error('Please sign in before requesting JobSeek administration.');
    const row={
      candidate_user_id:userData.user.id,
      full_name:data.name,
      email:data.email,
      job_title:data.title,
      employer_name:data.company||null,
      job_id:data.jobId||null,
      notes:data.notes||null,
      status:'REQUESTED'
    };
    const {data:created,error}=await c.from('jobseek_application_requests').insert(row).select('id,status,created_at').single();
    if(error) throw error;
    return created;
  }
  async function listCandidateRequests(){
    const c=getClient();
    const {data,error}=await c.from('jobseek_application_requests').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    return data||[];
  }
  window.JobSeekApplicationAdmin={submitRequest,listCandidateRequests};
})();
