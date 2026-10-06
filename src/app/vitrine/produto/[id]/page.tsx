import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Conteudo from '@/components/Artigo/Conteudo';
import SelosTicker from '@/components/SelosTicker';
import BarraCompra from '@/components/BarraCompra';
import BotaoCompra from '@/components/BotaoCompra';
import MedicaoDeProduto from '@/components/MedicaoDeProduto';
import FaqProduto from '@/components/FaqProduto';
import AutoridadeCientifica from '@/components/AutoridadeCientifica';
import GaleriaMaterial from '@/components/GaleriaMaterial';
import SumarioDisciplinas from '@/components/SumarioDisciplinas';
import { sumarioDoProduto } from '@/lib/sumario-produto';
import { lerSobreposicaoSumario } from '@/lib/sumarios-painel';
import VideosDepoimentos from '@/components/VideosDepoimentos';
import CarrosselProva from '@/components/CarrosselProva';
import { produtos, produtoPor, ofertaAtual, formatarPreco, capaDe, conteudoDe, selosDe, type Produto } from '@/data/catalogo';
import { produtoAjustado } from '@/lib/catalogo-ajustes';
import { rotuloDeFerramenta, SLUG_DA_AREA } from '@/data/catalogo/rotulos';
import { SITE_URL, URL_DA_LOJA, AMOSTRAS_DRIVE_URL, textoParaLoja, processadorDoCheckout } from '@/config';
import { jsonLdSeguro } from '@/lib/json-ld';
import styles from './styles.module.css';

/**
 * O aviso embaixo do botão de comprar, escolhido pelo endereço de destino.
 *
 * ELE JÁ MENTIU EM PRODUÇÃO. A primeira versão conhecia dois destinos, a loja e
 * a Eduzz, e mandava todo o resto para o texto da Eduzz. Em 18/09 o Sérgio
 * cadastrou pelo painel um material cobrado pela Tutory, e a página passou a
 * dizer "Pagamento processado pela Eduzz" logo abaixo de um botão que ia para
 * outra empresa. Na última tela antes de pagar.
 *
 * Por isso a lista deixou de ser fechada. O catálogo já tem três destinos em
 * uso e vai ter mais: quem não for reconhecido recebe uma frase verdadeira e
 * genérica, nunca o nome de uma empresa por eliminação. Afirmar a mais é pior
 * que afirmar de menos quando o assunto é para onde vai o dinheiro.
 */
function avisoDePagamento(oferta: { checkout: string; viaPaginaDeVendas: boolean }): string {
  if (oferta.viaPaginaDeVendas) return 'A compra é finalizada na página do produto.';
  if (oferta.checkout.startsWith(URL_DA_LOJA)) {
    return 'Você vai para o carrinho da loja, com o material já adicionado.';
  }
  // A MESMA FUNÇÃO QUE DECIDE O SELO VERDE ao lado do botão. Em 27/09 os dois
  // discordavam na mesma tela: esta frase já dizia o genérico para a Tutory e o
  // selo continuava afirmando Eduzz, porque cada um decidia por conta própria.
  const processador = processadorDoCheckout(oferta.checkout);
  if (processador) return `Pagamento processado pela ${processador}.`;
  return 'Você vai para o checkout seguro do material.';
}

// Uma página por produto vendável (mesmo critério da vitrine da home):
// precisa ter par consistente de preço + checkout.
function publicaveis(): Produto[] {
  return produtos.filter((p) => {
    if (p.categoria === 'oferta-personalizada') return false;
    if (p.status === 'inativo') return false;
    return ofertaAtual(p) !== null;
  });
}

export function generateStaticParams() {
  return publicaveis().map((p) => ({ id: p.id }));
}

/**
 * As páginas continuam sendo geradas na build, mas se refazem sozinhas a cada
 * minuto. É o que faz o sumário editado no painel aparecer sem deploy, do mesmo
 * jeito que já acontece com preço e destaque na vitrine.
 */
export const revalidate = 60;

