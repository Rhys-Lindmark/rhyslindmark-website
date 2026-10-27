import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHandler } from './jev.js';
import { reserve } from '../_lib/jev-access.js';
function database() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(new URL('../../jev-schema.sql', import.meta.url),'utf8'));
  return {raw, prepare(sql){return {async first(){return raw.prepare(sql).get() || null},bind(...values){return {async first(){return raw.prepare(sql).get(...values) || null},async run(){return raw.prepare(sql).run(...values)}}}}}};
}
const body={claim:'Participation doubled.',evidence:'Participation rose from 10 to 20.',verification_token:'fresh-human-token'};
const request=(changes={},headers={})=>new Request('https://ai.rhyslindmark.com/api/jev',{method:'POST',headers:{Origin:'https://ai.rhyslindmark.com','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},body:JSON.stringify({...body,...changes})});
const environment=db=>({JEV_ENABLED:'1',JEV_API_KEY:'server-only-test-key',JEV_TURNSTILE_SECRET:'server-turnstile-secret',JEV_KEY_SECRET:'server-client-salt',JEV_DB:db});
const valid={model:'jev-1.14.0',answers:{verdict:{choice:'supported',probabilities:{supported:.9,contradicted:.01,insufficient:.09},confidence:.8},direct:{noul:.9},overreach:{noul:.1}}};
test('gates each call on fresh verified hostname/action; no header or cookie bypass; replay rejected',async()=>{
  const db=database();try{
    let inference=0,spent=0;const consumed=new Set();
    const h=createHandler(async(url,init)=>{
      if(url.includes('/siteverify')){
        const token=init.body.get('response');assert.equal(init.body.get('secret'),'server-turnstile-secret');
        const success=!consumed.has(token);consumed.add(token);
        return Response.json({success,hostname:'ai.rhyslindmark.com',action:'jev_check'});
      }
      inference++;assert.equal(init.headers.Authorization,'Bearer server-only-test-key');assert.equal(JSON.parse(init.body).model,'jev-1.14.0');return Response.json(valid);
    });
    const env=environment(db);
    assert.equal((await h({request:request({verification_token:''},{Authorization:'Bearer server-only-test-key',Cookie:'some=trusted'}),env})).status,403);
    assert.equal((await h({request:request(),env})).status,200);
    spent=db.raw.prepare('SELECT reserved_micros FROM jev_budget').get().reserved_micros;assert.equal(spent,10000);
    assert.equal((await h({request:request(),env})).status,403);
    assert.equal(inference,1);assert.equal(db.raw.prepare('SELECT reserved_micros FROM jev_budget').get().reserved_micros,spent);
  } finally {db.raw.close();}
});
test('failed, mismatched or unavailable verification never reserves money or calls Jev',async()=>{
  for(const result of [{success:false},{success:1,hostname:'ai.rhyslindmark.com',action:'jev_check'},{success:true,hostname:'localhost',action:'jev_check'},{success:true,hostname:'ai.rhyslindmark.com',action:'rhysbot_chat'},null]){
    const db=database();try{let calls=0;const h=createHandler(async url=>{assert.ok(url.includes('/siteverify'));calls++;return Response.json(result);});assert.equal((await h({request:request(),env:environment(db)})).status,403);assert.equal(calls,1);assert.equal(db.raw.prepare('SELECT reserved_micros FROM jev_budget').get().reserved_micros,0);}finally{db.raw.close();}
  }
});
test('rate and lifetime budget SQL remain bounded under concurrent calls and persist across handler instances',async()=>{
  const db=database();try{
    const results=await Promise.all(Array.from({length:30},()=>reserve(db,'same-person',1793140000000)));
    assert.equal(results.filter(x=>x===null).length,10);
    assert.equal(db.raw.prepare('SELECT reserved_micros FROM jev_budget').get().reserved_micros,100000);
    db.raw.exec('UPDATE jev_budget SET reserved_micros=19990000');
    const last=await Promise.all(Array.from({length:10},(_,i)=>reserve(db,'person-'+i,1793140000000)));
    assert.equal(last.filter(x=>x===null).length,1);
    assert.equal(db.raw.prepare('SELECT reserved_micros FROM jev_budget').get().reserved_micros,20000000);
    assert.match(await reserve(db,'another-person',1793226400000),/paused/);
    assert.equal(db.raw.prepare('SELECT reserved_micros FROM jev_budget').get().reserved_micros,20000000);
  }finally{db.raw.close();}
});
test('daily ceiling and kill switch stop valid humans; no budget refund after upstream timeout',async()=>{
  const db=database();try{
    const time=1793140000000;const results=await Promise.all(Array.from({length:110},(_,i)=>reserve(db,'visitor-'+i,time)));
    assert.equal(results.filter(x=>x===null).length,100);
    db.raw.exec('UPDATE jev_budget SET enabled=0');assert.match(await reserve(db,'tomorrow',time+86400000),/paused/);
    db.raw.exec('UPDATE jev_budget SET enabled=1');
    db.raw.exec('DELETE FROM jev_limits');
    const before=db.raw.prepare('SELECT reserved_micros FROM jev_budget').get().reserved_micros;
    const h=createHandler(async url=>{if(url.includes('/siteverify'))return Response.json({success:true,hostname:'ai.rhyslindmark.com',action:'jev_check'});throw Error('timeout');});
    const r=await h({request:request(),env:environment(db)});assert.equal(r.status,502);
    assert.equal(db.raw.prepare('SELECT reserved_micros FROM jev_budget').get().reserved_micros,before+10000);
  }finally{db.raw.close();}
});
test('missing key, database, salt, feature flag, trusted IP or available database fails closed',async()=>{
  const db=database();try{for(const field of ['JEV_API_KEY','JEV_DB','JEV_KEY_SECRET','JEV_TURNSTILE_SECRET','JEV_ENABLED']){let calls=0;const env=environment(db);delete env[field];const h=createHandler(()=>{calls++;throw Error()});assert.equal((await h({request:request(),env})).status,503);assert.equal(calls,0);}
    const h=createHandler(()=>{throw Error('must not call')});assert.equal((await h({request:request({}, {'CF-Connecting-IP':''}),env:environment(db)})).status,403);
    const unavailable={prepare(){throw Error('database unavailable')}};const v=createHandler(async()=>Response.json({success:true,hostname:'ai.rhyslindmark.com',action:'jev_check'}));assert.equal((await v({request:request(),env:environment(unavailable)})).status,503);
  }finally{db.raw.close();}
});

test('one-time provisioning encrypts the key, rejects other keys, and cannot overwrite it',async()=>{
  const {createSetupHandler}=await import('./jev-setup.js');
  const setup=createSetupHandler(async()=>Response.json({success:false,'error-codes':['invalid-input-response']}));
  const {loadKey}=await import('../_lib/jev-key.js');
  const db=database();try{
    const key='owner-test-key-not-a-real-credential';
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),n=>n.toString(16).padStart(2,'0')).join('');
    const env={JEV_DB:db,JEV_KEY_SECRET:'test-encryption-secret',JEV_TURNSTILE_SECRET:'test-turnstile-secret',JEV_SETUP_KEY_SHA256:digest};
    const req=value=>new Request('https://ai.rhyslindmark.com/api/jev-setup',{method:'POST',headers:{Origin:'https://ai.rhyslindmark.com','Content-Type':'application/json'},body:JSON.stringify({key:value})});
    assert.equal((await setup({request:req(key),env:{...env,JEV_SETUP_KEY_SHA256:''}})).status,404);
    assert.equal((await setup({request:req('unapproved-test-key'),env})).status,403);
    assert.equal((await setup({request:req(key),env})).status,200);
    const saved=db.raw.prepare('SELECT iv,ciphertext FROM jev_credentials').get();
    assert.ok(!JSON.stringify(saved).includes(key));assert.equal(await loadKey(env),key);
    assert.equal((await setup({request:req(key),env})).status,409);
    await assert.rejects(loadKey({...env,JEV_KEY_SECRET:'wrong-secret'}));
    db.raw.prepare('UPDATE jev_credentials SET ciphertext=?').run(saved.ciphertext.slice(0,-4)+'AAAA');
    await assert.rejects(loadKey(env));
  }finally{db.raw.close();}
});
