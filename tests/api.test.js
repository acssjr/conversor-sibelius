import test from 'node:test';
import assert from 'node:assert/strict';
import { api,CLOUD_LIMIT } from '../server/api.js';
import { convert } from '../src/lib/sibelius.js';
function score() {
  const bytes=new Uint8Array(100),v=new DataView(bytes.buffer);
  for (const p of [0,60]) { bytes.set([15,83,73,66,69,76,73,85,83,0,0,69,0,3],p); v.setUint32(p+18,p===0?48:58); }
  v.setUint32(22,1); v.setUint32(26,1); v.setUint32(30,60); return bytes;
}
const request=(path,bytes=score(),headers={})=>new Request('https://example.test/api/'+path,{method:'POST',headers:{'content-type':'application/octet-stream',...headers},body:bytes});
test('cloud analyzes and returns only summary',async()=>{
  const response=await api(request('analyze')),info=await response.json();
  assert.equal(response.status,200); assert.equal(info.headers,2); assert.equal(info.convertible,true); assert.equal(info.structure,undefined);
});
for (const profile of ['minimal','alternative']) test('cloud returns verified bytes and complete report: '+profile,async()=>{
  const bytes=score(),response=await api(request('convert?profile='+profile,bytes)),form=await response.formData();
  assert.deepEqual(new Uint8Array(await form.get('score').arrayBuffer()),convert(bytes,profile).bytes);
  const report=JSON.parse(await form.get('report').text()); assert.equal(report.byteVerification,true); assert.equal(report.processing,'cloud'); assert.equal(bytes[11],69);
});
test('cloud rejects invalid input and unknown profile',async()=>{
  assert.equal((await api(request('analyze',new Uint8Array(20)))).status,422);
  assert.equal((await api(request('convert?profile=invalid'))).status,422);
});
test('cloud limits declared and streamed uploads',async()=>{
  assert.equal((await api(request('analyze',score(),{'content-length':String(CLOUD_LIMIT+1)}))).status,413);
  assert.equal((await api(request('analyze',new Uint8Array(CLOUD_LIMIT+1)))).status,413);
});
test('cloud permits Pages CORS and rejects other browser origins',async()=>{
  const response=await api(request('analyze',score(),{origin:'https://acssjr.github.io'}));
  assert.equal(response.headers.get('access-control-allow-origin'),'https://acssjr.github.io');
  assert.equal((await api(request('analyze',score(),{origin:'https://other.test'}))).status,403);
  const preflight=await api(new Request('https://example.test/api/convert',{method:'OPTIONS',headers:{origin:'https://acssjr.github.io'}}));
  assert.equal(preflight.status,204); assert.match(preflight.headers.get('access-control-allow-methods'),/POST/);
});
test('cloud exposes health and does not accept accidental GET conversions',async()=>{
  const response=await api(new Request('https://example.test/api/health'));
  assert.equal((await response.json()).storage,'none');
  assert.equal((await api(new Request('https://example.test/api/convert'))).status,405);
});
