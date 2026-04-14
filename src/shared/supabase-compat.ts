export function isMissingSupabaseColumnError(
  error: { message?: string | null; code?: string | null } | null | undefined,
  column: string,
) {
  if (!error?.message) {
    return false;
  }

  const mentionsColumn =
    error.message.includes(`'${column}'`) ||
    error.message.includes(`"${column}"`) ||
    error.message.includes(`${column}`);

  return (
    mentionsColumn &&
    (
      error.code === "PGRST204" ||
      /column .* does not exist/i.test(error.message) ||
      /could not find the .* column/i.test(error.message)
    )
  );
}
