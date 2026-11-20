import type { RowDataPacket } from 'mysql2/promise';

export type ReviewTaskRow = RowDataPacket & {
  id: string;
  public_id: string;
  workspace_id: string;
  store_app_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at: Date;
  next_retry_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  locked_until: Date | null;
  worker_request_id: string | null;
  fetched_count: number;
  inserted_count: number;
  updated_count: number;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

export type StoreSyncConfigRow = RowDataPacket & {
  id: string;
  workspace_id: string;
  store_app_id: string;
  enabled: number;
  interval_minutes: number;
  next_sync_at: Date | null;
  last_started_at: Date | null;
  last_synced_at: Date | null;
  last_error_at: Date | null;
  last_error_code: string | null;
  last_error_message: string | null;
  cursor: string | null;
};

export type StoreAppRow = RowDataPacket & {
  id: string;
  public_id: string;
  workspace_id: string;
  application_id: string;
  store_connection_id: string | null;
  store_type: string;
  external_app_id: string;
  country_code: string;
  store_url: string | null;
  display_name: string | null;
  icon_url: string | null;
  status: string;
  application_name?: string | null;
  connection_status?: string | null;
  connection_type?: string | null;
  credential_ciphertext?: string | null;
  credential_key_version?: number | null;
};

export type NotificationRuleRow = RowDataPacket & {
  id: string;
  public_id: string;
  workspace_id: string;
  name: string;
  event_type: string;
  min_rating: number | null;
  max_rating: number | null;
  application_ids: string | number[] | null;
  channel_ids: string | number[] | null;
  enabled: number;
};

export type NotificationChannelRow = RowDataPacket & {
  id: string;
  public_id: string;
  workspace_id: string;
  channel_type: 'telegram' | 'webhook';
  name: string;
  config_ciphertext: string;
  config_key_version: number;
  enabled: number;
};

export type NotificationOutboxRow = RowDataPacket & {
  id: string;
  public_id: string;
  workspace_id: string;
  channel_id: string;
  event_type: string;
  dedupe_key: string;
  payload: unknown;
  status: 'pending' | 'running' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  max_attempts: number;
  next_retry_at: Date | null;
  locked_until: Date | null;
  sent_at: Date | null;
  error_code: string | null;
  error_message: string | null;
  channel_type?: string | null;
  channel_name?: string | null;
  channel_enabled?: number | null;  
  config_ciphertext?: string | null;
  config_key_version?: number | null;
};

export type ReviewRow = RowDataPacket & {
  id: string;
  public_id: string;
  workspace_id: string;
  application_id: string;
  store_app_id: string;
  store_type: string;
  external_review_id: string;
  rating: number;
  internal_status: string;
  source_created_at: Date;
  last_synced_at: Date;
};
