import assert from "node:assert/strict";
import test from "node:test";
import { resolveOAuthCallback } from "../lib/supabase/oauth-callback.js";

const session = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  user: { email_confirmed_at: "2026-08-10T00:00:00.000Z" },
};

test("exchanges a PKCE callback code only once across concurrent effects", async () => {
  let exchanges = 0;
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      exchangeCodeForSession: async () => {
        exchanges += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { data: { session }, error: null };
      },
    },
  };

  const href = "https://spoolwise.example/auth/callback?code=concurrent-code";
  const [first, second] = await Promise.all([
    resolveOAuthCallback(supabase, href),
    resolveOAuthCallback(supabase, href),
  ]);

  assert.equal(exchanges, 1);
  assert.equal(first, session);
  assert.equal(second, session);
});

test("uses an existing session before attempting another code exchange", async () => {
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      exchangeCodeForSession: async () => {
        throw new Error("exchange should not run");
      },
    },
  };

  assert.equal(
    await resolveOAuthCallback(supabase, "https://spoolwise.example/auth/callback?code=consumed-code"),
    session,
  );
});

test("surfaces provider and token-exchange errors", async () => {
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: new Error("PKCE verifier mismatch") }),
    },
  };

  await assert.rejects(
    resolveOAuthCallback(supabase, "https://spoolwise.example/auth/callback?error_description=Google+denied+access"),
    /Google denied access/,
  );
  await assert.rejects(
    resolveOAuthCallback(supabase, "https://spoolwise.example/auth/callback?code=failing-code"),
    /PKCE verifier mismatch/,
  );
});
