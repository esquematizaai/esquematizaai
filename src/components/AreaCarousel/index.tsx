'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './styles.module.css';

export interface VitrineItem {
  id: string;
  nome: string;
  rotulo: string;
  preco: number;
  precoAntigo: number | null;
  percentualOff: number | null;
  checkout: string;
  /** true = o link leva à página do produto, não a um checkout que já cobra */
  viaPaginaDeVendas: boolean;
  capa: { src: string; width: number; height: number } | null;
}

export interface AreaSection {
  key: string;
  title: string;
  subtitle: string;
  items: VitrineItem[];
}

const MAX_POR_SECAO = 6;


export default function AreaCarousel({ sections }: { sections: AreaSection[] }) {
  const [active, setActive] = useState(0);
  const total = sections.length;

  if (total === 0) return null;

  const go = (idx: number) => setActive(((idx % total) + total) % total);
  const temControles = total > 1;

  return (
    <div className={styles.carousel}>
      {temControles && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.arrowLeft}`}
          onClick={() => go(active - 1)}
          aria-label="Seção anterior"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      )}

      <div className={styles.viewport}>
        <div className={styles.track} style={{ transform: `translateX(-${active * 100}%)` }}>
          {sections.map((section) => {
            const visiveis = section.items.slice(0, MAX_POR_SECAO);
            const restantes = section.items.length - visiveis.length;
            return (
              <div key={section.key} className={styles.slide}>
                <div className={styles.slideHeader}>
                  <h2 className={styles.slideTitle}>{section.title}</h2>
                  <p className={styles.slideSubtitle}>{section.subtitle}</p>
                </div>

                <div className={styles.cards}>
                  {visiveis.map((item) => (
                    <article key={item.id} className={styles.card}>
                      {item.capa && (
                        <Link
                          href={`/vitrine/produto/${item.id}`}
                          className={styles.capaWrap}
                          aria-label={`Ver detalhes de ${item.nome}`}
                          tabIndex={-1}
                        >
                          <Image
                            src={item.capa.src}
                            alt={`Capa de ${item.nome}`}
                            width={item.capa.width}
                            height={item.capa.height}
                            className={styles.capaImg}
                          />
                        </Link>
                      )}
                      <div className={styles.cardHeader}>
                        <span className={styles.badge}>{item.rotulo}</span>
                        {/* PREÇO FORA DO CARTÃO desde 07/10/2026, a pedido do Sérgio: "a ideia
                      é a pessoa clicar e saber o preço lá dentro (vão ter 2 preços)".
                      Com a loja vendendo 12 e 24 meses, um número só aqui contradiz
                      a página do produto, que abre com o plano de 24 marcado. */}
                      </div>

                      <h3 className={styles.cardTitle}>
                        <Link href={`/vitrine/produto/${item.id}`} className={styles.cardTitleLink}>
                          {item.nome}
                        </Link>
                      </h3>



                      {/* leva à página do produto; o checkout fica lá dentro */}
                      <Link
                        href={`/vitrine/produto/${item.id}`}
                        className={styles.cardBtn}
                        aria-label={`Ver detalhes de ${item.nome}`}
                      >
                        Ver produto →
                      </Link>
                    </article>
                  ))}
                </div>

                {restantes > 0 && (
                  <div className={styles.slideFooter}>
                    <Link href="/#vitrine" className={styles.sectionCta}>
                      Ver todos os {section.items.length} materiais →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {temControles && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.arrowRight}`}
          onClick={() => go(active + 1)}
          aria-label="Próxima seção"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      )}

      {temControles && (
        <div className={styles.tabs} role="tablist">
          {sections.map((section, i) => (
            <button
              key={section.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`${styles.tab} ${i === active ? styles.tabActive : ''}`}
              onClick={() => go(i)}
            >
              {section.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
