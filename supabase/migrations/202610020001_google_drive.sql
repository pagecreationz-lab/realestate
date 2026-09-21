begin;
create table public.drive_connection (
 id integer primary key check(id=1),google_user_id text not null default '',account_email text not null default '',
 refresh_token_enc text not null default '',root_folder_id text not null default '',updated_at timestamptz not null default now()
);
insert into public.drive_connection(id) values(1);
create table public.drive_oauth_states (
 id uuid primary key,admin_id uuid not null references public.users(id),expires_at timestamptz not null
);
create table public.drive_uploader_folders (
 user_id uuid primary key references public.users(id),folder_id text unique not null
);
alter table public.drive_connection enable row level security;
alter table public.drive_oauth_states enable row level security;
alter table public.drive_uploader_folders enable row level security;
revoke all on public.drive_connection,public.drive_oauth_states,public.drive_uploader_folders from public,anon,authenticated;
grant all on public.drive_connection,public.drive_oauth_states,public.drive_uploader_folders to service_role;
create function public.drive_save_connection(p_google_user text,p_email text,p_token text,p_root text)
returns void language plpgsql set search_path=public as $$
declare current_account text;
begin
 select google_user_id into current_account from drive_connection where id=1 for update;
 if current_account<>'' and current_account<>p_google_user then raise exception 'Reconnect the original EASE HOME Google account to preserve media access'; end if;
 update drive_connection set google_user_id=p_google_user,account_email=p_email,refresh_token_enc=p_token,
 root_folder_id=case when root_folder_id='' then p_root else root_folder_id end,updated_at=now() where id=1;
end $$;
revoke all on function public.drive_save_connection(text,text,text,text) from public,anon,authenticated;
grant execute on function public.drive_save_connection(text,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
