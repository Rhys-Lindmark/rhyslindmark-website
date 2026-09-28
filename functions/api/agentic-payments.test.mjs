import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePayments,onRequestGet} from './agentic-payments.js';
test('calculates a rate across the complete source bucket window',()=>{
 const result=summarizePayments({stats:{json:[{bucket_start:'2026-09-28T00:30:00Z',total_transactions:1800},{bucket_start:'2026-09-28T00:00:00Z',total_transactions:3600}]}},new Date('2026-09-28T01:00:00Z'));
 assert.equal(result.agentRate,1.5);assert.equal(result.transactions,5400);assert.equal(result.windowSeconds,3600);
 assert.equal(result.sampledAt,'2026-09-28T01:00:00.000Z');
});
test('rejects empty and invalid upstream data',()=>{
 assert.throws(()=>summarizePayments({stats:{json:[]}}));
 assert.throws(()=>summarizePayments({stats:{json:[{bucket_start:'bad',total_transactions:20},{bucket_start:'2026-09-28T00:00:00Z',total_transactions:-3}]}}));
});
test('handles upstream failure without leaking errors',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response('',{status:503});const response=await onRequestGet();assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'Payment data temporarily unavailable'})}finally{globalThis.fetch=original}
});
