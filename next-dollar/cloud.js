let clientPromise;

export function getCloudConfig() {
  return window.NEXT_DOLLAR_CONFIG || {};
}

export function isCloudConfigured() {
  const config = getCloudConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

async function client() {
  if (!isCloudConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => {
      const config = getCloudConfig();
      return createClient(config.supabaseUrl, config.supabaseAnonKey);
    });
  }
  return clientPromise;
}

export async function getCloudSession() {
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function sendMagicLink(email) {
  const supabase = await client();
  if (!supabase) throw new Error("Cloud mode is not configured yet.");
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) throw error;
  return true;
}

export async function redeemInvite(code) {
  const supabase = await client();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("redeem_beta_invite", { input_code: code.trim() });
  if (error) throw error;
  return Boolean(data);
}

export async function isBetaMember() {
  const supabase = await client();
  const session = await getCloudSession();
  if (!supabase || !session) return false;
  const { data, error } = await supabase.from("beta_members").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function loadCloudState() {
  const supabase = await client();
  const session = await getCloudSession();
  if (!supabase || !session) return null;
  const userId = session.user.id;
  const [profileResult, stateResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("financial_states").select("state").eq("user_id", userId).maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (stateResult.error) throw stateResult.error;
  const persistedState = stateResult.data?.state || null;
  return { profile: persistedState?.profile || profileResult.data, state: persistedState, session };
}

export async function saveCloudState({ profile, state, recommendation, cashEvent }) {
  const supabase = await client();
  const session = await getCloudSession();
  if (!supabase || !session) return null;
  const userId = session.user.id;
  const now = new Date().toISOString();
  const profileRow = { id: userId, display_name: profile.displayName || null, age: profile.age || null, archetype: profile.archetype, answers: profile.answers || {}, theme: profile.theme || {}, updated_at: now };
  const { error: profileError } = await supabase.from("profiles").upsert(profileRow);
  if (profileError) throw profileError;
  const { error: stateError } = await supabase.from("financial_states").upsert({ user_id: userId, state, updated_at: now });
  if (stateError) throw stateError;
  if (cashEvent) {
    const { error } = await supabase.from("cash_events").insert({ user_id: userId, payload: cashEvent });
    if (error) throw error;
  }
  if (recommendation) {
    const { error } = await supabase.from("recommendations").insert({ user_id: userId, payload: recommendation });
    if (error) throw error;
  }
  return true;
}

export async function signOutCloud() {
  const supabase = await client();
  if (supabase) await supabase.auth.signOut();
}


