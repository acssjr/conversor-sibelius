import { api } from './api.js';
import assets from './generated-assets.js';
export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request,env);
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const asset = assets[path];
    if (!asset) return new Response('Not found',{status:404});
    return new Response(request.method === 'HEAD' ? null : asset.body,{
      headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':path.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"}
    });
  }
};
