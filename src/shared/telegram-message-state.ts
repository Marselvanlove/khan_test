import type {
  NotificationAlertType,
  TelegramMessageStateRecord,
  TelegramMessageStateStatus,
} from "./types";

type SupabaseLike = {
  from: (table: string) => any;
};

function normalizeState(row: Record<string, unknown>): TelegramMessageStateRecord {
  return {
    id: String(row.id),
    order_retailcrm_id: Number(row.order_retailcrm_id),
    chat_id: String(row.chat_id),
    message_id: row.message_id == null ? null : Number(row.message_id),
    alert_types: Array.isArray(row.alert_types)
      ? row.alert_types.map((value) => String(value) as NotificationAlertType)
      : [],
    status: String(row.status ?? "sent") as TelegramMessageStateStatus,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    completed_by_user_id:
      row.completed_by_user_id == null ? null : Number(row.completed_by_user_id),
    completed_by_username: row.completed_by_username ? String(row.completed_by_username) : null,
    crm_status_before: row.crm_status_before ? String(row.crm_status_before) : null,
    crm_status_after: row.crm_status_after ? String(row.crm_status_after) : null,
    created_at: String(row.created_at),
  };
}

export async function createTelegramMessageState(
  supabase: SupabaseLike,
  payload: {
    id?: string;
    order_retailcrm_id: number;
    chat_id: string;
    alert_types: NotificationAlertType[];
    status?: TelegramMessageStateStatus;
  },
) {
  const { data, error } = await supabase
    .from("telegram_message_states")
    .insert({
      id: payload.id,
      order_retailcrm_id: payload.order_retailcrm_id,
      chat_id: payload.chat_id,
      alert_types: payload.alert_types,
      status: payload.status ?? "sent",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create telegram message state");
  }

  return normalizeState(data);
}

export async function attachTelegramMessageId(
  supabase: SupabaseLike,
  stateId: string,
  messageId: number,
) {
  const { error } = await supabase
    .from("telegram_message_states")
    .update({
      message_id: messageId,
    })
    .eq("id", stateId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteTelegramMessageState(supabase: SupabaseLike, stateId: string) {
  const { error } = await supabase.from("telegram_message_states").delete().eq("id", stateId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getTelegramMessageStateById(
  supabase: SupabaseLike,
  stateId: string,
) {
  const { data, error } = await supabase
    .from("telegram_message_states")
    .select("*")
    .eq("id", stateId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? normalizeState(data) : null;
}

export async function updateTelegramMessageState(
  supabase: SupabaseLike,
  stateId: string,
  payload: Partial<{
    status: TelegramMessageStateStatus;
    completed_at: string | null;
    completed_by_user_id: number | null;
    completed_by_username: string | null;
    crm_status_before: string | null;
    crm_status_after: string | null;
  }>,
) {
  const { error } = await supabase
    .from("telegram_message_states")
    .update(payload)
    .eq("id", stateId);

  if (error) {
    throw new Error(error.message);
  }
}
