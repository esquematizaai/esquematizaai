'use client';

/**
 * Cards "Acesso 12 meses" e "Acesso 24 meses". Entram no card de compra (aside),
 * NO LUGAR do selo "-X% de desconto" (offPill) e do bloco de preço (priceBlock).
 * Ordem: 12 meses em cima, 24 meses embaixo. 24 meses vem marcado e com a etiqueta "Mais vantajoso".
 */

import { usePlano } from './PlanoContext';
import { brl, brlCurto } from '@/lib/planos';
import css from './SeletorPlanos.module.css';

export function SeletorPlanos() {
  const { produto, meses, setMeses } = usePlano();
  if (produto?.tipo !== 'planos' || !produto.planos) return null;

  const ordem = [...produto.planos].sort((a, b) => a.meses - b.meses);

  return (
    <div className={css.planos} role="radiogroup" aria-label="Escolha seu plano">
      {ordem.map((p) => {
        const ativo = p.meses === meses;
        const id = `plano-${produto.id}-${p.meses}`;
        return (
          <label key={p.meses} htmlFor={id} className={`${css.plano} ${ativo ? css.ativo : ''}`}>
            {p.meses === 24 && <span className={css.tag}>Mais vantajoso</span>}
            <span className={css.linha}>
              <input
                id={id}
                type="radio"
                name={`plano-${produto.id}`}
                value={p.meses}
                checked={ativo}
                onChange={() => setMeses(p.meses)}
                className={css.radio}
              />
              <span className={css.bolinha} aria-hidden="true" />
              <span className={css.nome}>Acesso {p.meses} meses</span>
              {p.descontoPct > 0 && <span className={css.off}>{p.descontoPct}% OFF</span>}
            </span>
            <span className={css.precos}>
              {p.precoDe > p.preco && <s className={css.de}>{brlCurto(p.precoDe)}</s>}
              <strong className={css.por}>{brlCurto(p.preco)}</strong>
            </span>
            <span className={css.parcela}>
              ou até {p.semJurosAte}x de {brl(p.parcelaSemJuros)} sem juros no cartão
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Linha de parcelamento para produtos de Legislação Tributária (sem planos): "2x de R$ 128,50 sem juros ou R$ 257,00 à vista". */
export function ParcelamentoLegislacao({ className }: { className?: string }) {
  const { produto } = usePlano();
  if (produto?.tipo !== 'legislacao' || !produto.preco) return null;
  const n = produto.semJurosAte ?? 2;
  return (
    <span className={className}>
      <strong>
        {n}x de {brl(produto.preco / n)} sem juros
      </strong>{' '}
      ou {brl(produto.preco)} à vista
    </span>
  );
}
