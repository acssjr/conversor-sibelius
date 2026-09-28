import { analyze, convert, FormatError } from '../src/lib/sibelius.js';
import { catalogFor, recordFeedback } from './catalog.js';
export const CLOUD_LIMIT = 20 * 1024 * 1024;
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control':'no-store'}});
async function readBytes(request) {
  const length = request.headers.get('content-length');
  if (length !== null && Number(length) > CLOUD_LIMIT) throw new RangeError('O limite em nuvem é de 20 MiB por arquivo.');
  if (!request.body) throw new FormatError('Envie uma partitura .sib.');
  const reader = request.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) { const {done,value} = await reader.read(); if (done) break;
      size += value.length; if (size > CLOUD_LIMIT) { await reader.cancel(); throw new RangeError('O limite em nuvem é de 20 MiB por arquivo.'); } chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  return bytes;
}
export async function api(request,env={}) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const allowed = origin === url.origin || origin === 'https://acssjr.github.io';
  if (origin && !allowed) return json({error:'Origem não autorizada.'},403);
  let response;
  if (request.method === 'OPTIONS') response = new Response(null,{status:204});
  else if (url.pathname === '/api/health' && request.method === 'GET') response = json({ok:true,processing:'cloud',version:'0.5.0',maxBytes:CLOUD_LIMIT,storage:env.DB?'feedback-only':'unavailable'});
  else if (!['/api/analyze','/api/convert','/api/feedback'].includes(url.pathname)) response = json({error:'Rota não encontrada.'},404);
  else if (request.method !== 'POST') response = json({error:'Use POST para enviar a partitura.'},405);
  else if (url.pathname === '/api/feedback' && !env.DB) response = json({error:'O catálogo está temporariamente indisponível. Tente novamente.'},503);
  else {
    try {
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/octet-stream') return json({error:'Envie os bytes do arquivo como application/octet-stream.'},415);
      const bytes = await readBytes(request);
      if (url.pathname === '/api/analyze') {
        const info = analyze(bytes); const {structure,...summary} = info;
        if (info.convertible && info.provisional) {
          // Trial a real conversion in memory before offering an uncatalogued format.
          convert(bytes,'minimal');
          summary.trialVerified = true;
        }
        summary.catalog = await catalogFor(env.DB,info.major,info.revision);
        summary.catalogued = !!(summary.catalog?.minimal.yes || summary.catalog?.alternative.yes);
        if (info.provisional && summary.catalogued) summary.label = 'Formato recente com abertura relatada — '+info.label.match(/\(([^)]+)\)/)?.[1];
        response = json({...summary,headers:structure?.nodes.length || 0});
      } else if (url.pathname === '/api/feedback') {
        const worked=url.searchParams.get('worked');
        if (!['yes','no'].includes(worked)) throw new FormatError('Escolha Sim ou Não.');
        const result=await recordFeedback(env.DB,bytes,url.searchParams.get('profile'),worked==='yes');
        response=json(result);
      } else {
        const profile = url.searchParams.get('profile') || 'minimal';
        const result = convert(bytes,profile);
        const form = new FormData();
        form.append('score',new Blob([result.bytes],{type:'application/octet-stream'}),'converted.sib');
        form.append('report',new Blob([JSON.stringify({...result.report,toolVersion:'0.5.0',processing:'cloud'})],{type:'application/json'}),'report.json');
        response = new Response(form,{headers:{'Cache-Control':'no-store'}});
      }
    } catch (error) {
      response = json({error:error instanceof FormatError || error instanceof RangeError ? error.message : 'Não foi possível processar a partitura.'},error instanceof RangeError ? 413 : error instanceof FormatError ? 422 : 500);
    }
  }
  if (allowed && origin) {
    response.headers.set('Access-Control-Allow-Origin',origin);
    response.headers.set('Vary','Origin');
    response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers','Content-Type');
  }
  response.headers.set('X-Content-Type-Options','nosniff');
  return response;
}

