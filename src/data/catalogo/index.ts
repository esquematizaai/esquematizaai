// Catálogo de produtos do Esquematiza Aí.
// Dados gerados a partir da planilha "Produtos (1).xlsx" (ver README.md desta pasta).
// Importe SEMPRE deste index; os JSONs são detalhe interno.

import { paraLoja, processadorDoCheckout } from '@/config';
import produtosDb from './produtos.json';
import cuponsDb from './cupons.json';
import ofertasDb from './ofertas-personalizadas.json';
import linksDescontoDb from './links-desconto.json';
import checkoutsManuaisDb from './checkouts-manuais.json';
import sumariosDb from './sumarios.json';
import capasDb from './capas.json';
import conteudoDb from './conteudo-produto.json';

export interface Produto {
  /** slug único, bom para URL (/vitrine/produto/[id]) */
  id: string;
  /** ID do produto na Eduzz (null quando a planilha não informa) */
  idEduzz: string | null;
  nome: string;
  /** outros nomes com que o produto aparece na planilha */
  nomesAlternativos: string[];
  /** "assinatura" | "combo" | "isolado" | "treinamento" | "oferta-personalizada" | "outro" */
  categoria: string;
  /** "blackfriday" quando o produto existe só como oferta de campanha */
  campanha: string | null;
  /** "ativo" | "inativo" | null (null = planilha não informa) */
  status: string | null;
  /** "Combo" | "Isolada" | null (classificação da planilha) */
  tipo: string | null;
  /** "Fiscal" | "Controle" | "Policial" | "Tribunais" | "Bancária" | "Legislativo" | "Geral" | null */
  area: string | null;
  /** "Resumo" | "Flashcards" | "R + F + Q + V" | "Assinatura" | "Questões Inéditas" | "Vademecum" | ... */
  ferramenta: string | null;
  /** "Regular" (conteúdo permanente) | "Específico" (para um edital/órgão) */
  formato: string | null;
  /** órgão, quando produto de Legislação Tributária (ex.: "SEFAZ-GO") */
  sefaz: string | null;
  /** página de vendas atual no site WordPress antigo */
  urlSite: string | null;
  observacao: string | null;
  precos: {
    /** preço "de tabela" */
    cheio: number | null;
    /** preço promocional (coluna sem título na planilha, ~30% off) */
    promocional: number | null;
    /** preço da Black Friday */
    black: number | null;
  };
  /** preços que não deu para converter em número (ex.: "R$ 67,9 (x12)") */
  precosTexto: Record<string, string> | null;
  checkouts: {
    /** checkout Eduzz do preço normal, o link principal de venda */
    normal: string | null;
    /** checkout Eduzz da oferta Black Friday */
    black: string | null;
    /** demais links (cupom 20%/30%, upgrades, ofertas [VL], alternativos divergentes) */
    outros: { rotulo: string; preco: number | null; url: string }[];
  };
  orderbump: string | null;
  orderbumpProdutos: string | null;
  orderbumpPreco: number | null;
  precoTotalComOrderbump: number | null;
  layoutCheckout: string | null;
  upsell: string | null;
  pastaGdrive: string | null;
  linkEdicaoEduzz: string | null;
  atualizacao: string | null;
  /** texto longo de vendas ("Sobre o produto") */
  sobre: string | null;
  /** lista de disciplinas/conteúdo do material */
  disciplinas: string | null;
  /** cronograma de entrega dos materiais em elaboração */
  cronograma: string | null;
  /** de quais abas/linhas da planilha o registro veio */
  fontes: string[];
  /** inconsistências da planilha detectadas ao gerar (ver PENDENCIAS.md) */
  avisos: string[];
  /** arquivo e URL originais da capa na planilha (o WebP local sai daqui) */
  capaOrigem?: { arquivo: string | null; url: string | null } | null;
  /** produto correspondente no catálogo anterior, quando o id foi herdado */
  herdouDe?: { id: string; nome: string; score: number } | null;
}

export interface Cupom {
  codigo: string;
  percentual: number | null;
  /** público do cupom: "Não alunos" | "Alunos Padrão" | "Alunos renovação" | "BLACKFRIDAY" | "SOCIAL SELLER" */
  categoria: string | null;
  /** descrição livre da planilha sobre onde o cupom vale */
  produtosElegiveis: string | null;
  /** mensagem pronta usada pelo atendimento */
  mensagem: string | null;
}

export interface OfertaPersonalizada {
  /** produto guarda-chuva na Eduzz ("Oferta personalizada") */
  idEduzz: string;
  /** "parcela c/ juros" | "parcela s/ juros" */
  parcelamento: string | null;
  preco: number;
  checkout: string | null;
}

