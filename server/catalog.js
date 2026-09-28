import { analyze, convert, FormatError } from '../src/lib/sibelius.js';
export async function catalogFor(db,major,revision) {
  if (!db) return null;
  const rows=await db.prepare(
    'SELECT profile, SUM(CASE WHEN worked = 1 THEN 1 ELSE 0 END) AS yes_count, SUM(CASE WHEN worked = 0 THEN 1 ELSE 0 END) AS no_count FROM format_feedback WHERE major = ? AND revision = ? GROUP BY profile'
  ).bind(major,revision).all();
  const catalog={minimal:{yes:0,no:0},alternative:{yes:0,no:0}};
  for (const row of rows.results || []) if (catalog[row.profile]) catalog[row.profile]={yes:Number(row.yes_count),no:Number(row.no_count)};
  return catalog;
}
export async function recordFeedback(db,bytes,profile,worked) {
  if (!db) throw new Error('Catálogo indisponível no momento.');
  if (!['minimal','alternative'].includes(profile) || typeof worked!=='boolean') throw new FormatError('Resposta inválida.');
  const info=analyze(bytes);
  if (!info.convertible) throw new FormatError(info.reason);
  convert(bytes,profile);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  await db.prepare(
    'INSERT INTO format_feedback (score_hash, profile, major, revision, worked, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(score_hash, profile) DO UPDATE SET worked = excluded.worked, updated_at = excluded.updated_at'
  ).bind(hash,profile,info.major,info.revision,worked?1:0,new Date().toISOString()).run();
  return {major:info.major,revision:info.revision,profile,worked,catalog:await catalogFor(db,info.major,info.revision)};
}
