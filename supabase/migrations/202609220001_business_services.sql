begin;
alter table public.creator_posts add column if not exists post_type text not null default 'property' check(post_type in ('property','service'));
alter table public.creator_posts add column if not exists service_category text check(service_category in ('Painting','Carpentry','Electrical','Plumbing','Interior design','Hardware','Other'));
create or replace function public.creator_submit_service(p_user uuid,p_caption text,p_location text,p_price numeric,p_phone text,p_media uuid[],p_category text)
returns uuid language plpgsql set search_path=public as $$
declare v_id uuid;
begin
 if p_category is null or p_category not in ('Painting','Carpentry','Electrical','Plumbing','Interior design','Hardware','Other') then raise exception 'Invalid service category'; end if;
 if not exists(select 1 from users where id=p_user and status='active') then raise exception 'Active account required'; end if;
 v_id:=creator_submit(p_user,p_caption,p_location,'Sell',p_price,p_phone,p_media);
 update creator_posts set post_type='service',service_category=p_category where id=v_id;
 return v_id;
end $$;
revoke all on function public.creator_submit_service(uuid,text,text,numeric,text,uuid[],text) from public,anon,authenticated;
grant execute on function public.creator_submit_service(uuid,text,text,numeric,text,uuid[],text) to service_role;
notify pgrst, 'reload schema';
commit;
