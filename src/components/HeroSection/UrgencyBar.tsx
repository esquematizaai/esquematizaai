'use client';

import React from 'react';
import styles from './styles.module.css';

/**
 * A tarja do topo. Hoje ela fala de parcelamento, e não mais de cupom.
 *
 * ATÉ 07/10/2026 ELA ANUNCIAVA O CUPOM ESQUEMATIZA10, de 10% na primeira
 * compra, com um relógio de 10 minutos ao lado. O Sérgio mandou tirar quando a
 * loja passou a vender cada material em 12 ou 24 meses de acesso, com parcela
 * sem juros: o argumento de venda deixou de ser desconto e passou a ser caber no
 * cartão. O cupom em si é da loja, e sair daqui não o apaga de lá.
 *
 * O RELÓGIO SAIU JUNTO, e essa parte é decisão de engenharia. Contagem
 * regressiva serve para oferta que acaba. Parcelamento não acaba às 17h32: é
 * condição permanente do checkout. Um relógio ao lado dele seria pressa
 * inventada, e a pessoa que voltasse dez minutos depois veria a mesma frase com
 * o relógio zerado e aprenderia que a nossa urgência é de mentira.
 *
 * "ATÉ 3x" É O MÁXIMO, E O MÁXIMO É VERDADE EM 84 DOS 120 MATERIAIS. Os 30 de
 * Legislação Tributária e outros 6 vão até 2x, e esta tarja aparece na home, na
 * vitrine e nas páginas de área, que listam o catálogo inteiro. Por isso a frase
 * diz "até", e por isso ela não promete prazo de acesso nem valor de parcela:
 * esses variam por material e quem diz é a página do produto.
 */
export default function UrgencyBar() {
  return (
    <div className={styles.urgencyBar}>
      <div className={styles.urgencyBarInner}>
        <span className={styles.urgencyFlash}>💳</span>
        <span className={styles.urgencyText}>
          Parcele seu material em <strong>até 3x sem juros</strong> no cartão. Aproveite!
        </span>
        <span className={styles.urgencyAcao}>
          <a href="/vitrine" className={styles.urgencyCta}>
            VER MATERIAIS →
          </a>
        </span>
      </div>
    </div>
  );
}
