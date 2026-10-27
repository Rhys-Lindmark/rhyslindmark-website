import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseFor } from '../_lib/jev-database.js';
test('private ledger adapter takes precedence over exhausted D1 and forwards bound parameters',async()=>{
 const calls=[];const stub={async first(sql,params){calls.push(['first',sql,params]);return {uses:1}},async run(sql,params){calls.push(['run',sql,params]);return {success:true}}};
 const db=databaseFor({JEV_DB:{prepare(){throw Error('D1 quota exhausted')}},JEV_STATE:{getByName(name){assert.equal(name,'claim-check-production');return stub}}});
 assert.deepEqual(await db.prepare('SELECT key').first(),{uses:1});
 assert.deepEqual(await db.prepare('UPDATE limits WHERE bucket=?').bind('one').first(),{uses:1});
 await db.prepare('DELETE FROM limits WHERE expires<?').bind(123).run();
 assert.deepEqual(calls,[['first','SELECT key',[]],['first','UPDATE limits WHERE bucket=?',['one']],['run','DELETE FROM limits WHERE expires<?',[123]]]);
});
test('missing ledger fails closed and SQLite adapter remains available for isolated cap tests',()=>{
 assert.equal(databaseFor({}),null);const sqlite={prepare(){}};assert.equal(databaseFor({JEV_DB:sqlite}),sqlite);
});