/**
 * Tira a marcação do Markdown para o texto que vai para a aba e para o Google.
 *
 * Não renderiza nada: só limpa. Título, negrito, link, item de lista e as
 * caixas :::  viram texto corrido, porque o Google mostra isso como frase e
 * asterisco no meio de uma frase parece erro de digitação da loja.
 */
function semMarcacao(texto: string): string {
  return texto
    // caixas coloridas: :::importante, :::dica[DICA DE PROVA]
    .replace(/:::[a-zA-Z]*(\[[^\]]*\])?/g, ' ')
    // títulos: ## COMBO RESUMOS
    .replace(/^#{1,6}\s+/gm, '')
    // marcador de item: "- este combo contém"
    .replace(/^\s*[-*+]\s+/gm, '')
    // link vira só o texto dele
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // negrito, itálico e code
    .replace(/(\*\*|__|\*|_|`)/g, '')
    // o "1\." que existe só para o Markdown não numerar sozinho
    .replace(/\\([.\-])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  /**
   * Procura na planilha E no painel, igual à página faz.
   *
   * Procurava só na planilha, e o material cadastrado pelo painel saía com
   * <title>Produto não encontrado</title> numa página que renderizava certinho,
   * com nome, preço e botão de comprar. Quem passasse o mouse na aba lia
   * "não encontrado", e era isso que o Google indexava.
   *
   * Apareceu em 19/09 no primeiro material que o Sérgio cadastrou sozinho, o
   * Flashcards Reta Final SEFAZ-AL, que estava assim em produção.
   */
  const ajuste = await produtoAjustado(id);
  const produto = produtoPor(id) ?? ajuste?.produto ?? null;
  if (!produto) return { title: 'Produto não encontrado' };
  /**
   * O resumo da aba e do Google, sem a marcação do Markdown.
   *
   * O Sérgio viu "## COMBO RESUMOS" e "**37 (trinta e sete)**" saindo no
   * JSON-LD com asterisco e cerquilha. O corte em 155 caracteres só apertava
   * o espaço, então metade do que sobrava era pontuação de formatação.
   */
  const fonteDaDescricao = ajuste?.descricaoDoPainel ?? produto.sobre;
  const descricao = fonteDaDescricao
    ? semMarcacao(fonteDaDescricao).slice(0, 155)
    : `${produto.nome}: material do Esquematiza Aí para concursos públicos.`;
  return {
    title: `${produto.nome} | Esquematiza Aí`,
    description: descricao,
    /**
     * Endereço oficial desta página, declarado.
     *
     * O texto de venda daqui foi raspado da página do produto na loja em
     * WordPress, então o mesmo parágrafo existe nos dois domínios. A página da
     * loja declara canonical apontando para ela mesma, pelo Yoast; esta não
     * declarava nada. Numa disputa entre uma página que se diz original e outra
     * calada, o Google fica com a que fala, e a calada some do índice.
     *
     * Foi o que o Search Console avisou em 16/09: "cópia sem página canônica
     * selecionada pelo usuário", que em português claro é "você não disse qual
     * vale, então eu escolhi".
     *
     * APONTA PARA SI MESMA, e não para a loja, de propósito. O canonical entre
     * domínios só é respeitado quando as duas páginas são quase equivalentes, e
     * aqui a sobreposição medida foi de 48%: preço, botão e selos são nossos.
     * Um canonical cruzado seria ignorado e voltaríamos ao silêncio. Decidir de
     * quem é o texto de venda é outra conversa, e é do Sérgio.
     */
    alternates: { canonical: `${SITE_URL}/vitrine/produto/${produto.id}` },
  };
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // passa pela camada de ajustes: preço editado no painel vale mais que o da
  // planilha, e produto marcado como oculto responde 404 como se não existisse
  const ajustado = await produtoAjustado(id);
  if (!ajustado) notFound();

  const { produto, oferta, capaDoPainel, descricaoDoPainel } = ajustado;

  const areaSlug = produto.area ? SLUG_DA_AREA[produto.area] : null;
  const linkArea = areaSlug ? `/vitrine/${areaSlug}` : '/vitrine';
  // a do painel vem do Supabase; as da planilha continuam no capas.json
  const capa = capaDoPainel ?? capaDe(produto);
  /**
   * O que este produto entrega, para a galeria mostrar o formato certo.
   *
   * A regra antiga era `ferramenta === 'Flashcards' || nome começa com
   * "Flashcards"`, e errava em 6 produtos: a "Assinatura Flashcards Regular"
   * tem ferramenta "Assinatura" e o nome não COMEÇA com Flashcards, então caía
   * no conjunto de resumos. Foi o erro que o Sérgio viu.
   *
   * Os combos ("R + F + Q + V") entregam os dois formatos e agora mostram os
   * dois: antes escolhiam um só.
   */
  /**
   * O NOME VENCE A FERRAMENTA quando ele nomeia o formato.
   *
   * Na planilha de 27/08 a "Assinatura Resumos Regular" veio com ferramenta
   * "R + F + Q + V", um rótulo genérico que a marca como combo dos dois
   * formatos. A página passou a anunciar 109 disciplinas, resumos e flashcards
   * juntos, numa assinatura que só dá resumos. Anunciar o que o produto não
   * entrega é o pior erro que uma página de venda pode ter.
   *
   * Quando o nome não diz nada sobre formato, aí sim vale a ferramenta.
   */
  const nomeDizFlashcards = /flashcard/i.test(produto.nome);
  const nomeDizResumos = /resumo|vade\s*mecum/i.test(produto.nome);

  let temFlashcards: boolean;
  let temResumos: boolean;

  if (nomeDizFlashcards || nomeDizResumos) {
    temFlashcards = nomeDizFlashcards;
    temResumos = nomeDizResumos;
  } else {
    const ferramenta = produto.ferramenta ?? '';
    const ehCombo = /R \+ F/i.test(ferramenta);
    temFlashcards = ehCombo || /flashcard/i.test(ferramenta);
    temResumos = ehCombo || /resumo|vade\s*mecum/i.test(ferramenta);
  }

  // AutoridadeCientifica argumenta por recuperação e espaçamento, que é o
  // mecanismo do flashcard; num combo isso continua valendo.
  const ehFlashcards = temFlashcards;

  // o que o Sérgio editou no painel entra por cima do que veio da planilha
  const sobreposicao = await lerSobreposicaoSumario();
  const disciplinasDoSumario = sumarioDoProduto(produto, temResumos, temFlashcards, sobreposicao);
  // O texto de venda veio do site antigo e citava outros produtos por link, o
  // que tirava daqui quem estava decidindo comprar. Esses links saíram em 22/09.
  // textoParaLoja continua no caminho para o dia em que o raspador rodar de novo:
  // ele só alcança ESTE texto, o importado. A descrição escrita no painel chega
  // por produto.sobre, mais abaixo, e não passa por ele.
  const conteudoBruto = conteudoDe(produto);
  const conteudo = {
    ...conteudoBruto,
    sobre: conteudoBruto.sobre ? textoParaLoja(conteudoBruto.sobre) : conteudoBruto.sobre,
    detalhes: conteudoBruto.detalhes ? textoParaLoja(conteudoBruto.detalhes) : conteudoBruto.detalhes,
  };
  const sobre = conteudo.sobre ?? null;
  const selos = selosDe(produto);

  /**
   * O produto do jeito que a medição da TAOS espera.
   *
   * Um objeto só, usado pelo view_item e pelos dois botões de compra, para o
   * Meta não receber nome ou preço diferentes do mesmo produto dependendo de
   * onde a pessoa clicou. O preço é o à vista, o mesmo que está escrito no
   * botão: é o valor que a pessoa viu, e é ele que a agência compara com a
   * venda que chega da Eduzz.
   */
  const itemMedido = { id: produto.id, nome: produto.nome, preco: oferta.preco };

  const cardCompra = (
    <div className={styles.buyCard} id="card-compra">
      {capa && (
        <Image
          src={capa.src}
          alt={`Capa de ${produto.nome}`}
          width={capa.width}
          height={capa.height}
          priority
          className={styles.buyCapa}
        />
      )}
      {oferta.percentualOff !== null && (
        <span className={styles.offPill}>-{oferta.percentualOff}% de desconto</span>
      )}
      {/* A linha de parcelamento acompanha o preço riscado, e os dois só
          aparecem em produto com preço de referência confirmado pelo Sérgio.
          Sem referência, fica o preço sozinho, como sempre foi. */}
      <div className={styles.priceBlock}>
        {oferta.precoAntigo !== null && (
          <span className={styles.oldPrice}>{formatarPreco(oferta.precoAntigo)}</span>
        )}
        <span className={styles.currentPrice}>{formatarPreco(oferta.preco)}</span>
        {oferta.precoAntigo !== null && (
          <span className={styles.parcelamento}>
            <strong>12x de {formatarPreco(oferta.parcela12x)}</strong> ou{' '}
            {formatarPreco(oferta.preco)} à vista
          </span>
        )}
      </div>
      <BotaoCompra
        className={styles.btnBuy}
        href={oferta.checkout}
        item={itemMedido}
        aria-label={`${oferta.viaPaginaDeVendas ? 'Ver na loja' : 'Comprar'} ${produto.nome} por ${formatarPreco(oferta.preco)}`}
      >
        {oferta.viaPaginaDeVendas ? 'Ver na loja →' : 'Comprar agora →'}
      </BotaoCompra>

      {/* Amostras: aparece em TODO produto e leva à pasta compartilhada no Drive,
          em vez de servir um PDF por produto. A segunda linha avisa que abre no
          Drive e que a pasta é geral, senão a pessoa clica esperando a amostra
          deste produto específico e se perde no meio dos arquivos. */}
      <a
        className={styles.btnAmostra}
        href={AMOSTRAS_DRIVE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Ver amostras grátis
        <span className={styles.amostraPeso}>abre a pasta no Google Drive</span>
      </a>

      {/* Diz para onde o botão leva, sem prometer o que não vai acontecer. */}
      <p className={styles.buyNote}>{avisoDePagamento(oferta)}</p>

      {/* Aviso dos termos, pedido pelo Sérgio em 15/09 para ficar igual ao que
          o checkout da Eduzz já mostra embaixo do botão. Aqui é a última tela
          nossa antes de a pessoa sair para pagar, então é aqui que o aviso
          precisa aparecer. O link abre na mesma aba de propósito: quem clicar
          está lendo, não comprando, e volta pelo botão do navegador. */}
      <p className={styles.termosNote}>
        Ao concluir a compra, você declara ter lido e concorda com os{' '}
        <Link href="/termos-de-uso">Termos de Uso</Link>.
      </p>

      {/* letreiro com o que está incluído; os selos saem do texto do próprio
          produto, então nenhum deles promete algo que aquele item não tem */}
      <SelosTicker selos={selos} />
    </div>
  );

  // Product + FAQPage para o Google: o primeiro dá direito ao selo de preço e
  // disponibilidade na busca, o segundo faz as dúvidas aparecerem expandidas
  // no resultado. Tudo já está na tela; aqui só está em formato de máquina.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: produto.nome,
      // limpa a marcação igual a descrição da aba faz, e pelo mesmo motivo: o
      // Google lê isto, e "## COMBO" com "**37 (trinta e sete)**" sai no
      // resultado da busca com cerquilha e asterisco. Era só o espaço em branco
      // que estava sendo arrumado aqui, e o Sérgio viu o resto passar.
      description: semMarcacao(produto.sobre ?? '').slice(0, 500) || undefined,
      category: produto.area ?? undefined,
      ...(capa ? { image: `${SITE_URL}${capa.src}` } : {}),
      brand: { '@type': 'Brand', name: 'Esquematiza Aí' },
      offers: {
        '@type': 'Offer',
        price: oferta.preco,
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/vitrine/produto/${produto.id}`,
      },
    },
    ...(conteudo.faq?.length
      ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: conteudo.faq.map((q) => ({
            '@type': 'Question',
            name: q.pergunta,
            acceptedAnswer: {
              '@type': 'Answer',
              text: semMarcacao(q.resposta),
            },
          })),
        }]
      : []),
  ];

  return (
    <main className={styles.main}>
      <Navbar />
      {/* A BARRA DE CUPOM SAIU DAQUI EM 23/09, a pedido do Sérgio, e o motivo
          dele é bom: o botão "QUERO MEU DESCONTO" leva para a vitrine. Numa
          página de área ou na home isso é ajuda, mas na página do produto é a
          única tela em que a pessoa já escolheu o que quer, e o botão a mandava
          de volta para escolher de novo. "Ele sai da página e pode acabar se
          perdendo", nas palavras dele, com ADS começando a rodar para cá.

          Ela continua na home, na vitrine e na página de área: lá a pessoa
          ainda está procurando, e o cupom empurra para a escolha em vez de
          atrapalhar uma decisão já tomada. */}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(jsonLd) }}
      />

      <div className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="Você está em">
          <Link href="/">Início</Link>
          <span aria-hidden="true">/</span>
          <Link href="/vitrine">Vitrine</Link>
          {produto.area && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={linkArea}>{produto.area}</Link>
            </>
          )}
        </nav>

        <header className={styles.header}>
          <div className={styles.badges}>
            <span className={styles.badge}>{rotuloDeFerramenta(produto.ferramenta, produto.categoria)}</span>
            {produto.area && <span className={styles.badgeArea}>Área {produto.area}</span>}
            {produto.formato && <span className={styles.badgeFormato}>{produto.formato}</span>}
          </div>
          <h1 className={styles.title}>{produto.nome}</h1>
          {produto.observacao && <p className={styles.observacao}>{produto.observacao}</p>}
        </header>

        <div className={styles.layout}>
          <article className={styles.content}>
            {/* Prefere a descrição rica da página de vendas (listas, destaques
                e caixas) e cai no parágrafo corrido da planilha se faltar. */}
            {(sobre || produto.sobre) && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  Sobre o <span className={styles.sectionAccent}>material</span>
                </h2>
                {/* Os dois passam pelo mesmo renderizador de Markdown.
                    A descrição escrita no painel caía num <div> de texto cru,
                    então negrito, lista e título apareciam com os sinais à
                    mostra. O Sérgio perguntou em 19/09 se aceitava HTML para
                    conseguir destaque; HTML continua não passando, de
                    propósito, mas agora ele tem negrito, lista, título e as
                    caixas coloridas que já existem no blog.

                    HTML cru continua saindo escapado, porque rehype-raw segue
                    desligado. É o que impede texto do painel virar script na
                    página. */}
                {/* A DESCRIÇÃO DO PAINEL GANHA DE TUDO, desde 06/10.

                    Antes o texto raspado do WordPress vencia, e o Sérgio
                    reescrevia a descrição no painel sem nada mudar na página:
                    ela só ia parar no JSON-LD. Os dois combos fiscais ficaram
                    anunciando 33 resumos e 3.405 páginas depois de ele já ter
                    corrigido para 37 e 4.281. Quem escreve por último é quem
                    sabe o que o material tem hoje. */}
                <Conteudo markdown={descricaoDoPainel ?? sobre ?? produto.sobre ?? ''} />
              </section>
            )}

            {/* Detalhes: os módulos, com o que já está liberado e o que vem depois */}
            {(conteudo.detalhes || produto.disciplinas) && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  Detalhes do <span className={styles.sectionAccent}>produto</span>
                </h2>
                {conteudo.detalhesTitulo && (
                  <p className={styles.detalhesEtiqueta}>{conteudo.detalhesTitulo}</p>
                )}
                {conteudo.detalhes ? (
                  <Conteudo markdown={conteudo.detalhes} />
                ) : (
                  <div className={styles.longText}>{produto.disciplinas}</div>
                )}
              </section>
            )}

            {/* Sanfona por disciplina. Vem da aba de sumários da planilha, não
                do texto raspado, e por isso funciona em assinatura e combo, onde
                o campo `disciplinas` do produto vem vazio. Era justamente essa
                falta que o Sérgio apontou. */}
            <SumarioDisciplinas disciplinas={disciplinasDoSumario} />

            {/* o sumário em texto corrido só entra quando a sanfona não achou
                a disciplina na planilha, para o produto não ficar sem nenhum */}
            {disciplinasDoSumario.length === 0 && conteudo.sumario && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  Sumário <span className={styles.sectionAccent}>completo</span>
                </h2>
                <Conteudo markdown={conteudo.sumario} />
              </section>
            )}

            {/* Cronograma: alguns materiais vão à venda antes de ficarem
                prontos, e quem compra precisa saber disso ANTES de pagar */}
            {conteudo.cronograma && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  Cronograma de <span className={styles.sectionAccent}>entrega</span>
                </h2>
                <Conteudo markdown={conteudo.cronograma} />
              </section>
            )}

            <GaleriaMaterial
              temResumos={temResumos || (!temResumos && !temFlashcards)}
              temFlashcards={temFlashcards}
            />

            {/* Depois da galeria e antes do argumento científico: a pessoa acabou
                de ver o material por dentro, e a pergunta que vem é "isso
                funcionou para alguém?".

                Os três tipos de prova ficam juntos, como o Sérgio pediu: quem
                falou em vídeo, quem foi aprovado e quem escreveu no WhatsApp.
                O vídeo abre porque é a prova mais difícil de forjar, e é a
                mesma ordem da home, montada pelos mesmos componentes. */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                O que dizem nossos <span className={styles.sectionAccent}>alunos</span>
              </h2>

              <p className={styles.rotuloProva}>Em vídeo</p>
              <VideosDepoimentos />

              <p className={styles.rotuloProva}>Aprovados e mensagens que recebemos</p>
              <CarrosselProva />
            </section>

            {/* o argumento muda por material: para flashcard a evidência de
                recuperação e espaçamento é direta; para resumo ela é de outra
                natureza, e usar a do flashcard esticaria o que a pesquisa diz */}
            <AutoridadeCientifica ehFlashcards={ehFlashcards} />

            {conteudo.faq && conteudo.faq.length > 0 && (
              <FaqProduto perguntas={conteudo.faq} nomeDoProduto={produto.nome} />
            )}

            {!sobre && !produto.sobre && !conteudo.detalhes && !produto.disciplinas && (
              <section className={styles.section}>
                <p className={styles.longText}>
                  A descrição completa deste material está sendo preparada. Qualquer dúvida,
                  fale com a gente pelo WhatsApp antes de comprar.
                </p>
              </section>
            )}
          </article>

          <aside className={styles.sidebar}>{cardCompra}</aside>
        </div>

        <div className={styles.backRow}>
          <Link href={linkArea} className={styles.backLink}>
            ← Ver mais materiais {produto.area ? `da área ${produto.area}` : 'na vitrine'}
          </Link>
        </div>
      </div>

      {/* aparece só quando o card de compra sai de vista */}
      <BarraCompra
        alvoId="card-compra"
        preco={formatarPreco(oferta.preco)}
        precoAntigo={oferta.precoAntigo !== null ? formatarPreco(oferta.precoAntigo) : null}
        rotulo={oferta.viaPaginaDeVendas ? 'Ver na loja →' : 'Comprar agora →'}
        href={oferta.checkout}
        item={itemMedido}
        externo
      />

      {/* avisa o GTM que alguém está vendo este produto. Não desenha nada. */}
      <MedicaoDeProduto item={itemMedido} />

      <Footer />
    </main>
  );
}
