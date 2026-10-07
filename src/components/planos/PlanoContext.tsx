'use client';

/**
 * Guarda o plano escolhido (12 ou 24 meses) e compartilha entre o card de compra
 * (aside) e a barra fixa do rodapé, que são componentes separados na página.
 *
 * Veio pronto do Sérgio, no pacote-planos-vitrine.zip. Mudou numa coisa: os dois
 * ganchos de leitura moram aqui agora, e não num BotaoComprar à parte. O pacote
 * trazia um botão próprio, e a vitrine já tem o seu, que mede o begin_checkout e
 * cola a utm da campanha no endereço do checkout. Trocar um pelo outro ligaria
 * os planos e desligaria a medição da agência no mesmo commit.
 *
 * Uso: envolver o trecho que contém o card e a barra
 *   <PlanoProvider produto={planos}> ... </PlanoProvider>
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { linkCompra, type Plano, type ProdutoPlanos } from '@/lib/planos';

interface PlanoCtx {
  produto: ProdutoPlanos | null;
  meses: 12 | 24 | null; // null quando o produto não tem planos
  setMeses: (m: 12 | 24) => void;
  plano: Plano | null; // plano selecionado
}

const Ctx = createContext<PlanoCtx>({ produto: null, meses: null, setMeses: () => {}, plano: null });

export function PlanoProvider({ produto, children }: { produto: ProdutoPlanos | null; children: ReactNode }) {
  const temPlanos = produto?.tipo === 'planos' && !!produto.planos?.length;
  const [meses, setMeses] = useState<12 | 24 | null>(temPlanos ? produto!.planoPadrao ?? 24 : null);

  const valor = useMemo<PlanoCtx>(() => {
    const plano = temPlanos ? produto!.planos!.find((p) => p.meses === meses) ?? null : null;
    return { produto, meses, setMeses: (m) => setMeses(m), plano };
  }, [produto, meses, temPlanos]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const usePlano = () => useContext(Ctx);

/**
 * O endereço de compra do plano escolhido.
 *
 * MANDA O &plano= SEMPRE que houver plano, inclusive no primeiro desenho da
 * página. Conferido na loja em 07/10: o link sem parâmetro entra como 12 meses e
 * R$ 697. Como o card de 24 meses vem marcado, um link sem parâmetro anunciaria
 * 24 meses na tela e cobraria 12 no carrinho.
 */
export function useHrefDoPlano(hrefPadrao: string): string {
  const { produto, plano } = usePlano();
  return produto && plano ? linkCompra(produto.id, plano.meses) : hrefPadrao;
}

/** Preço e preço riscado do plano escolhido, para a barra fixa acompanhar o card. */
export function usePrecoDoPlano(
  precoAtual: number,
  precoAntigoAtual: number | null,
): { preco: number; precoAntigo: number | null } {
  const { plano } = usePlano();
  if (!plano) return { preco: precoAtual, precoAntigo: precoAntigoAtual };
  return { preco: plano.preco, precoAntigo: plano.precoDe > plano.preco ? plano.precoDe : null };
}
