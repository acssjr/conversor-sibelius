import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/lib/sibelius.js';
function header(b,p,major=69,revision=3,kind=58,count=0){b.set([15,83,73,66,69,76,73,85,83],p);const v=new DataView(b.buffer);v.setUint16(p+10,major);v.setUint16(p+12,revision);v.setUint32(p+18,kind);v.setUint32(p+22,count);}
function sample(){const b=new Uint8Array(100);header(b,0,69,3,48,2);const v=new DataView(b.buffer);v.setUint32(26,1);v.setUint32(30,42);header(b,42);return b;}
test('detects documented families and precise 2020.1 revision',()=>{for(const [major,revision,label] of [[68,2,'2024'],[67,0,'2023.5–2023.8'],[63,11,'2020.1'],[63,10,'8.6–2019.12'],[0,14,'1.2']]){const b=new Uint8Array(26);header(b,0,major,revision);assert.equal(core.inspect(b).family,label);}});
test('validates every indexed header and copies without touching original',()=>{const b=sample(),original=b.slice(),r=core.convert(b);assert.equal(r.report.headers,2);assert.equal(r.report.changedBytes,2);assert.deepEqual(b,original);for(let i=0;i<b.length;i++)assert.equal(r.bytes[i],i===11||i===53?68:b[i]);});
test('alternative changes precisely both fields',()=>{const b=sample(),r=core.convert(b,'alternative');assert.equal(r.report.changedBytes,4);assert.equal(r.bytes[13],2);assert.equal(r.bytes[55],2);assert.equal(r.bytes.length,b.length);});
test('rejects bad signature, short files and unknown profile',()=>{assert.throws(()=>core.inspect(new Uint8Array(0)),core.FormatError);assert.throws(()=>core.inspect(new Uint8Array(30)),core.FormatError);assert.throws(()=>core.convert(sample(),'bogus'),core.FormatError);});
test('old or unknown formats do not get conversions',()=>{const b=sample();header(b,0,68,2);assert.equal(core.analyze(b).convertible,false);header(b,0,71,0);assert.equal(core.analyze(b).family,null);assert.throws(()=>core.convert(b),core.FormatError);});
test('rejects mixed versions',()=>{const b=sample();header(b,42,68,2);assert.match(core.analyze(b).reason,/versões internas/);});
test('rejects out-of-bounds references and excessive counts',()=>{const b=sample(),v=new DataView(b.buffer);v.setUint32(30,99);assert.match(core.analyze(b).reason,/referência/);v.setUint32(22,0xffffffff);assert.match(core.analyze(b).reason,/contagem/);});
test('rejects cyclic indexes',()=>{const b=sample(),v=new DataView(b.buffer);v.setUint32(30,0);assert.match(core.analyze(b).reason,/ciclo/);});
test('rejects unindexed signatures',()=>{const b=sample();b.set([15,83,73,66,69,76,73,85,83],80);assert.match(core.analyze(b).reason,/fora do índice/);});
test('rejects unrecognized structural types and nonzero leaf count',()=>{const b=sample();new DataView(b.buffer).setUint32(60,99);assert.equal(core.analyze(b).convertible,false);header(b,42,69,3,58,1);assert.equal(core.analyze(b).convertible,false);});
test('supports nested absolute references',()=>{const b=new Uint8Array(140);header(b,0,69,3,48,1);const v=new DataView(b.buffer);v.setUint32(26,4);v.setUint32(30,40);header(b,40,69,3,48,1);v.setUint32(66,5);v.setUint32(70,80);header(b,80);assert.equal(core.convert(b).report.headers,3);});
test('Node Buffers are copied instead of mutated',()=>{const b=Buffer.from(sample()),original=Buffer.from(b);core.convert(b);assert.deepEqual(b,original);});
for (const revision of [9,14]) test('observed corpus revision '+revision+' maps every header to destination revision',()=>{
  const b=sample(); header(b,0,69,revision,48,2); header(b,42,69,revision);
  const original=b.slice();
  for (const profile of ['minimal','alternative']) {
    const result=core.convert(b,profile), target=profile==='minimal'?3:2;
    assert.equal(result.report.source.revision,revision); assert.equal(result.report.changedBytes,4);
    for (const p of [0,42]) { assert.equal(result.bytes[p+11],68); assert.equal(result.bytes[p+13],target); }
    assert.deepEqual(b,original);
  }
});
test('unobserved recent revision remains unsupported',()=>{
  const b=sample(); header(b,0,69,15,48,2); header(b,42,69,15);
  assert.equal(core.analyze(b).convertible,false);
});
