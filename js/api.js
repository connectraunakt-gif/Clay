let clientPromise;
export const configured = () =>
  !!(window.CLAY_CONFIG?.supabaseUrl && window.CLAY_CONFIG?.supabaseKey);
export async function client() {
  if (!configured())
    throw Error(
      "Sign-in is not available yet. Clay’s owner needs to finish connecting account services.",
    );
  if (!clientPromise)
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2.57.4").then(
      ({ createClient }) =>
        createClient(
          window.CLAY_CONFIG.supabaseUrl,
          window.CLAY_CONFIG.supabaseKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          },
        ),
    );
  return clientPromise;
}
export async function session() {
  if (!configured()) return null;
  const c = await client();
  const { data, error } = await c.auth.getSession();
  if (error) throw error;
  return data.session;
}
export async function login(provider, email, signup = true) {
  const c = await client();
  const redirect = new URL("./", location.href).href;
  if (provider === "google") {
    const { error } = await c.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect },
    });
    if (error) throw error;
  } else {
    const { error } = await c.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect, shouldCreateUser: signup },
    });
    if (error) throw error;
  }
}
export async function logout(scope = "local") {
  const c = await client();
  const { error } = await c.auth.signOut({ scope });
  if (error) throw error;
}
export async function listSites() {
  const c = await client();
  const { data, error } = await c
    .from("websites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error)
    throw Error("Your websites could not be loaded. Please try again.");
  return data;
}
export async function invoke(type, data = {}) {
  const c = await client();
  const { data: result, error } = await c.functions.invoke("clay", {
    body: { type, ...data },
  });
  if (error)
    throw Error(
      "Clay could not finish that request. Please try again shortly.",
    );
  if (result?.error) throw Error(result.error);
  return result;
}
export async function createSite(model) {
  const c = await client();
  const { data, error } = await c.rpc("create_website", { p_model: model });
  if (error)
    throw Error(
      error.message.includes("one website")
        ? "Your account includes one website. Delete your existing website to start a new one."
        : "Your website could not be saved. Please try again.",
    );
  return data;
}
export async function saveSite(id, model, revision, label) {
  const c = await client();
  const { data, error } = await c.rpc("save_website", {
    p_id: id,
    p_model: model,
    p_revision: revision,
    p_label: label,
  });
  if (error)
    throw Error(
      error.message.includes("changed")
        ? "This website changed in another window. Reload it before editing."
        : "Your changes could not be saved. Please try again.",
    );
  return data;
}
export async function deleteSite(id) {
  const c = await client();
  const { error } = await c.rpc("delete_website", { p_id: id });
  if (error)
    throw Error(
      "Your website could not be deleted. Unpublish it first if it is live.",
    );
}
export async function versions(id) {
  const c = await client();
  const { data, error } = await c
    .from("versions")
    .select("id,label,model,created_at")
    .eq("website_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw Error("Previous versions could not be loaded.");
  return data;
}
export async function insights(id) {
  const c = await client();
  const [{ data: events, error: e1 }, { data: contacts, error: e2 }] =
    await Promise.all([
      c
        .from("visits")
        .select("visitor,seconds,path,created_at,country")
        .eq("website_id", id)
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .limit(10000),
      c
        .from("submissions")
        .select("*")
        .eq("website_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
  if (e1 || e2) throw Error("Your activity could not be loaded.");
  return { events, contacts };
}