export interface DegrauDesconto {
  preco: number | null;
  /** checkout Eduzz com o desconto já aplicado (alguns degraus não têm link) */
  checkout: string | null;
}

export interface ProdutoComDesconto {
  idEduzz: string | null;
  nome: string;
  area: string | null;
  ferramenta: string | null;
  formato: string | null;
  paginaOferta: string | null;
  /** escada de preços: do maior para o menor, cada degrau com seu checkout */
  escada: DegrauDesconto[];
}

/**
 * Checkout definido a mao, por cima da planilha.
 *
 * O produtos.json e GERADO a partir do xlsx do Sergio: qualquer edicao feita
 * direto nele morre no proximo rebuild. Quando ele decide vender um isolado por
 * um link direto da Eduzz em vez da pagina da loja, e a planilha ainda nao
 * reflete isso, o link entra aqui e sobrevive.
 *
 * Entra como `checkouts.normal` de proposito: dai a decisao entre link direto e
 * pagina de vendas continua sendo tomada num lugar so, dentro de ofertaAtual().
 * Quando a planilha passar a trazer o mesmo link, e so apagar a linha daqui.
 */
const CHECKOUTS_MANUAIS = checkoutsManuaisDb.checkouts as Record<string, string>;

export const produtos = (produtosDb.produtos as unknown as Produto[]).map((p) => {
  const manual = CHECKOUTS_MANUAIS[p.id];
  return manual ? { ...p, checkouts: { ...p.checkouts, normal: manual } } : p;
});
export const cupons = cuponsDb.cupons as unknown as Cupom[];
export const ofertasPersonalizadas = ofertasDb.ofertas as unknown as OfertaPersonalizada[];
export const produtosComDesconto = linksDescontoDb.produtos as unknown as ProdutoComDesconto[];
export const sumarios = sumariosDb;

/** Busca por slug ou por ID da Eduzz. */
export function produtoPor(idOuIdEduzz: string): Produto | undefined {
  return produtos.find((p) => p.id === idOuIdEduzz || p.idEduzz === idOuIdEduzz);
}

/** Produtos de uma categoria ("combo", "isolado", "assinatura"...). */
export function produtosPorCategoria(categoria: string): Produto[] {
  return produtos.filter((p) => p.categoria === categoria);
}

/** Produtos de uma área ("Fiscal", "Policial"...). */
export function produtosPorArea(area: string): Produto[] {
  return produtos.filter((p) => p.area === area);
}

/**
 * Produtos vendáveis hoje: ativos e com algum destino de compra.
 * Metade do catálogo não tem checkout Eduzz próprio e é vendida pela página do
 * produto no site; por isso `urlSite` também conta como destino.
 */
export function produtosVendaveis(): Produto[] {
  return produtos.filter(
    (p) => p.status !== 'inativo' && (p.checkouts.normal || p.checkouts.black || p.urlSite),
  );
}

/** Escada de descontos de um produto (links com cupom aplicado), se houver. */
export function escadaDeDesconto(p: Produto): ProdutoComDesconto | undefined {
  return produtosComDesconto.find((d) => d.idEduzz && d.idEduzz === p.idEduzz);
}

/**
 * Oferta exibível de um produto: par CONSISTENTE de preço e checkout
 * (o botão de compra cobra exatamente o preço mostrado).
 * Regra: se existe preço + checkout da Black (desconto vigente segundo a planilha),
 * usa esse par com o preço cheio riscado; senão cai no par normal, sem risco.
 */
/**
 * Preço "de" informado pelo Sérgio, para riscar ao lado do preço cobrado.
 *
 * SÓ ENTRA AQUI O QUE ELE CONFIRMAR. A planilha não tem preço âncora em nenhum
 * dos 107 produtos, e riscar um valor pelo qual o material nunca foi vendido é
 * publicidade enganosa (CDC art. 37). Produto fora desta lista mostra só o
 * preço cobrado, como sempre mostrou.
 *
 * Para acrescentar: uma linha por produto, com o id do catálogo.
 */
const PRECOS_DE_REFERENCIA: Record<string, number> = {
  'assinatura-flashcards-regular': 1997,
};

/**
 * Fator do parcelamento em 12x da Eduzz, com juros.
 *
 * Derivado dos dois exemplos que o Sérgio mandou, e os dois batem ao centavo:
 *   R$ 897 -> 12x de R$ 92,77   (897  x 1,2411 / 12 = 92,77)
 *   R$ 157 -> 12x de R$ 16,24   (157  x 1,2411 / 12 = 16,24)
 *
 * Se a Eduzz mudar a tabela, é esta constante que muda. Vale conferir num
 * checkout de verdade antes de anunciar: o valor da parcela é promessa, e
 * promessa que o checkout não cumpre vira reclamação.
 */
