import { createClient } from '@supabase/supabase-js';
import type { Produto } from '@/data/catalogo';

/**
 * Produtos criados no painel, que ainda não existem na planilha.
 *
 * Diferente do catalogo-ajustes, que SOBREPÕE a planilha, este ACRESCENTA. É o
 * caminho para o Sérgio lançar material sem esperar alguém importar planilha,
 * que nesta semana deixou produto lançado dias fora do ar.
 *
 * A PLANILHA GANHA QUANDO ALCANÇA. Se o mesmo produto aparecer nos dois lugares,
 * vale o da planilha e o do painel some da vitrine. O casamento é pelo checkout
 * ou pela página de vendas, que é o que aponta para o produto de verdade na
 * Eduzz e no WordPress; o nome não serve, porque o Sérgio renomeia com
 * frequência e foi exatamente isso que quase matou 22 endereços na última
 * importação.
 *
 * Banco fora do ar devolve lista vazia: a loja perde os produtos novos, mas
 * continua vendendo os 173 da planilha.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface ProdutoDoPainel {
  id: string;
  nome: string;
  categoria: string;
  area: string | null;
  ferramenta: string | null;
  formato: string | null;
  preco: number;
  preco_de: number | null;
  checkout: string | null;
  url_site: string | null;
  capa_url: string | null;
  capa_largura: number | null;
  capa_altura: number | null;
  descricao: string | null;
  detalhes: string | null;
  oculto: boolean;
  destaque: boolean;
}

/**
 * O que o site pode ler de `produtos_novos`.
 *
 * Fora daqui ficam `atualizado_por`, `criado_em` e `atualizado_em`: o e-mail de
 * quem editou e o histórico de quando são informação de bastidor, e a tabela é
 * de leitura pública porque a vitrine precisa dela. O banco também deixou de
 * conceder essas colunas ao visitante, então esta lista e a permissão de lá
 * precisam continuar iguais.
 */
const COLUNAS_PUBLICAS =
  'id, nome, categoria, area, ferramenta, formato, ' +
  'preco, preco_de, checkout, url_site, ' +
  'capa_url, capa_largura, capa_altura, ' +
  'descricao, detalhes, oculto, destaque';

/** molde vazio, para o produto do painel caber no mesmo tipo da planilha */
function comoProduto(p: ProdutoDoPainel): Produto {
  return {
    id: p.id,
    idEduzz: null,
    nome: p.nome,
    nomesAlternativos: [],
    categoria: p.categoria,
    campanha: null,
    status: 'ativo',
    tipo: null,
    area: p.area,
    ferramenta: p.ferramenta,
    formato: p.formato,
    sefaz: null,
    urlSite: p.url_site,
    observacao: null,
    precos: { cheio: p.preco, promocional: null, black: null },
    precosTexto: null,
    checkouts: { normal: p.checkout, black: null, outros: [] },
    orderbump: null,
    orderbumpProdutos: null,
    orderbumpPreco: null,
    precoTotalComOrderbump: null,
    layoutCheckout: null,
    upsell: null,
    pastaGdrive: null,
    linkEdicaoEduzz: null,
    atualizacao: null,
    sobre: p.descricao,
    disciplinas: null,
    cronograma: null,
    capaOrigem: null,
    fontes: ['cadastrado no painel'],
    avisos: [],
    herdouDe: null,
  } as unknown as Produto;
}

export async function lerProdutosDoPainel(): Promise<ProdutoDoPainel[]> {
  if (!URL_SUPABASE || !CHAVE) return [];

  try {
    const supabase = createClient(URL_SUPABASE, CHAVE, { auth: { persistSession: false } });
    // Colunas nomeadas, e não `*`, porque o banco deixou de dar ao visitante
    // acesso a `atualizado_por` (o e-mail de quem editou) e às datas de
    // controle. Com `*` a consulta inteira passaria a ser recusada.
    const { data, error } = await supabase
      .from('produtos_novos')
      .select(COLUNAS_PUBLICAS);

    if (error) {
      console.error('[catalogo] produtos do painel indisponíveis:', error.message);
      return [];
    }
    // via `unknown` porque a lista de colunas é uma constante montada, e o
    // cliente do Supabase só infere o tipo quando ela é escrita direto na chamada
    return (data ?? []) as unknown as ProdutoDoPainel[];
  } catch (e) {
    console.error('[catalogo] falha ao ler produtos do painel:', (e as Error).message);
    return [];
  }
}

