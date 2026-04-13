const MANAGER_LINK_TTL_SECONDS = 24 * 60 * 60;
const LOGISTICS_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

function toBytes(value: string) {
  return new TextEncoder().encode(value);
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((chunk) => chunk.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    toBytes(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  return toHex(await crypto.subtle.sign("HMAC", key, toBytes(payload)));
}

function buildAbsoluteUrl(baseUrl: string | null | undefined, path: string) {
  if (!baseUrl?.trim()) {
    return null;
  }

  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function compareSignatures(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function isExpired(expiresAt: number) {
  return Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

export function buildSignedManagerPath(retailcrmId: number, expiresAt: number, signature: string) {
  return `/orders/${retailcrmId}?exp=${expiresAt}&sig=${signature}`;
}

export async function buildSignedManagerLink(params: {
  retailcrmId: number;
  secret: string;
  baseUrl?: string | null;
  ttlSeconds?: number;
}) {
  const expiresAt = Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? MANAGER_LINK_TTL_SECONDS);
  const signature = await signPayload(
    params.secret,
    `manager:${params.retailcrmId}:${expiresAt}`,
  );
  const path = buildSignedManagerPath(params.retailcrmId, expiresAt, signature);

  return {
    expiresAt,
    signature,
    path,
    url: buildAbsoluteUrl(params.baseUrl ?? null, path),
  };
}

export async function verifySignedManagerLink(params: {
  retailcrmId: number;
  secret: string;
  expiresAt: number;
  signature: string;
}) {
  if (!params.signature || !isExpired(params.expiresAt)) {
    return false;
  }

  const expectedSignature = await signPayload(
    params.secret,
    `manager:${params.retailcrmId}:${params.expiresAt}`,
  );

  return compareSignatures(params.signature, expectedSignature);
}

export function buildLogisticsPath(retailcrmId: number, token: string) {
  return `/orders/${retailcrmId}/logistics?token=${token}`;
}

export async function buildLogisticsToken(params: {
  retailcrmId: number;
  secret: string;
  ttlSeconds?: number;
}) {
  const expiresAt =
    Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? LOGISTICS_LINK_TTL_SECONDS);
  const signature = await signPayload(
    params.secret,
    `logistics:${params.retailcrmId}:${expiresAt}`,
  );

  return `${expiresAt}.${signature}`;
}

export async function buildSignedLogisticsLink(params: {
  retailcrmId: number;
  secret: string;
  baseUrl?: string | null;
  ttlSeconds?: number;
}) {
  const token = await buildLogisticsToken(params);
  const path = buildLogisticsPath(params.retailcrmId, token);

  return {
    token,
    path,
    url: buildAbsoluteUrl(params.baseUrl ?? null, path),
  };
}

export async function verifyLogisticsToken(params: {
  retailcrmId: number;
  secret: string;
  token: string;
}) {
  const [expiresAtRaw, signature] = params.token.split(".", 2);
  const expiresAt = Number(expiresAtRaw);

  if (!signature || !isExpired(expiresAt)) {
    return false;
  }

  const expectedSignature = await signPayload(
    params.secret,
    `logistics:${params.retailcrmId}:${expiresAt}`,
  );

  return compareSignatures(signature, expectedSignature);
}
