
  const MAGIC = [15,83,73,66,69,76,73,85,83];
  const MAX_BYTES = 50 * 1024 * 1024;
  const FAMILIES = {8:'2',10:'3',27:'4',45:'5',54:'6',57:'7',61:'7.5–8.0',62:'8.1–8.5',64:'2020.3–2022.5',65:'2022.7–2022.11',66:'2022.12–2023.3',67:'2023.5–2023.8',68:'2024'};
  class FormatError extends Error {}
  function fail(message) { throw new FormatError(message); }
  function magicAt(b, p) { return p >= 0 && p + 9 <= b.length && MAGIC.every((v,i) => b[p+i] === v); }
  function view(b) { return new DataView(b.buffer,b.byteOffset,b.byteLength); }
  function inspect(b) {
    if (!(b instanceof Uint8Array)) fail('Não foi possível ler os bytes do arquivo.');
    if (b.length > MAX_BYTES) fail('O limite desta versão é de 50 MiB por arquivo.');
    if (b.length < 14) fail('O arquivo está vazio ou tem um cabeçalho incompleto.');
    if (!magicAt(b,0)) fail('Este arquivo não tem a assinatura de uma partitura Sibelius .sib.');
    const v = view(b), major=v.getUint16(10,false), revision=v.getUint16(12,false);
    let family = FAMILIES[major] || null;
    if (major===0 && revision===14) family='1.2';
    if (major===63 && revision<=10) family='8.6–2019.12';
    if (major===63 && revision===11) family='2020.1';
    const candidate = b[9]===0 && major===69 && [3,9,14].includes(revision);
    return {size:b.length,major,revision,family,label:family ? 'Sibelius '+family : candidate ? 'Formato recente — versão exata não identificada' : 'Formato Sibelius não catalogado',candidate};
  }
  function analyzeStructure(b, sourceRevision) {
    const v=view(b), nodes=[], edges=[], intervals=[], visited=new Set(), active=new Set();
    // Iterative DFS avoids call-stack exhaustion from malformed input.
    const pending=[{offset:0,exit:false}];
    while (pending.length) {
      const event=pending.pop(), p=event.offset;
      if (event.exit) { active.delete(p); continue; }
      if (active.has(p)) fail('O índice interno contém um ciclo.');
      if (visited.has(p)) continue;
      if (!Number.isInteger(p) || p<0 || p+26>b.length || !magicAt(b,p)) fail('O índice aponta para um cabeçalho ausente ou incompleto.');
      if (b[p+9]!==0 || v.getUint16(p+10,false)!==69 || v.getUint16(p+12,false)!==sourceRevision) fail('O arquivo contém versões internas diferentes. Este caso ainda não é suportado.');
      const kind=v.getUint32(p+18,false), count=v.getUint32(p+22,false);
      if (kind!==48 && kind!==58) fail('A estrutura deste arquivo ainda não é suportada.');
      let end=p+26;
      if (kind===48) {
        if (!count || count>Math.floor((b.length-p-26)/8)) fail('A tabela interna está incompleta ou tem uma contagem inválida.');
        end+=count*8;
      } else if (count!==0) fail('Um bloco interno tem uma estrutura não reconhecida.');
      visited.add(p); active.add(p); nodes.push({offset:p,kind}); intervals.push([p,end]);
      pending.push({offset:p,exit:true});
      if (kind===48) {
        const children=[];
        for (let n=0;n<count;n++) {
          const type=v.getUint32(p+26+n*8,false), target=v.getUint32(p+30+n*8,false);
          if (type===0 && target===0) continue;
          if (![1,4,5,6,7].includes(type)) fail('O índice contém um tipo de bloco ainda não suportado.');
          if (target+26>b.length || !magicAt(b,target)) fail('Há uma referência interna fora dos limites ou inválida.');
          edges.push({from:p,type,to:target}); children.push(target);
        }
        for (let n=children.length-1;n>=0;n--) pending.push({offset:children[n],exit:false});
      }
    }
    intervals.sort((a,c)=>a[0]-c[0]);
    for (let i=1;i<intervals.length;i++) if (intervals[i][0]<intervals[i-1][1]) fail('Os cabeçalhos internos se sobrepõem.');
    let found=0;
    for (let p=0;p+9<=b.length;p++) if (b[p]===15 && magicAt(b,p)) {
      found++; if (!visited.has(p)) fail('Há um cabeçalho fora do índice conhecido. Não foi gerada uma cópia.');
    }
    if (found!==nodes.length) fail('Não foi possível confirmar todos os cabeçalhos internos.');
    nodes.sort((a,c)=>a.offset-c.offset);
    return {nodes,edges};
  }
  function analyze(b) {
    const info=inspect(b);
    if (!info.candidate) return {...info,convertible:false,reason:info.family ? 'Este arquivo já declara um formato de 2024 ou anterior. Não é necessário aplicar o ajuste para 2024.' : 'Não há um perfil de conversão testado para este formato.'};
    try { return {...info,convertible:true,structure:analyzeStructure(b,info.revision)}; }
    catch (e) { if (!(e instanceof FormatError)) throw e; return {...info,convertible:false,reason:e.message}; }
  }
  function convert(b,profile='minimal') {
    if (!['minimal','alternative'].includes(profile)) fail('Perfil de conversão desconhecido.');
    const info=analyze(b);
    if (!info.convertible) fail(info.reason);
    const changes=[];
    for (const node of info.structure.nodes) {
      changes.push({offset:node.offset+11,before:69,after:68});
      const revision = profile==='alternative' ? 2 : 3;
      if (info.revision!==revision) changes.push({offset:node.offset+13,before:info.revision,after:revision});
    }
    const output=new Uint8Array(b), planned=new Map(changes.map(c=>[c.offset,c]));
    for (const c of changes) { if (output[c.offset]!==c.before) fail('Os bytes de origem não correspondem ao perfil.'); output[c.offset]=c.after; }
    let actual=0;
    for (let i=0;i<b.length;i++) if (b[i]!==output[i]) {
      const c=planned.get(i); if (!c || output[i]!==c.after) fail('A verificação da cópia falhou.'); actual++;
    }
    if (actual!==changes.length || output.length!==b.length) fail('A verificação da cópia falhou.');
    return {bytes:output,report:{tool:'Sibelius conversor',toolVersion:'0.3.0',profile,source:{major:info.major,revision:info.revision},target:{major:68,revision:profile==='alternative'?2:3},size:b.length,headers:info.structure.nodes.length,changedBytes:changes.length,changes,byteVerification:true,musicalValidation:false}};
  }

export { inspect, analyze, convert, MAX_BYTES, FormatError };

