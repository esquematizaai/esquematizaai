'use client';

import { useEffect, useRef, useState } from 'react';
import { avisarGtm, comCampanha, type ItemMedido } from '@/lib/rastreio';
import { useHrefDoPlano, usePlano, usePrecoDoPlano } from '@/components/planos/PlanoContext';
import { formatarPreco } from '@/data/catalogo';
import styles from './styles.module.css';

/**
 * Barra fixa no rodapé da tela com o botão de compra.
 *
 * Só aparece quando o botão de compra de verdade sai de vista. Mostrar as duas
 * ao mesmo tempo seria dois CTAs iguais brigando na mesma tela, e a barra
 * roubaria espaço bem na hora em que a pessoa está lendo a oferta.
 *
 * Usa IntersectionObserver e não evento de scroll: o navegador avisa quando o
 * alvo entra e sai, sem rodar código a cada pixel rolado.
 *
 * RECEBE NÚMERO, NÃO TEXTO JÁ FORMATADO, desde 07/10/2026. Com os planos de 12 e
 * 24 meses o preço daqui muda quando a pessoa troca o card lá em cima, e texto
 * pronto vindo do servidor não acompanha. Quem formata é esta barra, com a mesma
 * função do resto do site.
 */
export default function BarraCompra({
  alvoId,
  preco,
  precoAntigo,
  rotulo,
  href,
  item,
  externo,
}: {
  /** id do elemento que, ao sair da tela, faz a barra aparecer */
  alvoId: string;
  preco: number;
  precoAntigo?: number | null;
  rotulo: string;
  href: string;
  /** o produto, para medir o clique. Sem ele a barra segue funcionando sem medir. */
  item?: ItemMedido;
  externo: boolean;
}) {
  const { plano } = usePlano();
  const valores = usePrecoDoPlano(preco, precoAntigo ?? null);
  const hrefDoPlano = useHrefDoPlano(href);
  // mede o valor que está na tela, e não o do plano de 12 meses
  const itemDoPlano = item && plano ? { ...item, preco: valores.preco } : item;

  const [visivel, setVisivel] = useState(false);
  const jaMediu = useRef(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alvo = document.getElementById(alvoId);
    if (!alvo) return;

    const obs = new IntersectionObserver(
      ([entrada]) => {
        jaMediu.current = true;
        setVisivel(!entrada.isIntersecting);
      },
      { rootMargin: '-80px 0px 0px 0px' },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [alvoId]);

  /**
   * Mede o clique e leva a campanha junto, igual ao botão do card.
   *
   * São dois botões que fazem a mesma coisa na mesma página, e por isso os dois
   * precisam medir: no celular esta barra é quem a pessoa clica quase sempre,
   * porque o card já saiu da tela quando ela terminou de ler.
   */
  function aoClicar(evento: React.MouseEvent<HTMLAnchorElement>) {
    if (itemDoPlano) avisarGtm('begin_checkout', itemDoPlano);
    evento.currentTarget.href = comCampanha(hrefDoPlano);
  }

  /**
   * Avisa o resto da página que esta barra está no ar, e o quanto ela ocupa.
   *
   * O botão flutuante do WhatsApp mora no mesmo canto e ficava POR CIMA do
   * "Comprar agora": o Sérgio abriu no celular e o dedo caía no WhatsApp em vez
   * do checkout. Ele não pode simplesmente subir sempre, porque nas outras
   * páginas não existe barra e ele ficaria flutuando alto à toa.
   *
   * A altura vai junto porque ela muda com a tela; assim o botão sobe exatamente
   * o necessário, em vez de um valor chutado que quebra quando a barra muda.
   */
  useEffect(() => {
    const corpo = document.body;
    if (visivel) {
      corpo.dataset.barraCompra = 'visivel';
      const altura = caixa.current?.offsetHeight ?? 72;
      corpo.style.setProperty('--altura-barra-compra', `${altura}px`);
    } else {
      delete corpo.dataset.barraCompra;
    }
    return () => {
      delete corpo.dataset.barraCompra;
    };
  }, [visivel]);

  return (
    <div
      ref={caixa}
      className={`${styles.barra} ${visivel ? styles.barraVisivel : ''}`}
      aria-hidden={!visivel}
    >
      <div className={styles.conteudo}>
        <div className={styles.precos}>
          {valores.precoAntigo !== null && (
            <span className={styles.antigo}>{formatarPreco(valores.precoAntigo)}</span>
          )}
          <span className={styles.preco}>{formatarPreco(valores.preco)}</span>
        </div>
        <a
          className={styles.botao}
          href={hrefDoPlano}
          data-plano={plano?.meses ?? undefined}
          {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          /* fora de vista a barra sai da ordem de tabulação, senão o teclado
             para num botão que ninguém enxerga */
          tabIndex={visivel ? 0 : -1}
          onClick={aoClicar}
        >
          {rotulo}
        </a>
      </div>
    </div>
  );
}
