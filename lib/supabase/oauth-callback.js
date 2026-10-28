/** @typedef {import("@supabase/supabase-js").Session} Session */
/** @typedef {import("@supabase/supabase-js").SupabaseClient} SupabaseClient */

/**
 * React can mount the callback effect more than once. A PKCE authorization
 * code is single-use, so every mount for the same code must await one exchange.
 *
 * @type {Map<string, Promise<Session>>}
 */
const exchanges = new Map();

/**
 * Resolve an OAuth callback into a session without exchanging a PKCE code
 * more than once.
 *
 * @param {SupabaseClient} supabase
 * @param {string} href
 * @returns {Promise<Session>}
 */
export async function resolveOAuthCallback(supabase, href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const providerError = url.searchParams.get("error_description") ?? hash.get("error_description");
  if (providerError) throw new Error(providerError);

  const { data: existing, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (existing.session) return existing.session;

  const code = url.searchParams.get("code");
  if (code) {
    let exchange = exchanges.get(code);
    if (!exchange) {
      exchange = supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) throw error;
        if (!data.session) throw new Error("Supabase completed the code exchange without returning a session.");
        return data.session;
      });
      exchanges.set(code, exchange);
    }
    return exchange;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    if (!data.session) throw new Error("Supabase accepted the callback without returning a session.");
    return data.session;
  }

  throw new Error("The sign-in callback did not include an authorization response. Please return and try again.");
}
