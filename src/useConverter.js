import { useEffect, useRef, useState } from 'react';

export function useConverter() {
  const worker = useRef(null);
  const ticket = useRef(0);
  const currentFile = useRef(null);
  const urls = useRef([]);
  const [state, setState] = useState({ phase: 'empty' });
  const revoke = () => { urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = []; };

  useEffect(() => {
    let instance;
    try { instance = new Worker(new URL('./converter.worker.js', import.meta.url), { type: 'module' }); }
    catch { setState({ phase: 'error', error: 'Este navegador não iniciou o conversor. Tente uma versão atual do Chrome, Edge ou Firefox.' }); return; }
    worker.current = instance;
    instance.onmessage = ({ data }) => {
      if (data.id !== ticket.current) return;
      if (data.type === 'analyzed') setState({ phase: 'ready', file: currentFile.current, info: data.info });
      else if (data.type === 'error') { revoke(); setState(previous => ({ ...previous, phase: 'error', result: null, error: data.message })); }
      else if (data.type === 'converted') {
        revoke();
        const stem = currentFile.current.name.replace(/\.sib$/i, '');
        const name = stem + ' - compat-2024' + (data.profile === 'alternative' ? ' - alternativa' : '') + '.sib';
        const fileUrl = URL.createObjectURL(new Blob([data.bytes], { type: 'application/octet-stream' }));
        const report = { ...data.report, toolVersion: '0.2.0', sourceName: currentFile.current.name, outputName: name, createdAt: new Date().toISOString() };
        const reportUrl = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
        urls.current = [fileUrl, reportUrl];
        setState(previous => ({ ...previous, phase: 'done', error: null, result: { name, fileUrl, reportUrl, reportName: stem + ' - relatorio.json', report } }));
      }
    };
    instance.onerror = () => { revoke(); setState(previous => ({ ...previous, phase: 'error', result: null, error: 'O processamento foi interrompido. Recarregue a página e tente novamente.' })); };
    return () => { instance.terminate(); if (worker.current === instance) worker.current = null; revoke(); };
  }, []);

  function selectFile(file) {
    ticket.current += 1; revoke(); currentFile.current = file;
    if (!worker.current) { setState({ phase: 'error', error: 'Recarregue a página para iniciar o conversor.' }); return; }
    setState({ phase: 'reading', file });
    worker.current.postMessage({ type: 'analyze', id: ticket.current, file });
  }
  function generate(profile) {
    if (!worker.current || !state.info?.convertible || state.phase === 'converting') return;
    revoke(); setState(previous => ({ ...previous, phase: 'converting', result: null, error: null }));
    worker.current.postMessage({ type: 'convert', id: ticket.current, profile });
  }
  function clearResult() { revoke(); setState(previous => ({ ...previous, phase: previous.info ? 'ready' : previous.phase, result: null, error: null })); }
  function showError(error) { ticket.current += 1; revoke(); currentFile.current = null; setState({ phase: 'error', error }); }
  return { state, selectFile, generate, clearResult, showError };
}
