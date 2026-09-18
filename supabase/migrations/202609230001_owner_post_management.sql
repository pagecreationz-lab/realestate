begin;
alter table public.creator_posts add column if not exists deleted_at timestamptz;
alter table public.creator_posts add column if not exists edit_version integer not null default 0;
create table if not exists public.creator_deletion_logs(
 id uuid primary key default gen_random_uuid(),post_id uuid not null,actor_id uuid not null,
 reason text not null,snapshot jsonb not null,created_at timestamptz not null default now()
);
alter table public.creator_deletion_logs enable row level security;
revoke all on public.creator_deletion_logs from public,anon,authenticated;
grant select,insert on public.creator_deletion_logs to service_role;
create or replace function public.creator_owner_change(p_user uuid,p_post uuid,p_version integer,p_action text,p_changes jsonb,p_reason text)
returns void language plpgsql set search_path=public as $$
declare v_post creator_posts%rowtype;
begin
 if not exists(select 1 from users where id=p_user and status='active') then raise exception 'Active account required'; end if;
 select * into v_post from creator_posts where id=p_post and author_id=p_user for update;
 if not found or v_post.deleted_at is not null then raise exception 'Post unavailable or not owned by you'; end if;
 if v_post.edit_version<>p_version then raise exception 'Post changed. Refresh before trying again.'; end if;
 if p_action='delete' then
  if p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Deletion reason required'; end if;
  insert into creator_deletion_logs(post_id,actor_id,reason,snapshot) values(p_post,p_user,trim(p_reason),to_jsonb(v_post));
  update creator_posts set deleted_at=now(),status='rejected',edit_version=edit_version+1 where id=p_post;
 elsif p_action='edit' then
  if p_changes->>'caption' is null or length(trim(p_changes->>'caption')) not between 10 and 3000 then raise exception 'Invalid description'; end if;
  update creator_posts set caption=p_changes->>'caption',location=p_changes->>'location',price=(p_changes->>'price')::numeric,
   phone=nullif(p_changes->>'phone',''),intent=case when v_post.post_type='service' then v_post.intent else p_changes->>'intent' end,
   service_category=case when v_post.post_type='service' then p_changes->>'serviceCategory' else null end,
   status='pending',review_note=null,reviewed_by=null,reviewed_at=null,edit_version=edit_version+1 where id=p_post;
 else raise exception 'Invalid action'; end if;
end $$;
revoke all on function public.creator_owner_change(uuid,uuid,integer,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.creator_owner_change(uuid,uuid,integer,text,jsonb,text) to service_role;
-- Older moderation callers cannot accidentally republish a deleted post.
create or replace function public.creator_keep_deleted_private() returns trigger language plpgsql as $$
begin
 if old.deleted_at is not null then raise exception 'Deleted posts cannot be changed or republished'; end if;
 return new;
end $$;
drop trigger if exists creator_deleted_guard on public.creator_posts;
create trigger creator_deleted_guard before update on public.creator_posts for each row execute function public.creator_keep_deleted_private();
notify pgrst, 'reload schema';
commit;
