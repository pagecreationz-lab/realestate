import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
test('only owners can edit/delete; edits unpublish and deletion retains private audit',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`create role anon;create role authenticated;create role service_role;
   create table users(id uuid primary key,status text);
   create table creator_posts(id uuid primary key,author_id uuid,caption text,location text,price numeric,phone text,intent text,post_type text,service_category text,status text,review_note text,reviewed_by uuid,reviewed_at timestamptz);`);
  await pg.exec(await readFile(new URL('../supabase/migrations/202609230001_owner_post_management.sql',import.meta.url),'utf8'));
  const owner=randomUUID(),other=randomUUID(),post=randomUUID();
  await pg.query("insert into users values($1,'active'),($2,'active')",[owner,other]);
  await pg.query("insert into creator_posts(id,author_id,caption,status,post_type) values($1,$2,'Original description','approved','property')",[post,owner]);
  const changes={caption:'Updated property description',location:'Chennai',price:100,phone:'9876543210',intent:'Sell'};
  const edit=(id:string,version:number)=>pg.query("select creator_owner_change($1,$2,$3,'edit',$4,'')",[id,post,version,changes]);
  await assert.rejects(edit(other,0),/not owned/);
  await edit(owner,0);
  assert.equal((await pg.query<{status:string}>('select status from creator_posts')).rows[0].status,'pending');
  await assert.rejects(edit(owner,0),/Post changed/);
  await assert.rejects(pg.query("select creator_owner_change($1,$2,1,'delete','{}','No longer available')",[other,post]),/not owned/);
  await pg.query("select creator_owner_change($1,$2,1,'delete','{}','No longer available')",[owner,post]);
  assert.equal((await pg.query('select * from creator_posts where deleted_at is null')).rows.length,0);
  const logs=await pg.query<{snapshot:{caption:string};actor_id:string}>('select * from creator_deletion_logs');
  assert.equal(logs.rows.length,1);assert.equal(logs.rows[0].actor_id,owner);assert.equal(logs.rows[0].snapshot.caption,changes.caption);
  await assert.rejects(pg.query("update creator_posts set status='approved'"),/Deleted posts/);
  await pg.exec('set role anon');await assert.rejects(pg.query('select * from creator_deletion_logs'),/permission denied/);
 }finally{await pg.close();}
});
