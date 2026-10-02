'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { assinarNewsletter, completarNewsletter } from '@/app/newsletter-actions';
import { AREAS_DE_CONCURSO } from '@/lib/areas-de-concurso';
import styles from './styles.module.css';

const STORAGE_KEY = 'esquematiza_lead_popup_dismissed';
const DELAY_MS = 8000;

/**
 * Pop-up de captação da newsletter.
 *
 * Passou a ser o ÚNICO lugar da newsletter no site: a faixa laranja que ficava
 * entre os depoimentos e a vitrine saiu. Um convite só, na hora certa, em vez
 * de uma barra colorida cortando a home no meio.
 *
 * ELE NÃO GRAVAVA NADA ATÉ 02/10. Pedia o e-mail desde 09/06, mostrava "Voou.
 * Em breve você recebe as novidades" e descartava o endereço: não havia chamada
 * de rede, nem tabela, nem serviço de e-mail. Quase quatro meses de gente se
 * cadastrando no vazio, acreditando numa lista que não existia.
 *
 * AGORA SÃO DOIS PASSOS, e cada um grava sozinho. O primeiro pede só o e-mail,
 * que é o que de fato interessa; com ele salvo, a janela abre telefone e área.
 * Fosse uma gravação só no fim, quem desistisse no segundo passo se perderia de
 * novo, que é exatamente o defeito que estamos consertando.
 */
type Passo = 'email' | 'extras' | 'pronto';

