import { supabase } from "./supabaseClient";

export async function checkPaulAccess() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      allowed: false,
      reason: "login_required",
    };
  }

  // Check profile role
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();


  // Admin has unlimited access
  if (profile?.is_admin === true) {
    return {
      allowed: true,
      type: "admin",
    };
  }


  const monthKey = new Date().toISOString().slice(0, 7);


  const { data: usage } = await supabase
    .from("paul_ai_usage")
    .select("*")
    .eq("user_id", user.id)
    .eq("month_key", monthKey)
    .single();


  // Paid subscriber
  const { data: subscription } = await supabase
    .from("paul_ai_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();


  if (
    subscription &&
    new Date(subscription.expiry_date) > new Date()
  ) {
    return {
      allowed: true,
      type: "subscriber",
    };
  }


  // Free users get 2 monthly uses
  const used = usage?.usage_count || 0;


  if (used >= 2) {
    return {
      allowed: false,
      reason: "subscription_required",
    };
  }


  return {
    allowed: true,
    type: "free",
    remaining: 2 - used,
  };
}


export async function recordPaulUsage() {

  const {
    data: { user },
  } = await supabase.auth.getUser();


  const monthKey = new Date().toISOString().slice(0, 7);


  const { data } = await supabase
    .from("paul_ai_usage")
    .select("*")
    .eq("user_id", user.id)
    .eq("month_key", monthKey)
    .single();


  if (data) {

    await supabase
      .from("paul_ai_usage")
      .update({
        usage_count: data.usage_count + 1,
      })
      .eq("id", data.id);

  } else {

    await supabase
      .from("paul_ai_usage")
      .insert({
        user_id:user.id,
        month_key:monthKey,
        usage_count:1
      });

  }
}
