<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Esquematiza Aí: o que saber antes de mexer

Leia isto inteiro antes do primeiro commit. São cinco minutos, e quase tudo que
está aqui é coisa que já quebrou em produção uma vez.

## São dois sistemas, não um

| Onde | O quê |
|---|---|
| `esquematizaai.com` | **Este projeto.** Next.js na Vercel. Vitrine, blog, notícias e painel |
| `loja.esquematizaai.com` | **WordPress com WooCommerce.** É onde a venda acontece e onde o aluno baixa o material |

Os dois estão no ar ao mesmo tempo, e isso é proposital. Produto cujo botão leva
para a loja **não é defeito**: é o caminho de compra.

Nunca presuma que mexer aqui resolve algo de lá. Pedido, pagamento, e-mail de
compra e download do aluno são todos do WordPress.

## A stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, CSS Modules. Supabase
para blog, notícias e ajustes de produto. Sem framework de UI e sem Tailwind: o
estilo é um CSS Module por componente.

```
npm run dev     # desenvolvimento
npm run build   # o que a Vercel roda
```

## O mapa

```
src/app/            rotas (App Router)
  admin/            painel: blog, notícias, materiais, cursos, sumários
  vitrine/          catálogo, página por área, página de produto
  blog/ noticias/   conteúdo editorial
  api/noticias/     única rota de API, publica notícia por automação
src/components/     um componente por pasta, com seu CSS Module
src/lib/            acesso a dados e utilitários
src/data/catalogo/  o catálogo de produtos
scripts/            geradores; rodam à mão, nunca no build
```

## O catálogo, que é onde mais se erra

O produto do site vem de **três camadas empilhadas**, nesta ordem:

**1. A planilha do Sérgio.** Um `.xlsx` vira `src/data/catalogo/produtos.json`
e mais cinco arquivos. Esses arquivos são **gerados**:

```
npm run catalogo -- "C:\caminho\Produtos (5).xlsx"
```

> **Nunca edite `produtos.json` à mão.** A próxima importação apaga o que você
> escreveu. Vale também para `cupons.json`, `sumarios.json`, `copy.json`,
> `links-desconto.json`, `ofertas-personalizadas.json` e `conteudo-produto.json`.

**2. O painel, no Supabase.** A tabela `produtos_ajustes` fica por cima da
planilha: preço, descrição, produto oculto, destaque e posição na vitrine. É por
onde o Sérgio trabalha sozinho, sem deploy. Se o site mostra preço diferente do
`produtos.json`, é isto acontecendo, e está certo.

**3. `checkouts-manuais.json`.** Único arquivo de catálogo editável à mão. Serve
para apontar um produto a um checkout específico quando a planilha ainda não
reflete a decisão.

Para ler o catálogo, importe de `@/data/catalogo`. Para a vitrine, use
`catalogoParaVitrine()` de `@/lib/catalogo-ajustes`, que já aplica o painel: é a
diferença entre mostrar o que está à venda e mostrar o que o Sérgio escondeu.

### O id do produto vem do nome, e isso morde

O id vira endereço: `/vitrine/produto/<id>`. Renomear um produto na planilha muda
o id, e com ele o endereço, o texto raspado e o ajuste do painel, que são
guardados por id.

O `build-catalogo.js` já cuida disso sozinho: antes de gravar, ele lê o
`produtos.json` que ainda está no disco e reconhece cada produto pelo checkout,
não pelo nome. Quem foi renomeado fica com o endereço antigo, e quem veio sem
área herda a que tinha. Na importação de setembro isso salvou 14 produtos de
virarem link quebrado.

Era um segundo comando, à mão, que ninguém podia esquecer. Virou parte do
build. O `scripts/preserva-slugs.js` continua rodando solto quando você quer
conferir contra uma referência específica, por exemplo a versão que está no ar:

```
git show HEAD:src/data/catalogo/produtos.json > antes.json
node scripts/preserva-slugs.js antes.json
```

Se o relatório terminar com `ids repetidos`, dois produtos estão disputando o
mesmo endereço: pare e resolva antes de commitar.

## Armadilhas que já custaram caro