export default function LeadPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [area, setArea] = useState('');
  const [passo, setPasso] = useState<Passo>('email');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoTelefone = useRef<HTMLInputElement>(null);

  // animateMotion é SMIL, não CSS: a regra prefers-reduced-motion não o alcança.
  // Sem esta checagem, quem pediu menos movimento no sistema veria o avião voar
  // do mesmo jeito. Começa em false para o servidor e o cliente renderizarem
  // igual, e só depois a preferência é lida.
  const [semMovimento, setSemMovimento] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSemMovimento(consulta.matches);
    const aoMudar = (e: MediaQueryListEvent) => setSemMovimento(e.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;

    const timer = window.setTimeout(() => setOpen(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
  }, []);

  // Esc fecha, e o foco vai para o campo ao abrir: sem isso a pessoa que navega
  // por teclado fica presa atrás de uma janela que ela não consegue dispensar.
  useEffect(() => {
    if (!open) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', aoTeclar);
    if (passo === 'extras') campoTelefone.current?.focus();
    else campoEmail.current?.focus();
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [open, close, passo]);

  /**
   * Passo 1: o e-mail entra na lista antes de pedir qualquer outra coisa.
   *
   * Só marca o pop-up como visto DEPOIS de gravar. Marcando antes, uma falha de
   * rede custaria a pessoa duas vezes: ela não entraria na lista e a janela não
   * voltaria a aparecer para ela tentar de novo.
   */
  const enviarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || enviando) return;

    setEnviando(true);
    setErro(null);

    const dados = new FormData();
    dados.set('email', email);
    const r = await assinarNewsletter(dados);

    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setPasso('extras');
  };

  /** Passo 2: telefone e área completam quem já está salvo. */
  const enviarExtras = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;

    setEnviando(true);
    setErro(null);

    const dados = new FormData();
    dados.set('email', email);
    dados.set('telefone', telefone);
    dados.set('area', area);
    const r = await completarNewsletter(dados);

    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }

    setPasso('pronto');
    window.setTimeout(() => setOpen(false), 2600);
  };

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-newsletter"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Faixa Azul Marinho com o símbolo: é o que dá cara de Esquematiza à
            janela, no lugar do fio laranja que havia antes no topo. */}
        <div className={styles.topo}>
          <Image
            src="/logos/logo-simbolo-3cores.png"
            alt=""
            width={44}
            height={53}
            className={styles.simbolo}
            aria-hidden="true"
            /* eager e não lazy: este elemento só existe depois que a janela
               abre, então esperar ele entrar em viewport não adianta nada e
               ainda deixa o topo sem logo por um instante. */
            loading="eager"
          />
          <button className={styles.closeBtn} onClick={close} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className={styles.corpo}>
          {passo === 'email' ? (
            <>
              <h3 className={styles.title} id="titulo-newsletter">
                Assine a nossa{' '}
                <span className={styles.palavraNewsletter}>
                  {/* Rota e avião no MESMO svg, de propósito: o avião percorre
                      exatamente a curva desenhada pelo rastro, via animateMotion.
                      Antes eram dois elementos com animações separadas em CSS, e
                      o avião pulava entre pontos em vez de curvar. Decorativo, o
                      título se lê sem isto. */}
                  <svg className={styles.rota} viewBox="0 0 200 46" fill="none" aria-hidden="true">
                    <path
                      id="rota-do-aviao"
                      d="M8 38 C 54 6, 128 2, 186 20"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="5 8"
                      className={styles.rastro}
                    />

                    <g className={styles.aviao}>
                      {/* Velocidade constante, de propósito.
                          Com aceleração o avião disparava no meio e quase
                          parava no fim: medido, andava 9, 33, 32, 13 e 3
                          unidades entre amostras iguais no tempo. Avião não
                          freia no ar; linear deixa o voo parelho e ainda tira o
                          solavanco na volta do ciclo. */}
                      {!semMovimento && (
                        <animateMotion
                          dur="5s"
                          repeatCount="indefinite"
                          rotate="auto"
                          calcMode="linear"
                        >
                          <mpath href="#rota-do-aviao" />
                        </animateMotion>
                      )}
                      {/* desenhado em torno da origem para animateMotion o
                          posicionar pelo centro, e não pelo canto */}
                      <g transform="scale(0.8) translate(-12.5, -12)">
                        {/* asa de cima e asa de baixo: são as duas faces da
                            dobra do papel. A diferença de opacidade é o que faz
                            parecer papel dobrado, e não uma seta chapada. */}
                        <path d="M23 12 L2 3 L7 12 Z" fill="currentColor" />
                        <path d="M23 12 L7 12 L2 21 Z" fill="currentColor" opacity="0.55" />
                      </g>
                    </g>
                  </svg>
                  newsletter
                </span>
              </h3>

              <p className={styles.subtitle}>
                Receba antes de todo mundo os editais do Fisco, datas de prova e dicas de
                estudo direto no seu e-mail.
              </p>

              <form className={styles.form} onSubmit={enviarEmail}>
                <input
                  ref={campoEmail}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Seu melhor e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                  disabled={enviando}
                />
                <button type="submit" className={styles.submit} disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Quero receber'}
                </button>
              </form>

              {erro && <p className={styles.erro}>{erro}</p>}

              <p className={styles.disclaimer}>Sem spam. Cancele quando quiser.</p>
            </>
          ) : passo === 'extras' ? (
            <>
              {/* O TOM MUDA AQUI DE PROPÓSITO: ela já está na lista, e o título
                  diz isso antes de pedir mais qualquer coisa. Pedir telefone
                  sem confirmar o que já aconteceu parece pedágio. */}
              <h3 className={styles.title} id="titulo-newsletter">
                Pronto, você está na lista.
              </h3>
              <p className={styles.subtitle}>
                Quer receber também os avisos urgentes de edital no WhatsApp? É opcional.
              </p>

              <form className={styles.form} onSubmit={enviarExtras}>
                <input
                  ref={campoTelefone}
                  type="tel"
                  name="telefone"
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="WhatsApp com DDD (opcional)"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className={styles.input}
                  disabled={enviando}
                />
                <select
                  name="area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className={styles.input}
                  disabled={enviando}
                  aria-label="Área de concurso"
                >
                  <option value="">Sua área de concurso (opcional)</option>
                  {AREAS_DE_CONCURSO.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <button type="submit" className={styles.submit} disabled={enviando}>
                  {enviando ? 'Salvando...' : 'Concluir'}
                </button>
              </form>

              {erro && <p className={styles.erro}>{erro}</p>}

              {/* Sair daqui não desfaz nada: o e-mail foi gravado no passo
                  anterior. A saída precisa estar visível, senão a janela vira
                  uma cobrança por dados que a pessoa não quis dar. */}
              <button type="button" className={styles.pular} onClick={close}>
                Deixar para depois
              </button>
            </>
          ) : (
            <div className={styles.success}>
              <div className={styles.successIcon} aria-hidden="true">
                {/* o mesmo avião do título, agora pousado */}
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M23 12 L2 3 L7 12 Z" fill="currentColor" />
                  <path d="M23 12 L7 12 L2 21 Z" fill="currentColor" opacity="0.55" />
                </svg>
              </div>
              <h3 className={styles.title}>Voou.</h3>
              <p className={styles.subtitle}>
                Em breve você recebe as novidades dos próximos concursos no seu e-mail.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
