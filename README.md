# Conversor Sibelius

React + Vite com processamento em nuvem em um Worker HTTP. O navegador envia o arquivo por HTTPS, recebe a análise e pode pedir uma cópia para Sibelius 2024. O aplicativo não grava partituras em banco de dados, disco ou armazenamento de objetos. Respostas de funcionamento são guardadas em um banco D1.

[Usar o conversor](https://acssjr.github.io/conversor-sibelius/)

## Funcionamento

Um arquivo por vez, até 20 MiB. A análise e a conversão são requisições independentes: cada uma envia o original, processa em memória e devolve o resultado. Não há histórico nem URL persistente para partituras. Após testar uma cópia, a pessoa pode responder Sim ou Não; o catálogo guarda apenas código de formato, perfil, resposta e hash SHA-256 do arquivo. Respostas repetidas para o mesmo arquivo e perfil atualizam o registro, sem duplicar a contagem. Um sucesso relatado marca a revisão como catalogada por usuário; não é uma certificação oficial.

- POST /api/analyze: bytes application/octet-stream; resumo JSON.
- POST /api/convert?profile=minimal|alternative: mesmos bytes; resposta multipart contendo arquivo e relatório técnico completo.
- POST /api/feedback?profile=minimal|alternative&worked=yes|no: bytes originais; registra ou atualiza o teste e devolve as contagens.`n- GET /api/health: estado, versão e limite de upload.

O serviço valida o limite durante a leitura, assinatura, cabeçalhos, índices, ciclos, sobreposições e consistência de versões internas. Só modifica posições previstas e compara a saída byte a byte. CORS permite o frontend do GitHub Pages e o próprio serviço. Não registra nomes ou conteúdo das partituras. A hospedagem pode manter registros operacionais de requisições.

## Perfis

| Origem observada | Destino padrão | Alternativo | Evidência |
|---|---|---|---|
| 0045/0003 | 0044/0003 | 0044/0002 | Abertura confirmada em duas partituras no Sibelius 2024.6.1 |
| 0045/0009 | 0044/0003 | 0044/0002 | Seis partituras verificadas binariamente; abertura confirmada pelo usuário nos exemplos testados |
| 0045/000E | 0044/0003 | 0044/0002 | Quatro partituras verificadas binariamente; abertura confirmada pelo usuário nos exemplos testados |

Revisões recentes não catalogadas, como 0045/0001, passam por validação do índice e por uma conversão padrão em memória já no upload. Se a comparação byte a byte passar, o site oferece ambos os perfis e sinaliza que a abertura ainda depende de teste no Sibelius. Revisões estruturais desconhecidas são recusadas. O ano comercial exato das revisões recentes não é inferido. Famílias antigas do catálogo PRONOM são reconhecidas; destinos anteriores a 2024 não são oferecidos sem validação. Este ajuste de identificação não traduz todos os recursos novos. Confira abertura, conteúdo, salvamento e reabertura no Sibelius. O original permanece intacto.

## Desenvolvimento e publicação

Node.js 22.12 ou superior:

~~~sh
npm ci
npm run dev
npm test
npm run build:cloud
~~~

O Vite local e o GitHub Pages usam a API pública configurada em cloud-config.json, no campo cloud_origin. Para desenvolver a API, invoque api(Request) em Node ou execute o Worker compilado num runtime compatível com Fetch.

build:cloud compila o frontend para o Worker, incorpora seus arquivos estáticos e gera dist/server/index.js e dist/.openai/hosting.json. Depois gera o frontend do GitHub Pages em docs/, apontando para a API pública.

Publique o commit exato na fonte Git do Sites, empacote os diretórios .openai e dist preservando seus caminhos em tar (tar -cf cloud-build.tar .openai dist), salve uma versão e publique-a. Depois envie main ao GitHub: o Pages usa /docs. Tokens de publicação não pertencem ao repositório.

## Estudo do acervo

Foram examinadas 21 partituras e inventariados 16 arquivos auxiliares de duas pastas locais. Há quatro combinações: 0044/0002 (3), 0044/0003 (8), 0045/0009 (6) e 0045/000E (4). Todos os cabeçalhos encontrados nas 21 partituras são alcançáveis pelo índice. As dez recentes passaram pelos dois perfis e pela comparação binária.

scripts/study-corpus.js reproduz o inventário, hashes, formatos, cabeçalhos e verificações sem modificar os originais. Execute passando as pastas; o relatório detalhado é escrito fora do repositório para preservar caminhos e nomes privados. MP3, WMV e PDF são referências auxiliares; seus conteúdos não são estruturas .sib.

## Arquivos principais

- src/lib/sibelius.js: identificação e transformação verificada.
- server/api.js: leitura limitada e API sem armazenamento.
- server/index.js: Worker e arquivos estáticos.
- src/useConverter.js: upload, cancelamento de requisições antigas e downloads.
- tests/: testes sintéticos do motor, API e Worker legado.

## Fontes

- [PRONOM: Sibelius 2024](https://pronom.nationalarchives.gov.uk/fmt/1993)
- [Assinaturas PRONOM](https://pronom.nationalarchives.gov.uk/binary-signature.xml)
- [OpenAI Sites](https://github.com/openai/sites)

Ferramenta independente, sem vínculo com Avid. Não modifica licença, ativação ou instalação do Sibelius.





