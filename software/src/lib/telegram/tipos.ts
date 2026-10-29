/** Tipos mínimos da Bot API do Telegram (só os campos que o sistema usa). */

export type TgUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TgChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
};

export type TgPhotoSize = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};

export type TgDocument = {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

export type TgMessage = {
  message_id: number;
  date: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: TgDocument;
  /** Álbum: fotos enviadas juntas chegam em updates separados com o mesmo media_group_id. */
  media_group_id?: string;
};

export type TgCallbackQuery = {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
};

export type TgChatMemberUpdated = {
  chat: TgChat;
  from: TgUser;
  date: number;
  old_chat_member: { status: string; user: TgUser };
  new_chat_member: { status: string; user: TgUser };
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: TgCallbackQuery;
  my_chat_member?: TgChatMemberUpdated;
  [outro: string]: unknown;
};

export type TgFile = {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
};

export type TgWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
};

export type TgBotInfo = TgUser & {
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
};

export type BotaoInline = { text: string; callback_data?: string; url?: string };
export type TecladoInline = BotaoInline[][];

/** Tipos de update que o sistema pede ao Telegram (setWebhook e getUpdates). */
export const UPDATES_PERMITIDOS = ["message", "callback_query", "my_chat_member"] as const;

/** Limite da Bot API para baixar arquivos (getFile). */
export const LIMITE_DOWNLOAD_BYTES = 20 * 1024 * 1024;

export function tipoDoUpdate(u: TgUpdate): string {
  for (const k of Object.keys(u)) if (k !== "update_id") return k;
  return "desconhecido";
}
