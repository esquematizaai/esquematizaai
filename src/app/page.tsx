import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import BlogPreview from '@/components/BlogPreview';
import ProvaSocial from '@/components/ProvaSocial';
import SocialTicker from '@/components/SocialTicker';
import StatsTicker from '@/components/StatsTicker';
import FeaturedCourses from '@/components/FeaturedCourses';
import ProductVitrine from '@/components/ProductVitrine';
import Categories from '@/components/Categories';
import AboutUs from '@/components/AboutUs';
import InstagramSection from '@/components/InstagramSection';
import Arsenal from '@/components/Arsenal';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';
// import LeadPopup from '@/components/LeadPopup';  // desligado, veja o fim do arquivo
import { SITE_URL } from '@/config';
import styles from './page.module.css';

/**
 * Mesma razão da vitrine: o que o Sérgio edita no painel precisa aparecer sem
 * depender de deploy. Um minuto, igual às outras páginas do catálogo.
 */
export const revalidate = 60;

/**
 * Só o endereço oficial. Título e descrição continuam vindo do layout raiz,
 * porque a metadata do Next se junta campo a campo: declarar `alternates` aqui
 * não apaga o resto.
 *
 * A home recebe link de campanha o tempo todo, com utm e fbclid colados no fim,
 * e cada um desses vira um endereço diferente aos olhos do Google. Esta linha
 * diz que todos são a mesma página.
 *
 * O canonical NÃO pode morar no layout raiz: lá ele seria herdado por toda
 * página que não declarasse a sua, e cada uma passaria a se apresentar como a
 * home. Por isso é declarado página a página.
 */
export const metadata = {
  alternates: { canonical: SITE_URL },
};

export default function Home() {
  return (
    <main className={styles.home}>
      <Navbar />
      <HeroSection />
      <SocialTicker />
      <FeaturedCourses />
      <BlogPreview />
      {/* um título, dois carrosséis: vídeo em cima, prints embaixo */}
      <ProvaSocial />
      <ProductVitrine />
      <Arsenal />
      <AboutUs />
      <StatsTicker />
      <Categories />
      <InstagramSection />
      <ContactForm />
      <Footer />
      {/* O POP-UP DA NEWSLETTER ESTÁ DESLIGADO, E É PARA VOLTAR.
          Decisão do Pedro em 05/10/2026, enquanto corre a migração dos alunos
          da Eduzz e da Tutory: o aviso da nova área de membros abre em toda
          página, e quem chega à home agora é em boa parte aluno antigo
          procurando o material que já pagou, não visitante para virar lead.

          O LeadPopup já sabe ceder a vez quando o aviso está na tela, então
          tecnicamente os dois conviviam. Isto aqui é escolha de quem manda, e
          não conserto de defeito: pedir e-mail no meio de uma migração é pedir
          na hora errada.

          PARA RELIGAR: tire o comentário desta linha e o do import lá em cima.
          O aviso da área de membros morre sozinho em 31/12/2026, e a partir daí
          a newsletter volta a ser o único pop-up da home.
          <LeadPopup /> */}
    </main>
  );
}
