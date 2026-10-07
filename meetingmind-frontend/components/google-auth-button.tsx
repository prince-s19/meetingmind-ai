"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setSession } from "@/lib/auth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export function GoogleAuthButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const expectedState = sessionStorage.getItem("google_oauth_state");
    const returnedState = params.get("state");
    window.history.replaceState({}, "", window.location.pathname);
    if (!expectedState || expectedState !== returnedState) {
      setError("Google sign-in could not be verified. Please try again.");
      return;
    }

    sessionStorage.removeItem("google_oauth_state");
    setLoading(true);
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    api.googleAuth(code, redirectUri)
      .then(({ token, user }) => {
        setSession(token, user);
        router.replace("/dashboard");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to sign in with Google."))
      .finally(() => setLoading(false));
  }, [router]);

  function startGoogleAuth() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("Google sign-in is not configured.");
      return;
    }

    const state = crypto.randomUUID();
    sessionStorage.setItem("google_oauth_state", state);
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}${window.location.pathname}`,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account",
    });
    window.location.assign(`${GOOGLE_AUTH_URL}?${query.toString()}`);
  }

  return <>
    <button type="button" className="button secondary full google-button" onClick={startGoogleAuth} disabled={loading}>
      <img className="google-icon" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" aria-hidden="true" />
      {loading ? "Connecting to Google…" : "Continue with Google"}
    </button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
}