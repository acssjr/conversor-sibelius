import { useEffect, useRef, useState } from 'react';
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/,'');
const LIMIT = 20 * 1024 * 1024;
export function useConverter() {
  const ticket = useRef(0), currentFile = useRef(null), urls = useRef([]), controller = useRef(null);
  const [state,setState] = useState({phase:'empty'});
  const revoke = () => { urls.current.forEach(url=>URL.revokeObjectURL(url)); urls.current=[]; };
  useEffect(()=>()=>{ controller.current?.abort(); revoke(); },[]);
  async function send(path,file,signal) {
    const response = await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file,signal,credentials:'omit'});
    if (!response.ok) {
      let message = 'O serviço em nuvem não concluiu o processamento. Tente novamente.';
      try { message = (await response.json()).error || message; } catch {}
      throw new Error(message);
    }
    return response;
  }
  async function selectFile(file) {
    const id = ++ticket.current; controller.current?.abort(); controller.current=new AbortController();
    revoke(); currentFile.current=file;
    if (file.size > LIMIT) { setState({phase:'error',error:'O limite em nuvem é de 20 MiB por arquivo.'}); return; }
    setState({phase:'reading',file});
    try {
      const info = await (await send('/api/analyze',file,controller.current.signal)).json();
      if (id===ticket.current) setState({phase:'ready',file,info});
    } catch(error) { if (id===ticket.current && error.name!=='AbortError') setState({phase:'error',error:error.message}); }
  }
  async function generate(profile) {
    if (!state.info?.convertible || state.phase==='converting') return;
    const id = ticket.current, file = currentFile.current;
    controller.current?.abort(); controller.current=new AbortController(); revoke();
    setState(previous=>({...previous,phase:'converting',result:null,error:null}));
    try {
      const form = await (await send('/api/convert?profile='+encodeURIComponent(profile),file,controller.current.signal)).formData();
      if (id!==ticket.current) return;
      const score=form.get('score'), reportFile=form.get('report');
      if (!(score instanceof Blob) || !(reportFile instanceof Blob)) throw new Error('O serviço retornou uma resposta incompleta.');
      const stem=file.name.replace(/\.sib$/i,''), name=stem+' - compat-2024'+(profile==='alternative'?' - alternativa':'')+'.sib';
      const report={...JSON.parse(await reportFile.text()),sourceName:file.name,outputName:name,createdAt:new Date().toISOString()};
      if (id!==ticket.current) return;
      const fileUrl=URL.createObjectURL(score),reportUrl=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
      urls.current=[fileUrl,reportUrl];
      setState(previous=>({...previous,phase:'done',error:null,result:{name,fileUrl,reportUrl,reportName:stem+' - relatorio.json',report}}));
    } catch(error) { if (id===ticket.current && error.name!=='AbortError') setState(previous=>({...previous,phase:'error',result:null,error:error.message})); }
  }
  function clearResult() { revoke(); setState(previous=>({...previous,phase:previous.info?'ready':previous.phase,result:null,error:null})); }
  function showError(error) { ticket.current++; controller.current?.abort(); revoke(); currentFile.current=null; setState({phase:'error',error}); }
  return {state,selectFile,generate,clearResult,showError};
}