/**
 * Os do painel que a planilha ainda não tem, já no formato de Produto.
 *
 * `daPlanilha` é o catálogo completo, e não só os vendáveis: um produto oculto
 * ou inativo continua ocupando o checkout dele, e recriá-lo pelo painel geraria
 * dois cadastros para a mesma venda.
 */
/**
 * Deixa dois links comparáveis.
 *
 * Quem digita no painel escreve "chk.eduzz.com/abc" ou
 * "https://chk.eduzz.com/abc/", e a planilha escreve de um jeito só. Sem tirar
 * o protocolo e a barra do fim, o mesmo checkout viraria dois, e o produto
 * ficaria duplicado na vitrine.
 *
 * O caminho continua sensível a maiúscula, de propósito: os códigos da Eduzz
 * misturam caixa ("G92EX64OWE" e "7tnzwfzg") e são identificadores, não texto.
 */
export function comparavel(link: string): string {
  return link
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .replace(/^www\./i, '');
}

export function somenteOsQueFaltam(
  doPainel: ProdutoDoPainel[],
  daPlanilha: Produto[],
): Produto[] {
  const ocupados = new Set<string>();
  for (const p of daPlanilha) {
    if (p.checkouts?.normal) ocupados.add(comparavel(p.checkouts.normal));
    if (p.checkouts?.black) ocupados.add(comparavel(p.checkouts.black));
    if (p.urlSite) ocupados.add(comparavel(p.urlSite));
    ocupados.add('id:' + p.id);
  }

  return doPainel
    .filter((p) => !p.oculto)
    .filter((p) => {
      if (ocupados.has('id:' + p.id)) return false;
      if (p.checkout && ocupados.has(comparavel(p.checkout))) return false;
      if (p.url_site && ocupados.has(comparavel(p.url_site))) return false;
      return true;
    })
    .map(comoProduto);
}

/** preco "de" de cada produto do painel, para a oferta mostrar o desconto */
export function referenciasDoPainel(doPainel: ProdutoDoPainel[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const p of doPainel) if (p.preco_de) mapa.set(p.id, Number(p.preco_de));
  return mapa;
}

/** capas dos produtos do painel, no formato que o next/image espera */
/**
 * Quem o painel marcou como destaque, entre os materiais criados por lá.
 *
 * SEM ISTO A MARCA NÃO VALIA PARA ELES. O destaque saía de produtos_ajustes,
 * que é a tabela dos materiais da planilha; material criado no painel guarda a
 * marca na tabela dele, produtos_novos, e ninguém lia. O Sérgio clicava em
 * "Destacar", salvava, e o site não mudava.
 *
 * Apareceu em 23/09, quando ele pediu quatro materiais na home e um deles era o
 * Flashcards Reta Final SEFAZ-AL, o primeiro que ele mesmo cadastrou.
 */
export function destaquesDoPainel(doPainel: ProdutoDoPainel[]): Set<string> {
  return new Set(doPainel.filter((p) => p.destaque).map((p) => p.id));
}

export function capasDoPainel(
  doPainel: ProdutoDoPainel[],
): Map<string, { src: string; width: number; height: number }> {
  const mapa = new Map<string, { src: string; width: number; height: number }>();
  for (const p of doPainel) {
    if (!p.capa_url) continue;
    // sem medida a imagem ainda aparece, mas a página pula quando ela carrega;
    // 452x640 é a proporção das 92 capas que já existem
    mapa.set(p.id, {
      src: p.capa_url,
      width: p.capa_largura ?? 452,
      height: p.capa_altura ?? 640,
    });
  }
  return mapa;
}

/**
 * O quadro "Detalhes do produto" dos materiais criados no painel.
 *
 * Os da planilha guardam esse texto em produtos_ajustes, junto com preco e
 * descricao; os criados aqui nao passam por aquela tabela, entao guardam o
 * proprio. Sao dois caminhos para a mesma coisa porque sao duas origens, e a
 * pagina nao precisa saber de qual deles veio.
 */
export function detalhesDoPainel(doPainel: ProdutoDoPainel[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const p of doPainel) {
    if (p.detalhes) mapa.set(p.id, p.detalhes);
  }
  return mapa;
}
