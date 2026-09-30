import { createRecognitionHandler } from "./handler.ts";

const config = {
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  modelEndpoint: Deno.env.get("SAGE_EAS_ENDPOINT"),
  modelToken: Deno.env.get("SAGE_EAS_TOKEN"),
  threshold: Deno.env.get("SAGE_MATCH_THRESHOLD"),
  margin: Deno.env.get("SAGE_MATCH_MARGIN"),
  edgeRegion: Deno.env.get("SB_REGION"),
};

// Use fresh HTTP/1.1 connections only for EAS. Keep the database's normal pool.
// Keep transport settings explicit while checking EAS gateway compatibility.
const modelClient = Deno.createHttpClient({ http1: true, http2: false, poolMaxIdlePerHost: 0 });
const modelUrl = config.modelEndpoint ? `${config.modelEndpoint.replace(/\/$/, "")}/embed` : null;
const recognitionFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return fetch(input, url === modelUrl ? { ...init, client: modelClient } : init);
};
Deno.serve(createRecognitionHandler(config, recognitionFetch));
