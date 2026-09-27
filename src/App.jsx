import { useEffect, useRef, useState } from 'react';
import { useConverter } from './useConverter.js';

function FilePicker({ onSelect, onError, busy }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const prevent = event => event.preventDefault();
    window.addEventListener('dragover', prevent); window.addEventListener('drop', prevent);
    return () => { window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent); };
  }, []);
  return <section className={'drop' + (dragging ? ' over' : '')} aria-label="Selecionar partitura"
    onDragOver={event => { event.preventDefault(); setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) return onError('Escolha uma partitura por vez.'); onSelect(event.dataTransfer.files[0]); }}>
    <div className="staff" aria-hidden="true"><span>♪</span></div>
    <h2>Arraste sua partitura aqui</h2>
    <p>ou escolha um arquivo do seu computador</p>
    <button type="button" onClick={() => input.current.click()}>Escolher arquivo .sib</button>
    <input ref={input} type="file" accept=".sib" hidden onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) onSelect(file); }} />
    <p className="hint">Um arquivo por vez, até 20 MiB. O original permanece intacto.</p>
    {busy && <span className="processing">Enviando e processando em nuvem…</span>}
  </section>;
}

export default function App() {
  const { state, selectFile, generate, clearResult, showError } = useConverter();
  const [alternative, setAlternative] = useState(false);
  const busy = state.phase === 'reading' || state.phase === 'converting';
  const select = file => { setAlternative(false); selectFile(file); };
  let message = '';
  if (state.phase === 'reading') message = 'Lendo e verificando a estrutura da partitura…';
  if (state.phase === 'ready') message = state.info.convertible ? 'Arquivo reconhecido. Escolha o destino para gerar sua cópia.' : 'Arquivo analisado. Veja abaixo as opções disponíveis.';
  if (state.phase === 'converting') message = 'Gerando e verificando a cópia…';
  if (state.phase === 'done') message = 'Cópia gerada. Baixe e teste a abertura no seu Sibelius.';
  if (state.phase === 'error') message = state.error;
  return <main>
    <header><a className="brand" href="./" aria-label="Conversor Sibelius, início">Sibelius conversor</a><span className="local"><span aria-hidden="true">●</span> Processamento em nuvem</span></header>
    <div className="intro"><h1>Abra caminho para sua partitura.</h1><p className="lead">Veja o formato do seu arquivo Sibelius e gere uma cópia para uma versão anterior.</p></div>
    <FilePicker onSelect={select} onError={showError} busy={busy} />
    <div className={'message' + (state.phase === 'error' ? ' error' : '')} role="status" aria-live="polite" hidden={!message}>{message}</div>
    {state.info && <section className="workspace" aria-busy={state.phase === 'converting'}>
      <div className="file-summary"><h2>Sua partitura</h2><p className="filename">{state.file.name}</p><p className="meta">{new Intl.NumberFormat('pt-BR').format(state.file.size)} bytes</p><p className="pill">{state.info.label}</p>{state.info.convertible && <p className="meta">{state.info.headers} cabeçalhos internos verificados.</p>}</div>
      <div>
        {state.info.convertible ? <div className="control"><h2>Gerar uma cópia</h2><label htmlFor="target">Versão de destino</label><select id="target" disabled={busy} defaultValue="2024"><option value="2024">Sibelius 2024 — experimental</option></select><p className="note">Abertura confirmada em duas partituras no Sibelius 2024.6.1. As revisões 0009 e 000E passaram por verificação binária em dez arquivos, mas ainda precisam de teste de abertura. Recursos novos podem não ser preservados.</p>
          <details className="advanced"><summary>Opção alternativa</summary><label><input type="checkbox" disabled={busy} checked={alternative} onChange={event => { setAlternative(event.target.checked); clearResult(); }} />Usar a revisão de destino 0002 em vez de 0003. As duas opções abriram nos dois arquivos originalmente testados.</label></details>
          <button type="button" disabled={busy} onClick={() => generate(alternative ? 'alternative' : 'minimal')}>{state.phase === 'converting' ? 'Gerando cópia…' : 'Gerar cópia para 2024'}</button></div>
          : <div><h2>Opções para este arquivo</h2><p>{state.info.reason}</p><p className="note">Novos destinos serão adicionados conforme forem testados.</p></div>}
        {state.result && <div className="result"><a className="download" href={state.result.fileUrl} download={state.result.name}>Baixar cópia .sib</a><p>{state.result.report.changedBytes} bytes alterados em {state.result.report.headers} cabeçalhos. Todos os outros bytes foram preservados.</p><a className="download secondary" href={state.result.reportUrl} download={state.result.reportName}>Baixar relatório técnico</a></div>}
      </div>
    </section>}
    <details className="explanation"><summary>Como funciona</summary><p>A ferramenta reconhece a família do formato pelo cabeçalho e ajusta sua identificação em uma cópia. O destino 2024 aceita os formatos recentes 0045/0003, 0045/0009 e 0045/000E após verificar todos os cabeçalhos e o índice interno. A abertura foi confirmada apenas para 0045/0003. Ele não substitui a exportação oficial de todos os recursos para versões anteriores.</p><p>As partituras são enviadas por HTTPS e processadas no servidor. O aplicativo não grava os arquivos em banco de dados ou armazenamento permanente; cada análise e conversão usa o arquivo apenas durante a requisição. A verificação confirma quais bytes mudaram; a abertura e o conteúdo musical devem ser conferidos no Sibelius.</p></details>
    <footer><span>Versão 0.3.0. Ferramenta independente, sem vínculo com a Avid.</span><a href="https://github.com/acssjr/conversor-sibelius" target="_blank" rel="noreferrer">Código no GitHub</a></footer>
  </main>;
}


