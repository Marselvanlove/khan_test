import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ retailcrmId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { retailcrmId } = await params;
  const query = await searchParams;
  const retailcrmIdNumber = Number(retailcrmId);
  const nextQuery = new URLSearchParams();

  nextQuery.set("tab", "operations");

  if (Number.isFinite(retailcrmIdNumber)) {
    nextQuery.set("order", String(retailcrmIdNumber));
  }

  const signature = readQueryValue(query.sig);
  const expiresAt = readQueryValue(query.exp);

  if (signature) {
    nextQuery.set("sig", signature);
  }

  if (expiresAt) {
    nextQuery.set("exp", expiresAt);
  }

  redirect(`/?${nextQuery.toString()}`);
}
