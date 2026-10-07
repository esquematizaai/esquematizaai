/**
 * Planos de acesso 12/24 meses, 07/10/2026.
 *
 * ESTE ARQUIVO VEIO PRONTO DO SÉRGIO, no pacote-planos-vitrine.zip, junto com os
 * componentes. A loja em WooCommerce passou a vender cada material em dois
 * prazos de acesso, e a vitrine precisa mostrar a mesma oferta. Quem cobra é a
 * loja: aqui só se exibe e se monta o link.
 *
 * O SNAPSHOT EM data/planos.json NÃO É O DO ZIP. O que veio no pacote já nasceu
 * velho: dizia que seis produtos só aceitavam à vista, e a loja já aceitava 2x
 * sem juros neles. Regerei do endpoint ao vivo no dia em que isto entrou. Ele é
 * paraquedas, não fonte: quem manda é o endpoint, e o arquivo só evita que a
 * página fique sem preço se a loja não responder.
 *
 * Conferido antes de entrar, nos três links e até a tela de checkout:
 * plano=24 cobra R$ 877 e escreve "Acesso: 24 meses"; plano=12 cobra R$ 697 e
 * escreve "Acesso: 12 meses"; sem parâmetro cai em 12 meses. Por isso o botão
 * manda o &plano= SEMPRE, inclusive no primeiro desenho da página: o card de 24
 * vem marcado, e um link sem parâmetro anunciaria 24 meses e cobraria 12.
 *
 * Planos de acesso 12/24 meses: dados e helpers.
 *
 * Fonte da verdade: a loja (WooCommerce). Duas formas de obter os dados:
 *  1) Endpoint da loja (recomendado, quando estiver ativo):
 *     GET https://loja.esquematizaai.com/wp-json/esq/v1/planos
 *     GET https://loja.esquematizaai.com/wp-json/esq/v1/planos/{lojaId}
 *  2) Snapshot local: dados/planos.json (copiar para o repo, ex.: /data/planos.json)
 *
 * getProdutoPlanos() tenta o endpoint e cai no snapshot se ele falhar.
 */

import snapshot from '@/data/planos.json';

export type TipoProduto = 'planos' | 'legislacao' | 'sem_plano';

export interface Plano {
  meses: 12 | 24;
  preco: number;          // preço "por"
  precoDe: number;        // preço "de" (riscado)
  descontoPct: number;    // % OFF exibido no selo
  semJurosAte: number;    // 2 (12 meses) ou 3 (24 meses)
  parcelaSemJuros: number;// preco / semJurosAte
  linkCompra: string;     // https://loja.esquematizaai.com/?comprar={id}&plano={meses}
}

export interface ProdutoPlanos {
  id: number;             // ID do produto na loja (o mesmo do ?comprar=)
  nome: string;
  vitrineSlug: string | null;
  linkCompra: string;     // link sem plano (?comprar={id})
  tipo: TipoProduto;
  // tipo === 'planos'
  planoPadrao?: 12 | 24;
  planos?: Plano[];
  // tipo === 'legislacao' | 'sem_plano'
  preco?: number;
  precoDe?: number | null;
  semJurosAte?: number;   // 2 nos dois casos; o comentário original dizia 1 em sem_plano, e a loja já aceitava 2
}

const ENDPOINT = 'https://loja.esquematizaai.com/wp-json/esq/v1/planos';
const REVALIDATE_SEGUNDOS = 600; // 10 min

const porId = new Map<number, ProdutoPlanos>(
  (snapshot as { produtos: ProdutoPlanos[] }).produtos.map((p) => [p.id, p]),
);

/** Lê do snapshot local (síncrono). */
export function getProdutoPlanosLocal(lojaId: number): ProdutoPlanos | null {
  return porId.get(lojaId) ?? null;
}

/** Lê do endpoint da loja com cache do Next; se falhar, usa o snapshot. Chamar no servidor. */
export async function getProdutoPlanos(lojaId: number): Promise<ProdutoPlanos | null> {
  try {
    const r = await fetch(`${ENDPOINT}/${lojaId}`, { next: { revalidate: REVALIDATE_SEGUNDOS } });
    if (r.ok) {
      const p = (await r.json()) as ProdutoPlanos;
      if (p && p.id === lojaId) return p;
    }
  } catch {
    /* cai no snapshot */
  }
  return getProdutoPlanosLocal(lojaId);
}

/** Extrai o ID da loja de um link de compra atual da vitrine (https://loja.esquematizaai.com/?comprar=15761). */
export function lojaIdDoLink(link: string): number | null {
  const m = /[?&]comprar=(\d+)(?:&|$)/.exec(link);
  return m ? Number(m[1]) : null;
}

const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** R$ 697,00 */
export const brl = (v: number) => brl2.format(v).replace(/ /g, ' ');
/** R$ 697 quando inteiro; R$ 697,50 quando tem centavos (uso nos cards) */
export const brlCurto = (v: number) => (Math.abs(v - Math.round(v)) < 0.005 ? brl0 : brl2).format(v).replace(/ /g, ' ');

/** Link de compra para um plano (ou sem plano). */
export function linkCompra(lojaId: number, meses?: 12 | 24): string {
  return `https://loja.esquematizaai.com/?comprar=${lojaId}${meses ? `&plano=${meses}` : ''}`;
}
