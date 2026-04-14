export function isMissingSupabaseColumnError(
  error: { message?: string | null; code?: string | null } | null | undefined,
  column: string,
) {
  if (!error?.message) {
    return false;
  }

  return (
    error.code === "PGRST204" &&
    (error.message.includes(`'${column}'`) ||
      error.message.includes(`"${column}"`) ||
      error.message.includes(`${column}`))
  );
}
