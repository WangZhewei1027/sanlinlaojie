import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { verifyProviderIdToken } from "better-auth/oauth2";
import { createGoogleRelayClient } from "@/lib/auth/google-relay-client.server";

/** Change only Google's server-side transport; keep Better Auth's state, PKCE and account handling. */
export function googleRelay(baseURL: string, secret: string): BetterAuthPlugin {
  const relay = createGoogleRelayClient(baseURL, secret);
  return {
    id: "google-hongkong-relay",
    init(context) {
      const provider = context.socialProviders.find((item) => item.id === "google");
      if (!provider) return;
      if (!provider.idToken || !("jwks" in provider.idToken)) throw new Error("Unsupported Google provider");
      provider.idToken = { ...provider.idToken, jwks: relay.jwks, algorithms: ["RS256"] };
      provider.validateAuthorizationCode = ({ code, codeVerifier, redirectURI }) => {
        if (!codeVerifier) throw new Error("Google PKCE verifier missing");
        return relay.exchange({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectURI });
      };
      provider.refreshAccessToken = (refreshToken) => relay.exchange({ grant_type: "refresh_token", refresh_token: refreshToken });
      const originalGetUserInfo = provider.getUserInfo.bind(provider);
      provider.getUserInfo = async (tokens) => {
        // A relay is an extra transport hop: verify Google's own signature locally before trusting claims.
        if (!tokens.idToken || !await verifyProviderIdToken(provider, tokens.idToken, tokens.expectedIdTokenNonce)) return null;
        return originalGetUserInfo(tokens);
      };
    },
  };
}
