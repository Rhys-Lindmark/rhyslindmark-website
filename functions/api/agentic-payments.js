// Fixed-source proxy: agentic.market does not allow this site's browser origin.
export function summarizePayments(payload,now=new Date()){
 const rows=payload?.stats?.json;
 if(!Array.isArray(rows)||rows.length<2)throw new Error('Missing payment buckets');
 const buckets=rows.map(row=>({time:Date.parse(row.bucket_start),count:Number(row.total_transactions)})).filter(row=>Number.isFinite(row.time)&&Number.isFinite(row.count)&&row.count>=0).sort((a,b)=>a.time-b.time);
 if(buckets.length<2)throw new Error('Invalid payment buckets');
 const intervals=buckets.slice(1).map((row,i)=>(row.time-buckets[i].time)/1000).filter(n=>n>0).sort((a,b)=>a-b);
 if(!intervals.length)throw new Error('Invalid payment window');
 const bucketSeconds=intervals[Math.floor(intervals.length/2)];
 const windowSeconds=(buckets.at(-1).time-buckets[0].time)/1000+bucketSeconds;
 const transactions=buckets.reduce((sum,row)=>sum+row.count,0);
 return {agentRate:transactions/windowSeconds,transactions,windowSeconds,sampledAt:now.toISOString()};
}
export async function onRequestGet(){
 try{
  const response=await fetch('https://api.agentic.market/v1/ecosystem/stats?timeframe=1',{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Upstream payment API unavailable');
  const data=summarizePayments(await response.json());
  return Response.json(data,{headers:{'Cache-Control':'public, max-age=60'}});
 }catch{
  return Response.json({error:'Payment data temporarily unavailable'},{status:502});
 }
}
