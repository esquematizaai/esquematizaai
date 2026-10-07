'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { rotuloDeFerramenta, ehLegislacaoTributaria } from '@/data/catalogo/rotulos';
import styles from './styles.module.css';

export interface ItemVitrine {
  id: string;
  nome: string;
  categoria: string;
  area: string | null;
  ferramenta: string | null;
  preco: number;
  precoAntigo: number | null;
  percentualOff: number | null;
  checkout: string;
  /** true = o link leva à página do produto, não a um checkout que já cobra */
  viaPaginaDeVendas: boolean;
  capa: { src: string; width: number; height: number } | null;
  /** marcado como destaque no painel */
  destaque: boolean;
  /**
   * Posição escolhida no painel, do menor para o maior. Null é o normal e
   * significa "decida você": só os poucos produtos que o Sérgio quer na frente
   * recebem número.
   */
  ordem: number | null;
}

// fallback desenhado quando o produto ainda não tem capa
const AREA_CAPA_CLASSE: Record<string, string> = {
  'Fiscal': 'capaFallbackFiscal',
  'Controle': 'capaFallbackControle',
  'Policial': 'capaFallbackPolicial',
  'Tribunais': 'capaFallbackTribunais',
  'Bancária': 'capaFallbackBancaria',
  'Legislativo': 'capaFallbackLegislativo',
  'OAB': 'capaFallbackOab',
};

/**
 * Primeira faixa de filtro.
 *
 * "Legislação Tributária" é a exceção da lista: as outras opções são categorias
 * (combo, isolado, assinatura) e essa é uma LINHA de produto, que atravessa as
 * três. São 73 materiais presos a um concurso específico, e quem procura a
 * legislação do seu estado não procura por "combo", procura pelo assunto.
 *
 * Quem decide se o produto é dessa linha é ehLegislacaoTributaria, pelo nome.
 * A coluna da planilha já mudou de vocabulário uma vez e zerou este botão.
 */
const LEGISLACAO = 'legislacao-tributaria';

const SEGMENTOS = [
  { valor: 'todos', rotulo: 'Tudo' },
  { valor: 'assinatura', rotulo: 'Assinaturas' },
  { valor: 'combo', rotulo: 'Combos' },
  { valor: LEGISLACAO, rotulo: 'Legislação Tributária' },
  { valor: 'isolado', rotulo: 'Isolados' },
] as const;

// OAB saiu daqui junto com o produto: o Combo Flashcards Exame OAB, único da
// área, não veio na planilha de 27/08. O rótulo continua mapeado em rotulos.ts,
// então basta o produto voltar para a área funcionar de novo.
const AREAS = ['Fiscal', 'Controle', 'Policial', 'Tribunais', 'Bancária', 'Legislativo'] as const;

// 6 = duas fileiras de 3 no desktop. Com 8, a última fileira ficava pela metade.
const POR_PAGINA = 6;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Legenda de cada faixa de filtro. O catálogo filtra em dois níveis (tipo de
 * material e depois área), e sem dizer isso a pessoa lê como se fossem duas
 * alternativas, não duas escolhas somadas.
 *
 * Ela pisca em ciclo: sobe, aparece, segura um tempo e some. É uma dica, não
 * um rótulo permanente, então não pode brigar por atenção com os botões nem
 * empurrar o catálogo para baixo (por isso opacidade, e não display).
 */
function PassoFiltro({ numero, children }: { numero: number; children: ReactNode }) {
  return (
    <p className={`${styles.passo} ${numero === 2 ? styles.passoAtrasado : ''}`}>
      <span className={styles.passoNumero} aria-hidden="true">
        {numero}
      </span>
      {children}
    </p>
  );
}

