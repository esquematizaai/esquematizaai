'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './styles.module.css';

export interface OfertaHero {
  id: string;
  nome: string;
  area: string | null;
  preco: number;
  precoAntigo: number | null;
  percentualOff: number | null;
  checkout: string;
}

const ROTACAO_MS = 5000;


export default function OfferCarousel({ ofertas }: { ofertas: OfertaHero[] }) {
  const [idx, setIdx] = useState(0);
  const pausado = useRef(false);

  useEffect(() => {
    if (ofertas.length < 2) return;
    // sem rotação automática para quem prefere menos movimento
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (!pausado.current) setIdx((i) => (i + 1) % ofertas.length);
    }, ROTACAO_MS);
    return () => clearInterval(timer);
  }, [ofertas.length]);

  if (ofertas.length === 0) return null;
  const oferta = ofertas[idx];

  return (
    <div
      className={styles.offerCard}
      onMouseEnter={() => { pausado.current = true; }}
      onMouseLeave={() => { pausado.current = false; }}
    >
      {oferta.area && <div className={styles.offerTag}>ÁREA {oferta.area.toUpperCase()}</div>}

      <Image
        src="/logos/logo-horizontal-azul.png"
        alt="Esquematiza Aí"
        width={200}
        height={52}
        className={styles.offerLogo}
        priority
      />

      <div key={oferta.id} className={styles.offerSlide}>
        <div className={styles.offerName}>{oferta.nome}</div>

        {/* PREÇO FORA DO CARTÃO desde 07/10/2026, a pedido do Sérgio: "a ideia
                      é a pessoa clicar e saber o preço lá dentro (vão ter 2 preços)".
                      Com a loja vendendo 12 e 24 meses, um número só aqui contradiz
                      a página do produto, que abre com o plano de 24 marcado. */}

        {/* mesma regra dos cards: cai na página do produto primeiro, e o
            checkout fica lá dentro, depois da descrição */}
        <Link
          href={`/vitrine/produto/${oferta.id}`}
          className={styles.offerBtn}
          aria-label={`Ver detalhes de ${oferta.nome}`}
        >
          QUERO CONHECER
          <span className={styles.offerBtnArrow}>→</span>
        </Link>
      </div>

      {ofertas.length > 1 && (
        <div className={styles.offerDots} role="tablist" aria-label="Ofertas em destaque">
          {ofertas.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Ver oferta: ${o.nome}`}
              className={`${styles.offerDot} ${i === idx ? styles.offerDotActive : ''}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}

      <div className={styles.offerFooter}>
        Compra segura · 7 dias de garantia · pagamento pela Eduzz
      </div>
    </div>
  );
}
