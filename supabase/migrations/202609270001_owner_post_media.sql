begin;
create or replace function public.creator_owner_edit_media(p_user uuid,p_post uuid,p_version integer,p_changes jsonb,p_media uuid[])
returns void language plpgsql set search_path=public as $$
begin
 -- Both metadata and media changes roll back together if ownership or media checks fail.
 perform creator_owner_change(p_user,p_post,p_version,'edit',p_changes,'');
 if p_media is null or cardinality(p_media) not between 1 and 8 or cardinality(p_media)<>(select count(distinct id) from unnest(p_media) id) then raise exception 'Select 1 to 8 unique media files'; end if;
 perform id from creator_media where id=any(p_media) order by id for update;
 if (select count(*) from creator_media where id=any(p_media) and owner_id=p_user and (post_id is null or post_id=p_post))<>cardinality(p_media) then raise exception 'Media unavailable or owned by another account'; end if;
 update creator_media set post_id=null where post_id=p_post and not(id=any(p_media));
 update creator_media set post_id=p_post where id=any(p_media);
end $$;
revoke all on function public.creator_owner_edit_media(uuid,uuid,integer,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.creator_owner_edit_media(uuid,uuid,integer,jsonb,uuid[]) to service_role;
notify pgrst, 'reload schema';
commit;