/** tira acento e caixa para a busca casar "tributaria" com "Tributária" */
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export default function Catalogo({
  itens,
  tudoVisivel = false,
  comoH1 = false,
}: {
  itens: ItemVitrine[];
  /**
   * Mostrar o catálogo inteiro de uma vez, sem o "Mostrar mais".
   *
   * Ligado só na /vitrine, que é a página que existe para listar tudo. Na home
   * o catálogo é amostra: mostra alguns e convida a ver o resto na vitrine,
   * que é para onde o link ao lado do botão leva.
   */
  tudoVisivel?: boolean;
  /**
   * Usar h1 no título do catálogo.
   *
   * Na /vitrine sim, porque a página não tinha nenhum h1: era um h2 solto
   * seguido de 110 h3. Na home não, senão seriam dois h1 na mesma página,
   * disputando qual é o assunto dela.
   */
  comoH1?: boolean;
}) {
  /**
   * O catálogo abre sem filtro, igual no servidor e no navegador.
   *
   * Isso não é detalhe de estilo, é o que permite a página inteira sair pronta
   * do servidor. Antes o filtro inicial vinha de useSearchParams, que só existe
   * no navegador: o Next não conseguia pré-renderizar, caía no fallback vazio
   * do Suspense, e o HTML que o Google recebia tinha 83 KB sem um nome de
   * produto sequer. Quem abria no celular olhava espaço em branco até o
   * JavaScript chegar.
   *
   * Se o estado inicial dependesse da URL, servidor e navegador montariam
   * listas diferentes na primeira renderização, e aí o React reclama e o
   * conteúdo pisca. Por isso o padrão primeiro, e a URL logo depois.
   */
  const [segmento, setSegmento] = useState<string>('todos');
  const [area, setArea] = useState<string>('todas');
  // na vitrine tudo aparece de uma vez; na home, de seis em seis
  const inicialVisivel = tudoVisivel ? itens.length : POR_PAGINA;
  const [visiveis, setVisiveis] = useState(inicialVisivel);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const inputBusca = useRef<HTMLInputElement>(null);

  /**
   * O filtro que veio na URL, aplicado assim que monta.
   *
   * /vitrine?tipo=combo e /vitrine?busca=tributaria continuam funcionando: é o
   * que faz os atalhos da home e a busca do topo levarem direto ao resultado,
   * em vez de só rolar a página até aqui.
   *
   * Roda uma vez. Depois quem manda são os controles desta tela, senão mexer no
   * filtro brigaria com o endereço.
   */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const tipo = p.get('tipo') ?? '';
    const termo = p.get('busca') ?? '';
    if (SEGMENTOS.some((s) => s.valor === tipo)) setSegmento(tipo);
    if (termo) {
      setBusca(termo);
      setBuscaAberta(true);
    }
  }, []);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    const lista = itens.filter((item) => {
      if (segmento === LEGISLACAO) {
        if (!ehLegislacaoTributaria(item.nome)) return false;
      } else if (segmento !== 'todos' && item.categoria !== segmento) {
        return false;
      }
      if (area !== 'todas' && item.area !== area) return false;
      if (termo && !normalizar(item.nome).includes(termo)) return false;
      return true;
    });
    // na visão geral (sem filtro nem busca): produtos com capa abrem a vitrine e,
    // dentro deles, os combos vêm primeiro (é o carro-chefe da loja);
    // depois: maiores descontos primeiro e, por fim, ordem alfabética
    const visaoGeral = segmento === 'todos' && area === 'todas' && !termo;
    return lista.sort((a, b) => {
      // A POSIÇÃO DIGITADA NO PAINEL VENCE TUDO.
      //
      // O Sérgio pediu em 08/09 para mandar na fila: na área fiscal ele quer o
      // Combo Resumos e o Combo Flashcards Regular na frente, e antes disso a
      // vitrine decidia sozinha. Quem tem número vem primeiro, do menor para o
      // maior; quem está sem número cai na ordenação de sempre, logo depois.
      if ((a.ordem ?? null) !== (b.ordem ?? null)) {
        if (a.ordem == null) return 1;
        if (b.ordem == null) return -1;
        return a.ordem - b.ordem;
      }
      // o que o painel marcou como destaque abre o resto da vitrine
      if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
      if (visaoGeral && !!a.capa !== !!b.capa) return a.capa ? -1 : 1;
      if (visaoGeral) {
        const comboA = a.categoria === 'combo';
        const comboB = b.categoria === 'combo';
        if (comboA !== comboB) return comboA ? -1 : 1;
      }
      const offA = a.percentualOff ?? -1;
      const offB = b.percentualOff ?? -1;
      if (offA !== offB) return offB - offA;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [itens, segmento, area, busca]);

  const contagemSegmento = useMemo(() => {
    const mapa: Record<string, number> = { todos: 0 };
    for (const item of itens) {
      mapa.todos += 1;
      mapa[item.categoria] = (mapa[item.categoria] ?? 0) + 1;
      // a linha conta em paralelo à categoria: o mesmo material aparece em
      // "Combos" e em "Legislação Tributária"
      if (ehLegislacaoTributaria(item.nome)) {
        mapa[LEGISLACAO] = (mapa[LEGISLACAO] ?? 0) + 1;
      }
    }
    return mapa;
  }, [itens]);

  /**
   * Trocar o tipo de produto sempre volta a área para "Todas as áreas".
   *
   * Os dois filtros se cruzam, e nem toda combinação existe: quem tivesse
   * "Controle" marcado e clicasse em "Assinaturas" via a tela vazia, sem
   * entender que o culpado era um filtro de cima que ele já tinha esquecido.
   * O Sérgio topou com isso em 16/09 e pediu esta regra.
   *
   * O caminho contrário não zera nada de propósito: escolher a área depois do
   * tipo é a pessoa refinando o que já viu, e aí a combinação é intencional.
   */
  const trocarSegmento = (valor: string) => {
    setSegmento(valor);
    setArea('todas');
    setVisiveis(inicialVisivel);
  };

  const trocarArea = (valor: string) => {
    setArea(valor);
    setVisiveis(inicialVisivel);
  };

  const emTela = filtrados.slice(0, visiveis);

  return (
    <section className={styles.vitrineSection} id="vitrine">
      <div className={styles.container}>
        <div className={styles.header}>
          {comoH1 ? (
            <h1 className={styles.title}>
              Catálogo <span className={styles.titleAccent}>Completo</span>
            </h1>
          ) : (
            <h2 className={styles.title}>
              Catálogo <span className={styles.titleAccent}>Completo</span>
            </h2>
          )}
          <p className={styles.subtitle}>
            Combos, materiais isolados e assinaturas para concursos das áreas Fiscal, Controle,
            Policial, Tribunais, Bancária e Legislativa. Compra direta no checkout da Eduzz.
          </p>

          <Link href="/mentoria" className={styles.mentoriaCta}>
            Conheça a Mentoria individual
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </Link>
        </div>

        <PassoFiltro numero={1}>Escolha seu produto</PassoFiltro>

        <div className={styles.filters} role="group" aria-label="Filtrar por tipo de produto">
          {SEGMENTOS.map((s) => (
            <button
              key={s.valor}
              type="button"
              className={`${styles.filterBtn} ${segmento === s.valor ? styles.filterBtnActive : ''}`}
              aria-pressed={segmento === s.valor}
              onClick={() => trocarSegmento(s.valor)}
            >
              {s.rotulo}
              <span className={styles.filterCount}>{contagemSegmento[s.valor] ?? 0}</span>
            </button>
          ))}

          <button
            type="button"
            className={`${styles.searchToggle} ${buscaAberta ? styles.searchToggleAtivo : ''}`}
            aria-label={buscaAberta ? 'Fechar busca' : 'Buscar material pelo nome'}
            aria-expanded={buscaAberta}
            onClick={() => {
              const abrindo = !buscaAberta;
              setBuscaAberta(abrindo);
              if (abrindo) setTimeout(() => inputBusca.current?.focus(), 60);
              else { setBusca(''); setVisiveis(inicialVisivel); }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>

        {buscaAberta && (
          <div className={styles.searchRow}>
            <div className={styles.searchField}>
              <svg className={styles.searchIcon} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                ref={inputBusca}
                type="search"
                className={styles.searchInput}
                placeholder="Buscar material pelo nome. Ex.: legislação tributária"
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setVisiveis(inicialVisivel); }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setBusca(''); setBuscaAberta(false); } }}
                aria-label="Buscar material pelo nome"
              />
              {busca && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => { setBusca(''); setVisiveis(inicialVisivel); inputBusca.current?.focus(); }}
                  aria-label="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>
            {busca && (
              <span className={styles.searchResultado}>
                {filtrados.length} {filtrados.length === 1 ? 'resultado' : 'resultados'}
              </span>
            )}
          </div>
        )}

        <PassoFiltro numero={2}>Escolha sua área de concurso</PassoFiltro>

        <div className={styles.areaFilters} role="group" aria-label="Filtrar por área de concurso">
          <button
            type="button"
            className={`${styles.areaBtn} ${area === 'todas' ? styles.areaBtnActive : ''}`}
            aria-pressed={area === 'todas'}
            onClick={() => trocarArea('todas')}
          >
            Todas as áreas
          </button>
          {AREAS.map((a) => (
            <button
              key={a}
              type="button"
              className={`${styles.areaBtn} ${area === a ? styles.areaBtnActive : ''}`}
              aria-pressed={area === a}
              onClick={() => trocarArea(a)}
            >
              {a}
            </button>
          ))}
        </div>

        {emTela.length === 0 ? (
          <p className={styles.emptyState}>
            {busca
              ? `Nada encontrado para "${busca}". Tente outro termo, como "resumo" ou "flashcards".`
              : 'Nenhum produto encontrado com esses filtros. Tente outra combinação.'}
          </p>
        ) : (
          <div className={styles.grid}>
            {emTela.map((item) => (
              <article key={item.id} className={styles.card}>
                <Link
                  href={`/vitrine/produto/${item.id}`}
                  className={styles.capaWrap}
                  aria-label={`Ver detalhes de ${item.nome}`}
                  tabIndex={-1}
                >
                  {item.capa ? (
                    <Image
                      src={item.capa.src}
                      alt={`Capa de ${item.nome}`}
                      width={item.capa.width}
                      height={item.capa.height}
                      className={styles.capaImg}
                    />
                  ) : (
                    <span
                      className={`${styles.capaFallback} ${styles[AREA_CAPA_CLASSE[item.area ?? ''] ?? 'capaFallbackFiscal']}`}
                      aria-hidden="true"
                    >
                      {rotuloDeFerramenta(item.ferramenta, item.categoria)}
                    </span>
                  )}
                </Link>
                <div className={styles.cardHeader}>
                  <span className={styles.badge}>{rotuloDeFerramenta(item.ferramenta, item.categoria)}</span>
                  {item.area && <span className={styles.badgeArea}>{item.area}</span>}
                  {/* O SELO DE DESCONTO E O PREÇO SAÍRAM DO CARTÃO EM 07/10/2026,
                      a pedido do Sérgio: "vai deixar mais clean e quando a pessoa
                      entrar ela verá duas ofertas".

                      O motivo é mais do que estética. Desde que a loja vende 12 e
                      24 meses, um preço só no cartão não representa o produto: a
                      vitrine mostraria R$ 697 e a página do produto abriria com o
                      plano de 24 meses marcado, em R$ 1.047. O cartão prometeria
                      um número que a página seguinte não confirma.

                      O percentualOff continua existindo no dado, porque a
                      ordenação da vitrine usa ele para pôr os maiores descontos na
                      frente. Só deixou de ser desenhado. */}
                </div>

                <div className={styles.cardBody}>
                  <h3 className={styles.productTitle}>
                    <Link href={`/vitrine/produto/${item.id}`} className={styles.productTitleLink}>
                      {item.nome}
                    </Link>
                  </h3>
                  {/* o preço agora é dito na página do produto, onde cabem os
                      dois planos lado a lado */}
                </div>

                <div className={styles.cardFooter}>
                  {/* leva à página do produto, não ao checkout: o botão de compra
                      só aparece depois que a pessoa lê o que está levando */}
                  <Link
                    className={styles.btnBuy}
                    href={`/vitrine/produto/${item.id}`}
                    aria-label={`Ver detalhes de ${item.nome}`}
                  >
                    Ver produto →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className={styles.gridActions}>
          {visiveis < filtrados.length && (
            <button
              type="button"
              className={styles.btnShowMore}
              onClick={() => setVisiveis((v) => v + POR_PAGINA)}
            >
              Mostrar mais ({filtrados.length - visiveis} restantes)
            </button>
          )}
          <a className={styles.vitrineLink} href="/vitrine">
            Ver a vitrine completa por área →
          </a>
        </div>
      </div>
    </section>
  );
}
