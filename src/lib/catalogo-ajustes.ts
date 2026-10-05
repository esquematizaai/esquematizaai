import { createClient } from '@supabase/supabase-js';
import { produtos, ofertaAtual, type Produto, type Oferta } from '@/data/catalogo';
import {
  lerProdutosDoPainel,
  somenteOsQueFaltam,
  capasDoPainel,
  destaquesDoPainel,
  referenciasDoPainel,
} from '@/lib/produtos-do-painel';

/**
 * Aplica no catálogo os ajustes feitos no painel.
 *
 * O catálogo (107 produtos) continua vindo da planilha do Sérgio. Esta camada
 * lê a tabela produtos_ajustes e sobrepõe o que foi editado no admin: preço,
 * descrição, produto oculto e produto em destaque.
 *
 * Se o Supabase estiver fora do ar, devolve o catálogo da planilha sem ajuste
 * nenhum. A loja continua vendendo: é melhor mostrar o preço da planilha do
 * que derrubar a vitrine porque o banco não respondeu.
 */

export interface Ajuste {
  produto_id: string;
  preco: number | null;
  descricao: string | null;
  oculto: boolean;
  destaque: boolean;
  /**
   * Posição manual na vitrine, do menor para o maior. Null deixa a ordenação
   * automática decidir, e é o padrão: numerar os 173 produtos seria trabalho
   * sem fim e quebraria a cada item novo da planilha.
   */
  ordem: number | null;
  /**
   * Para onde o botão de comprar manda. Null = usa o da planilha.
   *
   * O site é vitrine: não processa pedido, não cobra, não entrega arquivo. A
   * única coisa que ele decide por produto é esta. Até 19/09 era justamente a
   * única que o Sérgio não conseguia mudar sozinho, e ele precisa, porque usa
   * plataformas diferentes em produtos diferentes.
   */
  checkout: string | null;
  /** preco ancora, riscado ao lado do cobrado */
  preco_de: number | null;
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function buscarAjustes(): Promise<Map<string, Ajuste>> {
  if (!URL || !CHAVE) return new Map();

  try {
    const supabase = createClient(URL, CHAVE, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('produtos_ajustes')
      .select('produto_id, preco, descricao, oculto, destaque, ordem, checkout, preco_de');

    if (error) {
      console.error('[catalogo] ajustes indisponíveis:', error.message);
      return new Map();
    }
    return new Map((data ?? []).map((a) => [a.produto_id as string, a as unknown as Ajuste]));
  } catch (e) {
    console.error('[catalogo] ajustes indisponíveis:', (e as Error).message);
    return new Map();
  }
}

/** Produto com o ajuste já aplicado por cima da planilha. */
function aplicar(p: Produto, a: Ajuste | undefined): Produto {
  if (!a) return p;

  /**
   * A ordem de quem manda no link de compra, de baixo para cima:
   *   1. a planilha do Sérgio
   *   2. checkouts-manuais.json, arquivo do repositório, exige deploy
   *   3. ESTE ajuste do painel, que ele muda sozinho e vale em um minuto
   *
   * O painel fica no topo de propósito: quando ele troca a plataforma de um
   * produto, precisa valer na hora, e não esperar alguém abrir o repositório.
   */
  const checkouts = { ...p.checkouts };
  if (a.checkout) checkouts.normal = a.checkout;

  // ajuste de preço invalida o checkout Black, que cobra o valor antigo;
  // sem isso o site mostraria o preço novo com o link do preço velho
  if (a.preco != null) checkouts.black = null;

  return {
    ...p,
    precos: a.preco != null ? { ...p.precos, cheio: a.preco, black: null } : p.precos,
    sobre: a.descricao ?? p.sobre,
    checkouts,
  };
}

export interface ProdutoAjustado {
  produto: Produto;
  oferta: Oferta;
  destaque: boolean;
  /** posição que o Sérgio digitou no painel, ou null */
  ordem: number | null;
  /**
   * A descrição ESCRITA NO PAINEL, quando existe.
   *
   * Vem separada do produto de propósito. Dentro de aplicar() ela já entra
   * em produto.sobre, e ali fica indistinguível do texto da planilha: a
   * página não teria como saber se aquilo foi o Sérgio quem escreveu ou se
   * veio da raspagem do WordPress. Era por isso que o texto importado ganhava
   * dela, mesmo depois de ele reescrever a descrição no painel.
   */
  descricaoDoPainel: string | null;
  /**
   * Capa do produto criado no painel. Os da planilha continuam com a do
   * capas.json, resolvida por capaDe(); só os do painel guardam a imagem no
   * Supabase, porque o painel não escreve no repositório.
   */
  capaDoPainel?: { src: string; width: number; height: number } | null;
}

/**
 * Catálogo pronto para a vitrine: sem os ocultos, com preço e descrição já
 * ajustados, e sinalizando quais foram marcados como destaque no painel.
 */
export async function catalogoParaVitrine(): Promise<ProdutoAjustado[]> {
  const [ajustes, doPainel] = await Promise.all([buscarAjustes(), lerProdutosDoPainel()]);
  const saida: ProdutoAjustado[] = [];

  // os criados no painel entram no fim: a planilha continua sendo a base, e
  // quando ela alcançar um deles, ele sai daqui sozinho
  const todos = [...produtos, ...somenteOsQueFaltam(doPainel, produtos)];
  const capas = capasDoPainel(doPainel);
  const destacadosNoPainel = destaquesDoPainel(doPainel);
  const referencias = referenciasDoPainel(doPainel);

  for (const p of todos) {
    const a = ajustes.get(p.id);
    if (a?.oculto) continue;
    if (p.categoria === 'oferta-personalizada' || p.status === 'inativo') continue;

    const ajustado = aplicar(p, a);
    // o preço "de" do painel é digitado pelo Sérgio e não passa pelo mapa de
    // referências da planilha, então entra por aqui
    const oferta = ofertaAtual(ajustado, a?.preco_de ?? referencias.get(p.id) ?? null);
    if (!oferta) continue;

    saida.push({
      produto: ajustado,
      oferta,
      destaque: Boolean(a?.destaque) || destacadosNoPainel.has(p.id),
      descricaoDoPainel: a?.descricao ?? null,
      ordem: a?.ordem ?? null,
      capaDoPainel: capas.get(p.id) ?? null,
    });
  }

  return saida;
}

/**
 * Ajuste aplicado numa lista fixa de ids, para quem monta vitrine própria.
 *
 * POR QUE ISTO EXISTE: os blocos que montam cartão a partir de uma lista de ids
 * escrita no código (destaques da home, planos de assinatura) liam a planilha
 * crua. Com isso o MESMO produto aparecia com dois preços em duas partes do
 * site: a vitrine mostrava o preço do painel e o bloco de destaque mostrava o
 * da planilha. O Sérgio viu isso em 17/09, com a Assinatura Resumos Regular
 * saindo a R$ 897 na vitrine e a R$ 797 no bloco de cima.
 *
 * Isso é pior que feio: o preço mais barato era o errado, e anunciar abaixo do
 * que se cobra é o mesmo defeito de setembro, com a empresa respondendo por ele.
 *
 * Uma leitura só do painel para a lista inteira, em vez de uma por produto.
 * Quem está oculto NÃO volta no mapa, então some do bloco junto com a vitrine.
 */
export async function ajustadosPorId(ids: string[]): Promise<Map<string, ProdutoAjustado>> {
  const [ajustes, doPainel] = await Promise.all([buscarAjustes(), lerProdutosDoPainel()]);
  const capas = capasDoPainel(doPainel);
  const destacadosNoPainel = destaquesDoPainel(doPainel);
  const referencias = referenciasDoPainel(doPainel);
  const saida = new Map<string, ProdutoAjustado>();

  for (const id of ids) {
    const base =
      produtos.find((p) => p.id === id || p.idEduzz === id) ??
      somenteOsQueFaltam(doPainel, produtos).find((p) => p.id === id);
    if (!base) continue;

    const a = ajustes.get(base.id);
    if (a?.oculto) continue;

    const ajustado = aplicar(base, a);
    const oferta = ofertaAtual(ajustado, a?.preco_de ?? referencias.get(base.id) ?? null);
    if (!oferta) continue;

    saida.set(id, {
      produto: ajustado,
      oferta,
      destaque: Boolean(a?.destaque) || destacadosNoPainel.has(base.id),
      descricaoDoPainel: a?.descricao ?? null,
      ordem: a?.ordem ?? null,
      capaDoPainel: capas.get(base.id) ?? null,
    });
  }

  return saida;
}

/**
 * Os materiais que o painel mandou para o carrossel da home.
 *
 * ATÉ 23/09 A LISTA DA HOME ERA ESCRITA NO CÓDIGO. O Sérgio perguntou "como
 * faço para editar os cursos aqui?" e a resposta honesta era: não faz, pede
 * para o Pedro. Agora quem decide é a marca "Destacar" do painel, que já
 * existia e que ninguém usava: zero materiais marcados até hoje.
 *
 * A MESMA MARCA VALE NOS DOIS LUGARES, home e vitrine, de propósito. Dois
 * controles parecidos em telas diferentes é o tipo de coisa que faz alguém
 * marcar um e jurar que o site está quebrado. Se um dia precisarem escolher
 * coisas diferentes para cada lugar, aí sim vale separar.
 *
 * A ORDEM É A DO CAMPO "Posição", o mesmo da vitrine. Quem não tem número vai
 * para o fim, em vez de sumir.
 *
 * `limite` existe porque carrossel não é vitrine: marcar quinze materiais não
 * pode virar quinze slides que ninguém passa até o fim.
 */
export async function destaquesDaHome(limite = 6): Promise<ProdutoAjustado[]> {
  const catalogo = await catalogoParaVitrine();

  return catalogo
    .filter((item) => item.destaque)
    .sort((a, b) => {
      if (a.ordem === b.ordem) return 0;
      if (a.ordem === null) return 1;
      if (b.ordem === null) return -1;
      return a.ordem - b.ordem;
    })
    .slice(0, limite);
}

/** Um produto com ajuste, para a página dele. null = oculto ou inexistente. */
export async function produtoAjustado(id: string): Promise<ProdutoAjustado | null> {
  let base = produtos.find((p) => p.id === id || p.idEduzz === id);

  // uma leitura só, usada tanto para achar o produto quanto para a capa dele
  const doPainel = await lerProdutosDoPainel();

  // não está na planilha: pode ser um cadastrado no painel
  if (!base) base = somenteOsQueFaltam(doPainel, produtos).find((p) => p.id === id);
  if (!base) return null;

  const ajustes = await buscarAjustes();
  const a = ajustes.get(base.id);
  if (a?.oculto) return null;

  const ajustado = aplicar(base, a);
  const oferta = ofertaAtual(ajustado, a?.preco_de ?? referenciasDoPainel(doPainel).get(base.id) ?? null);
  if (!oferta) return null;

  return {
    produto: ajustado,
    oferta,
    destaque: Boolean(a?.destaque) || destaquesDoPainel(doPainel).has(base.id),
    descricaoDoPainel: a?.descricao ?? null,
    ordem: a?.ordem ?? null,
    capaDoPainel: capasDoPainel(doPainel).get(base.id) ?? null,
  };
}
