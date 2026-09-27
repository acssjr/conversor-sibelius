# Conversor Sibelius

Aplicação React + Vite para reconhecer famílias do formato `.sib` e gerar uma cópia experimental com identificação compatível com Sibelius 2024. Todo o processamento ocorre no navegador, em um Web Worker. Nenhuma partitura é enviada a um servidor.

## Usar no navegador

[Abra o conversor](https://acssjr.github.io/conversor-sibelius/). O site usa o GitHub Pages; as partituras permanecem no seu navegador.

## Executar localmente

Requer Node.js 22.12 ou superior.

```sh
npm ci
npm run dev
```

Abra o endereço mostrado pelo Vite. Selecione ou arraste um `.sib`, confira o formato, gere e baixe uma cópia. Limite de 50 MiB, um arquivo por vez. A assinatura binária valida o arquivo, não apenas a extensão.

## Testar e compilar

```sh
npm test
npm run build
npm run preview
```

A produção é gerada em `docs/`, com caminhos relativos, pronta para hospedagem estática. No GitHub Pages, use a branch `main` e a pasta `/docs`. Após alterar o código, execute `npm run build` e inclua os arquivos atualizados de `docs/` no commit. O build de React usa módulos e deve ser servido por HTTP(S); use o servidor local ou o site publicado.

## Suporte

- Reconhece famílias documentadas no PRONOM, desde 1.2 até 2024.
- Reconhece `0045/0003` como formato recente; não determina o ano exato do programa criador.
- Perfil padrão: `0045/0003 → 0044/0003`.
- Perfil alternativo: `0045/0003 → 0044/0002`.
- Abertura confirmada pelo usuário em duas partituras no Sibelius 2024.6.1. Outros destinos ainda não foram testados.

Este ajuste modifica a identificação do formato; não traduz todos os recursos novos para equivalentes antigos. Não garante preservação musical universal. Sempre teste abertura, salvamento e reabertura de uma cópia no Sibelius de destino. O original permanece intacto.

## Estrutura

- `src/lib/sibelius.js`: reconhecimento, índices internos e patch verificado.
- `src/converter.worker.js`: processamento fora da interface; guarda o original em memória.
- `src/useConverter.js`: estado, troca de arquivos e ciclo de vida dos downloads.
- `src/App.jsx`: seleção, informações, opções e download.
- `tests/`: casos sintéticos; as partituras privadas não estão no repositório.
- `docs/`: versão compilada para hospedagem.

O leitor valida cabeçalhos, limites, tipos conhecidos, ciclos e sobreposições. Recusa estruturas desconhecidas e campos internos mistos. A saída passa por comparação byte a byte: só as posições previstas podem mudar. A interface informa “cópia gerada”, sem afirmar validação musical automática.

## Fontes

- [PRONOM: família 2024](https://pronom.nationalarchives.gov.uk/fmt/1993)
- [PRONOM: 2020.1](https://pronom.nationalarchives.gov.uk/fmt/1988)
- [Catálogo de assinaturas](https://pronom.nationalarchives.gov.uk/binary-signature.xml)

Software independente, sem vínculo com Avid. Não modifica licença, ativação ou instalação do Sibelius.
