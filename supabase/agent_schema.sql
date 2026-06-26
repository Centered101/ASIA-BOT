-- ================================================================
-- ASIA-BOT AI Agent Core — Additional Schema
-- Run after schema.sql
-- ================================================================

-- Conversation memory (multi-turn context per session)
create table if not exists public.agent_conversations (
  id          uuid        primary key default gen_random_uuid(),
  session_id  text        not null unique,   -- '{channel}:{userId}'
  messages    jsonb       not null default '[]',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_agent_conversations_session on public.agent_conversations (session_id);
create index if not exists idx_agent_conversations_updated on public.agent_conversations (updated_at desc);

-- Agent request logs (observability)
create table if not exists public.agent_logs (
  id           uuid        primary key default gen_random_uuid(),
  session_id   text,
  channel      text        not null,
  user_id      text,
  user_role    text,
  user_message text        not null,
  tools_called jsonb       default '[]',
  response     text,
  latency_ms   integer,
  error        text,
  created_at   timestamptz default now()
);

create index if not exists idx_agent_logs_session on public.agent_logs (session_id);
create index if not exists idx_agent_logs_channel on public.agent_logs (channel);
create index if not exists idx_agent_logs_created on public.agent_logs (created_at desc);
create index if not exists idx_agent_logs_user    on public.agent_logs (user_id);

-- desired_password_hash: ครูที่สมัครสามารถตั้งรหัสผ่านที่ต้องการล่วงหน้าได้
alter table public.teachers
  add column if not exists desired_password_hash text;