**O blog não interpreta HTML, de propósito.** O conteúdo aceita Markdown com
diretivas (`:::importante`, `:::lei[ref]`, `:::dica`, `:::sintese`,
`:::aprofunde`, `:::fontes`, `:::faq`, `::produto{id=...}`, `:marca[]`,
`:ressalva[]`). HTML cru sai escapado na tela. É o que impede texto do painel
virar script no site. **Não ligue `rehype-raw`.**

**Nunca invente preço, nem preço "de".** Valor riscado que não existiu é
propaganda enganosa, e a empresa responde. Se a fonte não tem o número, o campo
fica vazio.

**Preço e link de compra vêm do catálogo na hora de desenhar**, inclusive dentro
de artigo do blog. Não grave preço no texto. Em setembro dezesseis produtos
foram anunciados abaixo do valor real porque um checkout de campanha encerrada
tinha sido guardado à parte.

**A permissão de leitura do Supabase é por COLUNA, não por tabela.** O site
público lê o que descreve o produto e não enxerga coluna de controle, como
`atualizado_por`. Coluna nova **não herda** isso, e quando o site pede uma
coluna que não pode ler o Postgres recusa a consulta inteira com `permission
denied for table X`. O catálogo trata esse erro caindo para a planilha, então
nada quebra: o painel simplesmente para de valer no site, em silêncio. Em 21/09
a vitrine passou dias mostrando produto escondido e preço antigo por causa de
uma coluna `checkout` criada sem `grant`. Depois de mexer em coluna:

```
npm run confere-leitura
```

**A vitrine e a página de produto se refazem a cada 60 segundos**
(`revalidate`). Ajuste no painel aparece sozinho, sem deploy. Mudança de código
precisa de deploy. Se algo "não mudou", espere um minuto antes de investigar.

**O cache do dev corrompe depois de um build.** Se `npm run dev` der erro
estranho do tipo `Failed to load external module`, apague a pasta `.next` e rode
de novo. Não é bug do seu código.

## Como trabalhar aqui

O repositório é `esquematizaai/esquematizaai`. A branch `master` aceita push
direto: a regra de pull request aprovado foi retirada em 05/10/2026, porque o
único revisor possível era quem pedia a alteração.

```
git checkout -b minha-alteracao
# edite, e então:
npm run build          # obrigatório antes de commitar
git add -A
git commit -m "..."
git push origin HEAD:master
```

**Build passando não é o mesmo que funcionando.** Antes de dizer que terminou,
abra a página e confira o efeito. Este projeto já teve capa quebrada, download
fora do ar e produto invisível com o build passando tranquilo.

**Push aceito não é o mesmo que no ar.** Quem publica é a Vercel, por um
webhook do GitHub, e esse elo já se rompeu uma vez: quando o repositório saiu
de `pplacerda07` para a organização `esquematizaai`, o projeto na Vercel ficou
com `Project Link not found` na tela de Git e parou de receber os pushes. O
GitHub aceitava tudo, o site continuava no código do dia anterior, e nada
avisava. Dois commits de 05/10 passaram horas assim.

Como saber, sem abrir o painel da Vercel: escolha algo que só o código novo
faria aparecer e procure na página publicada. Se o banco tem o dado, o site
consegue lê-lo e mesmo assim a página não mostra, o código que está rodando lá
é mais velho que o seu commit.

## Regras da casa

**Travessão é proibido.** Nem `—` nem `–`, em nenhum texto: copy do site,
comentário, documentação ou mensagem de commit. Use vírgula, dois pontos, ou
termine a frase e comece outra.

**Comentário explica o porquê, não o quê.** O código já diz o que faz. O
comentário existe para a decisão que não é óbvia, de preferência com o caso real
que a motivou.

**Confira antes de afirmar.** Mediu, viu, testou: então diga. Se não deu para
verificar, diga isso também. Um "não consegui confirmar" vale mais que um "está
funcionando" que não se sustenta.

## Onde procurar mais

| Assunto | Arquivo |
|---|---|
| Como a equipe publica no blog | `docs/publicar-no-blog.md` |
| Como a equipe cadastra material | `docs/cadastrar-material.md` |
| Como a automação publica notícia | `docs/publicar-noticia.md` |
| O catálogo em detalhe | `src/data/catalogo/README.md` |
| Inconsistências conhecidas da planilha | `src/data/catalogo/PENDENCIAS.md` |
