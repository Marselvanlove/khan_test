import { createClient } from "@supabase/supabase-js";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

const insecureSupabaseAgent = new HttpsAgent({
  rejectUnauthorized: false,
});

function shouldAllowInsecureTlsForLocalSupabase() {
  return process.env.SUPABASE_ALLOW_INSECURE_TLS === "true" && process.env.NODE_ENV !== "production";
}

function createSupabaseFetch(allowInsecureTls: boolean): typeof fetch | undefined {
  if (!allowInsecureTls) {
    return undefined;
  }

  // Dev-only fallback for local environments where Supabase TLS validation fails.
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? null
        : Buffer.from(await request.arrayBuffer());

    return new Promise<Response>((resolve, reject) => {
      const nodeRequest = transport(
        url,
        {
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          agent: url.protocol === "https:" ? insecureSupabaseAgent : undefined,
        },
        (nodeResponse) => {
          const chunks: Buffer[] = [];

          nodeResponse.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          nodeResponse.on("end", () => {
            const headers = new Headers();

            for (const [key, value] of Object.entries(nodeResponse.headers)) {
              if (Array.isArray(value)) {
                headers.set(key, value.join(", "));
                continue;
              }

              if (value != null) {
                headers.set(key, String(value));
              }
            }

            resolve(
              new Response(Buffer.concat(chunks), {
                status: nodeResponse.statusCode ?? 500,
                statusText: nodeResponse.statusMessage ?? "",
                headers,
              }),
            );
          });
        },
      );

      nodeRequest.on("error", reject);

      if (body) {
        nodeRequest.write(body);
      }

      nodeRequest.end();
    });
  };
}

export function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    return null;
  }

  const allowInsecureTls = shouldAllowInsecureTlsForLocalSupabase();

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: createSupabaseFetch(allowInsecureTls),
    },
  });
}
