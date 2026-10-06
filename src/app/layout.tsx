import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import WhatsAppButton from "@/components/WhatsAppButton";
import Analytics from "@/components/Analytics";
import TagManager from "@/components/TagManager";
import { SITE_URL } from "@/config";

const DESCRICAO =
  'Resumos e flashcards para concursos públicos, feitos a partir do histórico de cobrança das bancas. Áreas fiscal, controle, policial, tribunais e legislativa.';

/**
 * Título único do site, pedido pelo Sérgio em 15/09 junto com a troca do
 * cartão de compartilhamento. Antes eram dois: "Plataforma de Educação Online"
 * na aba do navegador e no Google, e outro no cartão do WhatsApp. Este diz o
 * que a empresa vende e vale nos dois lugares.
 */
const TITULO = 'Esquematiza Aí | Mentoria, Resumos e Flashcards para concursos públicos';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITULO,
  // "Jornal do Marco" saiu daqui junto com o do rodapé, a pedido do Sérgio.
  // Esta descrição é a que aparece no Google e ao compartilhar o link, então
  // ganhou uma frase que diz o que o site vende.
  description: DESCRICAO,

  /**
   * Cartão de compartilhamento.
   *
   * Sem isto o site não tinha nenhuma tag og: o link colado no WhatsApp virava
   * um retângulo cinza, sem imagem, sem título e sem descrição. As páginas de
   * post já montavam o cartão delas; era a home e todo o resto que ficava sem.
   *
   * A imagem não é declarada aqui de propósito: o arquivo opengraph-image.png
   * ao lado deste layout é a convenção do Next, e ele emite sozinho o endereço,
   * o tipo e as dimensões. Declarar à mão sairia sem width e height, que é o
   * que faz o WhatsApp decidir entre miniatura grande e ícone pequeno.
   *
   * Quem define openGraph próprio (o post do blog, por exemplo) continua
   * mandando na sua página: isto aqui é o padrão de quem não define.
   */
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Esquematiza Aí',
    title: TITULO,
    description: DESCRICAO,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRICAO,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <WhatsAppButton />
        <Analytics />
        {/* O GTM vem depois do Analytics de propósito: os dois escrevem no
            mesmo window.dataLayer, e o gtag precisa tê-lo criado antes. Na
            prática qualquer ordem funciona, porque os dois criam o array se
            não existir, mas ler o arquivo nesta ordem conta a história certa:
            a medição nossa primeiro, a da agência em cima. */}
        <TagManager />
        {/* Aviso da nova área de membros, escrito pelo Sérgio, com prazo para
            morrer sozinho em 31/12/2026. O arquivo em public/js explica por que
            ele mora solto ali e por que não foi publicado pelo GTM. Vem por
            último porque mede pelo dataLayer, que os dois acima já criaram. */}
        <Script src="/js/aviso-area-de-membros.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
