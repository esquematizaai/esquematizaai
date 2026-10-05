/**
 * Confere se o site publico ainda consegue ler o que precisa do Supabase.
 *
 * POR QUE ISTO EXISTE, com data: em 21/09/2026 a vitrine estava mostrando
 * produtos que o painel tinha escondido e precos diferentes dos ajustados. A
 * causa era uma coluna nova, `checkout`, criada em produtos_ajustes sem a
 * permissao de leitura publica.
 *
 * A PERMISSAO DESTA BASE E POR COLUNA, NAO POR TABELA. O site le o que
 * descreve o produto e nao enxerga colunas de controle, como atualizado_por.
 * Coluna nova nao herda isso, e quando o site pede uma coluna que nao pode ler
 * o Postgres recusa a CONSULTA INTEIRA com "permission denied for table X".
 *
 * O catalogo trata esse erro caindo para a planilha, de propósito, porque
 * preferimos preco desatualizado a pagina quebrada. O efeito colateral e que o
 * painel morre em silencio: nada quebra, nada avisa, e a equipe continua
 * editando coisas que nao chegam ao site.
 *
 * Este script roda as MESMAS consultas do site, com a MESMA chave publica.
 *
 *   node scripts/confere-leitura-publica.mjs
 *
 * Rode depois de mexer em coluna de tabela que o site le. Sai com codigo 1 se
 * alguma consulta falhar, para servir de porta em automacao.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const arquivoEnv = path.join(raiz, '.env.local');

if (!fs.existsSync(arquivoEnv)) {
  console.error('nao achei o .env.local na raiz do projeto.');
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(arquivoEnv, 'utf8')
    .split(/\r?\n/)
    .filter((linha) => linha.includes('=') && !linha.trimStart().startsWith('#'))
    .map((linha) => {
      const corte = linha.indexOf('=');
      return [linha.slice(0, corte).trim(), linha.slice(corte + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !CHAVE) {
  console.error('faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local.');
  process.exit(1);
}

/**
 * Cada linha aqui e uma consulta que o site publico faz de verdade.
 *
 * Copie a lista de colunas do arquivo apontado em `origem` quando ela mudar. A
 * graca do teste e ser a consulta real: uma lista de colunas escrita a parte
 * envelhece e passa a testar outra coisa.
 */
const CONSULTAS = [
  {
    nome: 'ajustes de produto (painel sobre a planilha)',
    origem: 'src/lib/catalogo-ajustes.ts',
    tabela: 'produtos_ajustes',
    colunas: 'produto_id, preco, descricao, oculto, destaque, ordem, checkout, preco_de',
  },
  {
    nome: 'produtos cadastrados no painel',
    origem: 'src/lib/produtos-do-painel.ts',
    tabela: 'produtos_novos',
    colunas:
      'id, nome, categoria, area, ferramenta, formato, preco, preco_de, checkout, url_site, capa_url, capa_largura, capa_altura, descricao, oculto, destaque',
  },
  {
    nome: 'posts do blog',
    origem: 'src/lib/blog.ts',
    tabela: 'posts',
    colunas:
      'id, slug, titulo, resumo, descricao_seo, categoria, capa_url, produto_id, autor, status, publicado_em, criado_em, atualizado_em',
  },
  {
    nome: 'conteudo de um post',
    origem: 'src/lib/blog.ts',
    tabela: 'posts',
    colunas: '*',
  },
  {
    nome: 'noticias',
    origem: 'src/lib/blog.ts',
    tabela: 'noticias',
    colunas: 'id, titulo, url_fonte, fonte, publicado_em, slug, resumo, capa_url, autor, atualizado_em',
  },
  {
    nome: 'disciplinas do sumario',
    origem: 'src/lib/sumarios-painel.ts',
    tabela: 'disciplinas',
    colunas: 'id, nome, formato, area, paginas, cards, adotada_em',
  },
  {
    nome: 'topicos da disciplina',
    origem: 'src/lib/sumarios-painel.ts',
    tabela: 'disciplina_topicos',
    colunas: 'disciplina_id, ordem, texto',
  },
  {
    nome: 'disciplinas de cada curso',
    origem: 'src/lib/sumarios-painel.ts',
    tabela: 'curso_disciplinas',
    colunas: 'produto_id, disciplina_id, ordem',
  },
];

const supabase = createClient(URL, CHAVE, { auth: { persistSession: false } });

let falhou = false;

for (const consulta of CONSULTAS) {
  const { error } = await supabase.from(consulta.tabela).select(consulta.colunas).limit(1);

  if (error) {
    falhou = true;
    console.error(`FALHOU  ${consulta.nome}`);
    console.error(`        tabela ${consulta.tabela}, de ${consulta.origem}`);
    console.error(`        ${error.message}`);
    if (error.message.includes('permission denied')) {
      console.error('        provavel coluna nova sem leitura publica. No SQL do Supabase:');
      console.error(`        grant select (coluna) on public.${consulta.tabela} to anon;`);
    }
  } else {
    console.log(`ok      ${consulta.nome}`);
  }
}

if (falhou) {
  console.error('\nO site publico NAO consegue ler tudo que precisa. Resolva antes de seguir.');
  process.exit(1);
}

console.log('\nTudo que o site publico le esta liberado.');
