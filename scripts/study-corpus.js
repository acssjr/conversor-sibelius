import { readdir,readFile,writeFile } from 'node:fs/promises';
import { join,extname,basename } from 'node:path';
import { createHash } from 'node:crypto';
import { inspect,analyze,convert } from '../src/lib/sibelius.js';
const roots=process.argv.slice(2);
if (!roots.length) throw new Error('Passe as pastas a examinar.');
const entries=[], magic=Buffer.from([15,83,73,66,69,76,73,85,83]);
async function walk(dir) {
  for (const file of await readdir(dir,{withFileTypes:true})) {
    const path=join(dir,file.name);
    if (file.isDirectory()) { await walk(path); continue; }
    const bytes=await readFile(path), entry={path,name:file.name,extension:extname(path).toLowerCase(),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    if (entry.extension==='.sib') {
      try {
        Object.assign(entry,inspect(bytes));
        const headers=[]; let position=0;
        while ((position=bytes.indexOf(magic,position))!==-1) {
          if (position+26<=bytes.length) headers.push({offset:position,major:bytes.readUInt16BE(position+10),revision:bytes.readUInt16BE(position+12),kind:bytes.readUInt32BE(position+18),count:bytes.readUInt32BE(position+22)});
          position++;
        }
        entry.headers=headers;
        const visited=new Set(),pending=[0],problems=[];
        while (pending.length) {
          const offset=pending.pop(); if (visited.has(offset)) continue;
          const header=headers.find(h=>h.offset===offset);
          if (!header) { problems.push('missing-header:'+offset); continue; }
          visited.add(offset);
          if (header.kind===48 && header.count<=Math.floor((bytes.length-offset-26)/8)) {
            for (let i=0;i<header.count;i++) {
              const type=bytes.readUInt32BE(offset+26+i*8),target=bytes.readUInt32BE(offset+30+i*8);
              if (type || target) pending.push(target);
            }
          } else if (header.kind!==58 || header.count!==0) problems.push('unsupported-table:'+offset);
        }
        entry.index={reachable:visited.size,allHeadersReachable:headers.every(h=>visited.has(h.offset)),problems};
        const analysis=analyze(bytes); entry.convertible=analysis.convertible; entry.reason=analysis.reason;
        if (analysis.convertible) entry.profiles=['minimal','alternative'].map(profile=> {
          const result=convert(bytes,profile);
          return {profile,headers:result.report.headers,changedBytes:result.report.changedBytes,byteVerification:result.report.byteVerification,outputSha256:createHash('sha256').update(result.bytes).digest('hex'),musicalValidation:false};
        });
      } catch(error) { entry.error=error.message; }
    }
    entries.push(entry);
  }
}
for (const root of roots) await walk(root);
const groups={};
for (const entry of entries.filter(e=>e.extension==='.sib')) {
  const key=entry.major+'/'+entry.revision;
  (groups[key] ||= []).push(entry.name);
}
const result={createdAt:new Date().toISOString(),roots,total:entries.length,scores:entries.filter(e=>e.extension==='.sib').length,groups,entries};
await writeFile('../estudo-acervo-sibelius.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({total:result.total,scores:result.scores,groups,conversions:entries.filter(e=>e.convertible).map(e=>({name:e.name,headers:e.headers.length})),indexProblems:entries.filter(e=>e.index && !e.index.allHeadersReachable).map(e=>e.name)},null,2));
