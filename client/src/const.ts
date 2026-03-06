export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  // State must be base64(redirectUri) — the SDK decodes it as-is for token exchange
  const state = btoa(redirectUri);

  // Store the desired return path in sessionStorage so the Home page can redirect after login
  if (returnPath) {
    sessionStorage.setItem("mm-quoting-return-path", returnPath);
  } else {
    sessionStorage.setItem("mm-quoting-return-path", "/dashboard");
  }

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
