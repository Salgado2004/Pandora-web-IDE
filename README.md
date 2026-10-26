# Pandora IDE

Primeiro protótipo do editor visual Pandora. O aplicativo é independente do
monorepo do Excalidraw e usa `@excalidraw/excalidraw` somente como infraestrutura
gráfica.

## Executar

```powershell
npm install
npm run dev
```

Para gerar a versão de produção:

```powershell
npm run build
```

## O que está implementado

- formas Pandora derivadas do vocabulário visual aprovado;
- nós `lig`, `soma` e `visor` como cena inicial;
- seleção e movimentação pelo Excalidraw;
- painel lateral para trocar o tipo do nodo;
- edição do valor de um nodo `const`;
- `visor` derivado e bloqueado quando associado a um `disor`;
- metadados `customData` com a identidade semântica do nodo;
- definição da função atual, com nome e parâmetros editáveis;
- função `main` criada automaticamente como ponto de entrada inicial, sem ser
  obrigatória;
- criação de funções pelo menu **Novo → função**;
- navegação para o quadro interno da função por duplo clique e breadcrumb;
- edição do nome e da aridade da função;
- seleção da função de entrada no painel de propriedades e edição dos valores
  dos parâmetros no painel de execução;
- exclusão de funções pelo painel de propriedades;
- configuração de nodos `encp` com uma função definida no programa, herdando
  seu nome, aridade de entradas e uma saída;
- menu **Novo** contextual: na cena do programa cria apenas funções e, dentro
  de uma função, cria apenas nodos;
- nodos `lig` com conectores opcionais `input` e `output` para representar as
  entradas e a saída da função, respeitando sua aridade;
- criação de novos nodos pelo menu **Novo**, com seleção automática e abertura
  imediata no painel de propriedades;
- conexões explícitas entre nodos, com setas, portas e remoção sincronizada;
- portas numeradas e nodos agrupados para reorganização por arraste;
- criação de uma conexão pelo painel, usando o nodo selecionado como origem;
- atualização da cena quando o modelo muda.
- exportação do programa para o JSON aceito pelo interpretador, com download
  pelo botão **Exportar**;
- importação de programas Pandora por arquivo JSON pelo botão **Importar**;
- execução do programa atual pelo interpretador, com exibição do resultado ou
  do erro no painel de execução inferior, no estilo de um terminal;
- minimização independente dos painéis de propriedades e de execução;
- configuração do nome do programa, usado no campo `nome` do JSON e no arquivo
  baixado;
- visualização expandida e estática das funções na cena do programa, com
  edição disponível pelo botão **Editar função**;
- representação compacta dos nodos na cena do programa, sem portas visuais,
  com textos preservados apenas para operações lógicas e aritméticas;

Ainda não fazem parte deste incremento:

- validação semântica completa (a criação já respeita a aridade das entradas);
- persistência e colaboração.
