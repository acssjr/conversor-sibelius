import { analyze, convert, MAX_BYTES } from './lib/sibelius.js';

let current = null;
let generation = 0;
self.onmessage = async ({ data }) => {
  const { type, id } = data;
  try {
    if (type === 'analyze') {
      generation = id;
      current = null;
      if (data.file.size > MAX_BYTES) throw new Error('O limite desta versão é de 50 MiB por arquivo.');
      const bytes = new Uint8Array(await data.file.arrayBuffer());
      if (generation !== id) return;
      const info = analyze(bytes);
      current = { id, bytes };
      const { structure, ...summary } = info;
      self.postMessage({ type: 'analyzed', id, info: { ...summary, headers: structure?.nodes.length || 0 } });
    } else if (type === 'convert') {
      if (!current || current.id !== id) throw new Error('Selecione a partitura novamente.');
      const result = convert(current.bytes, data.profile);
      self.postMessage({ type: 'converted', id, profile: data.profile, bytes: result.bytes.buffer, report: result.report }, [result.bytes.buffer]);
    } else {
      throw new Error('Operação desconhecida.');
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error.message || 'Não foi possível processar a partitura.' });
  }
};
