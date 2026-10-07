import Image from 'next/image';
import Link from 'next/link';
import styles from './styles.module.css';
import { capaDe, type Produto, type Oferta } from '@/data/catalogo';
import { ajustadosPorId } from '@/lib/catalogo-ajustes';
import { rotuloDeFerramenta } from '@/data/catalogo/rotulos';

// As assinaturas em destaque. Se uma perder preço ou destino de compra no
// catálogo, ela sai da seção sozinha.
const ASSINATURA_IDS = [
  'assinatura-flashcards-regular',
  'assinatura-resumos-regular',
  'assinatura-resumos-regular-flashcards-regular',
  'assinatura-legislacao-tributaria',
];

// A única que contém as outras duas: recebe o card em evidência.
const ID_EM_EVIDENCIA = 'assinatura-resumos-regular-flashcards-regular';

type Plano = { produto: Produto; oferta: Oferta };

export default async function FeaturedCourses() {
  /**
   * PELO PAINEL, não pela planilha.
   *
   * Era daqui que saía o preço divergente que o Sérgio viu em 17/09: a mesma
   * Assinatura Resumos Regular aparecia a R$ 897 na vitrine, que lê o painel, e
   * a R$ 797 neste bloco, que lia a planilha. O barato era o errado.
   *
   * De quebra, quem o Sérgio esconde no painel some daqui sozinho, em vez de
   * continuar em destaque na home depois de tirado de venda.
   */
  const ajustados = await ajustadosPorId(ASSINATURA_IDS);
  const planos: Plano[] = ASSINATURA_IDS.flatMap((id) => {
    const ajustado = ajustados.get(id);
    return ajustado ? [{ produto: ajustado.produto, oferta: ajustado.oferta }] : [];
  });

  if (planos.length === 0) return null;

  return (
    // id="assinaturas" é o alvo do link "Assinaturas" da navbar (/#assinaturas)
    <section className={styles.coursesSection} id="assinaturas">
      <h2 className={styles.title}>
        Mais <span className={styles.titleAccent}>procurados</span>
      </h2>
      <p className={styles.subtitle}>
        Acesso ao acervo de resumos e flashcards por um período, em vez de comprar material por
        material. Compra direta no checkout da Eduzz.
      </p>

      <div className={styles.grid}>
        {planos.map(({ produto }) => {
          const emEvidencia = produto.id === ID_EM_EVIDENCIA;
          const capa = capaDe(produto);

          return (
            <article
              key={produto.id}
              className={`${styles.card} ${emEvidencia ? styles.cardDestaque : ''}`}
            >
              {/* mesmo molde do catálogo: capa 3/4, etiquetas, título, preço e botão */}
              <Link
                href={`/vitrine/produto/${produto.id}`}
                className={styles.capaWrap}
                aria-label={`Ver detalhes de ${produto.nome}`}
                tabIndex={-1}
              >
                {capa && (
                  <Image
                    src={capa.src}
                    alt={`Capa de ${produto.nome}`}
                    width={capa.width}
                    height={capa.height}
                    className={styles.capaImg}
                  />
                )}
              </Link>

              <div className={styles.cardHeader}>
                <span className={styles.badge}>
                  {rotuloDeFerramenta(produto.ferramenta, produto.categoria)}
                </span>
                {produto.area && <span className={styles.badgeArea}>{produto.area}</span>}
                {/* PREÇO FORA DO CARTÃO desde 07/10/2026, a pedido do Sérgio: "a ideia
                      é a pessoa clicar e saber o preço lá dentro (vão ter 2 preços)".
                      Com a loja vendendo 12 e 24 meses, um número só aqui contradiz
                      a página do produto, que abre com o plano de 24 marcado. */}
              </div>

              <div className={styles.cardBody}>
                <h3 className={styles.courseTitle}>
                  <Link href={`/vitrine/produto/${produto.id}`} className={styles.courseTitleLink}>
                    {produto.nome}
                  </Link>
                </h3>

                {emEvidencia && (
                  <span className={styles.selo}>Resumos e flashcards no mesmo plano</span>
                )}


              </div>

              {/* leva à página do plano, não ao checkout: assinatura é compra
                  cara, e ninguém assina sem ler o que está incluído */}
              <Link
                className={styles.btnEnroll}
                href={`/vitrine/produto/${produto.id}`}
                aria-label={`Ver detalhes de ${produto.nome}`}
              >
                Ver assinatura →
              </Link>
            </article>
          );
        })}
      </div>

      <a className={styles.verTodas} href="#vitrine">
        Ver também os combos e materiais avulsos →
      </a>
    </section>
  );
}