const FATOR_12X = 1.2411;

export function parcelaEmDozeVezes(preco: number): number {
  return Math.round((preco * FATOR_12X) / 12 * 100) / 100;
}

export interface Oferta {
  /** preço cobrado no destino */
  preco: number;
  /** preço "de" para riscar (null = sem desconto a exibir) */
  precoAntigo: number | null;
  /** percentual de desconto inteiro (ex.: 45), null quando não há */
  percentualOff: number | null;
  /** valor de cada uma das 12 parcelas, com os juros da Eduzz */
  parcela12x: number;
  /** para onde o botão de compra leva */
  checkout: string;
  /**
   * true = o destino é a página do produto no site, não um checkout que já cobra.
   * A UI usa isso para rotular o botão com honestidade ("Ver na loja" em vez de
   * "Comprar agora"), porque ainda falta um passo até o pagamento.
   */
  viaPaginaDeVendas: boolean;
}

/**
 * @param referenciaExterna preço "de" vindo de fora da planilha, para os
 * materiais cadastrados no painel: lá quem digita o valor riscado é o Sérgio,
 * e ele não passa por este mapa.
 */
export function ofertaAtual(p: Produto, referenciaExterna?: number | null): Oferta | null {
  const { cheio, black } = p.precos;

  // referência só vale se for MAIOR que o preço cobrado, senão o risco vira piada
  const referencia = referenciaExterna ?? PRECOS_DE_REFERENCIA[p.id] ?? null;

  // O PREÇO BLACK SÓ VALE DURANTE A CAMPANHA BLACK FRIDAY.
  //
  // Antes bastava existir um checkout black na planilha para o site adotar
  // aquele valor como preço de hoje, e a planilha guarda esses links o ano
  // inteiro. O resultado apareceu numa conferência do Sérgio em 05/09: dezesseis
  // produtos anunciados abaixo do preço real, alguns com R$ 400 de diferença.
  // O "Combo Flashcards Fiscal Regular" saía por R$ 297 quando a loja cobra
  // R$ 497, e quem clicasse ia para um checkout de campanha encerrada.
  //
  // Guardar o valor da última black é útil, e por isso ele continua na planilha.
  // O que mudou é que agora precisa estar marcado como campanha ativa.
  const blackAtiva = p.campanha === 'blackfriday';

  if (blackAtiva && p.checkouts.black && black !== null) {
    const temRisco = cheio !== null && cheio > black;
    return {
      preco: black,
      precoAntigo: temRisco ? cheio : null,
      percentualOff: temRisco ? Math.round((1 - black / cheio) * 100) : null,
      parcela12x: parcelaEmDozeVezes(black),
      checkout: p.checkouts.black,
      viaPaginaDeVendas: false,
    };
  }
  if (cheio === null) return null;

  const temReferencia = referencia !== null && referencia > cheio;

  if (p.checkouts.normal) {
    return {
      preco: cheio,
      precoAntigo: temReferencia ? referencia : null,
      percentualOff: temReferencia ? Math.round((1 - cheio / referencia) * 100) : null,
      parcela12x: parcelaEmDozeVezes(cheio),
      checkout: p.checkouts.normal,
      viaPaginaDeVendas: false,
    };
  }
  // Sem checkout próprio: a venda acontece na página do produto, na loja.
  //
  // `paraLoja` existe por causa da virada do domínio: quando a loja passar a
  // atender em loja.esquematizaai.com, este é o único ponto do site que
  // transforma o endereço guardado na planilha em link de compra, então os 140
  // botões acompanham sozinhos. Hoje ela devolve o link intacto.
  if (p.urlSite) {
    return {
      preco: cheio,
      precoAntigo: temReferencia ? referencia : null,
      percentualOff: temReferencia ? Math.round((1 - cheio / referencia) * 100) : null,
      parcela12x: parcelaEmDozeVezes(cheio),
      checkout: paraLoja(p.urlSite),
      viaPaginaDeVendas: true,
    };
  }
  return null;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 1.094,00" (determinístico: mesmo resultado no servidor e no navegador) */
export function formatarPreco(valor: number): string {
  return brl.format(valor);
}

/**
 * Capa do produto (WebP otimizado em /public/capas, gerado por scripts/build-capas.js).
 * null = produto ainda sem capa; a UI usa o fallback desenhado.
 */
export interface Capa {
  src: string;
  width: number;
  height: number;
}

const capas = capasDb.capas as Record<string, Capa>;

export function capaDe(produtoOuId: Produto | string): Capa | null {
  const id = typeof produtoOuId === 'string' ? produtoOuId : produtoOuId.id;
  return capas[id] ?? null;
}

/* As amostras deixaram de ser PDF servido por produto: o botão da página do
   produto manda todo mundo para a pasta compartilhada no Google Drive, definida
   em AMOSTRAS_DRIVE_URL (src/config.ts). Saíram daqui o mapa amostras.json, a
   função amostraDe() e os 70 MB de PDFs que ficavam em /public/amostras.
   Nada disso tem a ver com /public/amostras-produto, que são as imagens dos
   resumos usadas no Arsenal e na galeria, e continuam em uso. */

/**
 * Descrição longa de vendas, em Markdown, capturada da página do produto no
 * WordPress por scripts/build-conteudo-produto.js. É a versão com hierarquia (listas,
 * destaques, caixas), diferente do campo `sobre` da planilha, que é um
 * parágrafo corrido bom para meta description mas ruim para ler na tela.
 */
export interface PerguntaFrequente {
  pergunta: string;
  resposta: string;
}

export interface ConteudoProduto {
  /** argumento de venda ("Sobre o produto") */
  sobre?: string;
  /** dúvidas que travam a compra: reembolso, prazo de liberação, download */
  faq?: PerguntaFrequente[];
  /** módulos e disciplinas, com o que já está liberado */
  detalhes?: string;
  /** nome da aba de detalhes no WordPress (varia entre combo e isolado) */
  detalhesTitulo?: string;
  /** tópicos de cada disciplina */
  sumario?: string;
  /** se o material está pronto ou tem entrega marcada para o futuro */
  cronograma?: string;
}

const conteudo = conteudoDb.conteudo as Record<string, ConteudoProduto>;

/** Todo o conteúdo editorial do produto capturado da página de venda. */
export function conteudoDe(produtoOuId: Produto | string): ConteudoProduto {
  const id = typeof produtoOuId === 'string' ? produtoOuId : produtoOuId.id;
  return conteudo[id] ?? {};
}

export function sobreRicoDe(produtoOuId: Produto | string): string | null {
  return conteudoDe(produtoOuId).sobre ?? null;
}

/**
 * Selos de confiança do produto, para o letreiro abaixo do botão de compra.
 *
 * Cada selo é DEDUZIDO do texto do próprio produto, nunca fixo. Medido no
 * catálogo: "12 meses de acesso" vale para 107 de 107, mas "7 dias de
 * garantia" só aparece em 33. Um letreiro igual para todos prometeria
 * devolução em 74 produtos que não declaram isso.
 */
export function selosDe(p: Produto): string[] {
  const texto = `${p.sobre ?? ''} ${conteudoDe(p).sobre ?? ''}`.toLowerCase();
  const tem = (re: RegExp) => re.test(texto);
  const selos: string[] = [];

  if (tem(/12 meses|1 ano de acesso|acesso de 12/)) selos.push('Acesso por 12 meses');
  if (tem(/atualiza(ç|c)(õ|o)es inclu|com atualiza/)) selos.push('Atualizações incluídas');
  if (tem(/download/)) selos.push('Download imediato');
  if (tem(/impress(ã|a)o/)) selos.push('Pode imprimir');
  if (tem(/12x|parcel/)) selos.push('Parcelamento em até 12x');
  // vale para todos, e não só para os 33 cuja descrição menciona: o próprio FAQ
  // do Esquematiza diz que segue o art. 49 do Código de Defesa do Consumidor,
  // que dá 7 dias de arrependimento em qualquer compra online
  selos.push('7 dias de garantia');
  // Anki sai da FERRAMENTA e não do texto: a descrição da Assinatura de
  // Resumos cita flashcards numa recomendação cruzada, e a busca por texto
  // colava "Compatível com o Anki" num produto que é só PDF.
  if (p.ferramenta === 'Flashcards' || /^Flashcards/i.test(p.nome)) {
    selos.push('Compatível com o Anki');
  }
  if (tem(/suporte/)) selos.push('Suporte por WhatsApp');
  /**
   * O SELO DIZIA "Eduzz" PARA TODO MUNDO, porque nascia só de "tem link de
   * checkout?". No Tecnologia da Informação Esquematizada, cobrado pela Tutory,
   * ele afirmava a empresa errada bem ao lado do botão de comprar. O Sérgio viu
   * em 27/09, nove dias depois de ver o mesmo erro na frase logo acima.
   *
   * Agora quem responde é o endereço do checkout, pela mesma função que a frase
   * usa. Destino que não reconhecemos ganha a versão genérica, que é verdadeira
   * para qualquer um deles.
   */
  const checkout = p.checkouts.normal ?? p.checkouts.black;
  if (checkout) {
    const processador = processadorDoCheckout(checkout);
    selos.push(processador ? `Pagamento seguro pela ${processador}` : 'Pagamento 100% seguro');
  }

  return selos;
}
