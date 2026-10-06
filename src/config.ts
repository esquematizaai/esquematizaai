// ===== Links de conversão das páginas de venda =====

// Mentoria: aplicação pelo Typeform (todos os CTAs de /mentoria apontam aqui).
// Substituiu o Typebot no WhatsApp em 27/08, a pedido do Sérgio, junto com o
// lançamento da mentoria para SEFAZ-AL.
/**
 * Formulário de aplicação da mentoria, usado pelos quatro CTAs de /mentoria.
 *
 * Endereço NOSSO, de propósito. Antes apontava direto para o Typeform, e trocar
 * de plataforma obrigava a mexer no site. Agora /anamnese redireciona para a
 * loja, que por sua vez aponta para o formulário do momento: o Sérgio troca a
 * ferramenta no WordPress e nada aqui precisa mudar.
 *
 * Os parâmetros de rastreio de canal viajam inteiros até o formulário. O Next
 * repassa a query no redirecionamento e o WordPress também; a cadeia foi
 * conferida ponta a ponta em 12/09.
 *
 * O nome CHECKOUT_URL ficou herdado de quando isto era um checkout de verdade.
 * Hoje é formulário de aplicação, e não há venda direta nesta página.
 */
export const CHECKOUT_URL = '/anamnese?origem=site&campanha=mentoria';

// CGU (LP de captura): grupo VIP no WhatsApp (todos os CTAs de /cgu apontam aqui).
export const GRUPO_VIP_URL = 'https://chat.whatsapp.com/DfqbvIRKC1UBQKdZL7qrar';

// Site principal (logo / navegação de volta, e endereço canônico no Google).
// NÃO muda na virada do domínio: é justamente este endereço que o site novo
// passa a atender.
export const SITE_URL: string = 'https://esquematizaai.com';

/**
 * ENDEREÇO DA LOJA. É ESTA LINHA QUE MUDA NO DIA DA VIRADA.
 *
 * Hoje a loja em WooCommerce e o site novo dividem o mesmo domínio: os 140
 * produtos cujo botão leva para a página de venda apontam para
 * esquematizaai.com/produto/... Quando o domínio principal passar a ser o site
 * novo, a loja atende em loja.esquematizaai.com, e esses 140 botões precisam
 * acompanhar no mesmo instante.
 *
 * Trocar o valor abaixo para 'https://loja.esquematizaai.com' reaponta todos de
 * uma vez, porque todo link de compra passa por `paraLoja()`. Não existe
 * segundo lugar para lembrar.
 *
 * VIRADA FEITA EM 06/09. A loja passou a atender em loja.esquematizaai.com, com
 * o WordPress reconfigurado, os links internos substituídos e o aviso de
 * pagamento da Pagar.me reapontado. Compra de teste real, no PIX, passou: o
 * pedido entrou e o status virou processando.
 *
 * Para desfazer, se algum dia a loja voltar para o domínio principal: troque de
 * volta para 'https://esquematizaai.com'. Os 140 botões e os redirecionamentos
 * acompanham sozinhos, e as regras se desligam.
 *
 * O `: string` não é enfeite: sem ele o TypeScript trava o valor como literal e
 * passa a dizer que a comparação com SITE_URL nunca é verdadeira, derrubando o
 * build no dia em que alguém trocar a linha.
 */
export const URL_DA_LOJA: string = 'https://loja.esquematizaai.com';

/**
 * Quem processa o pagamento daquele link, pelo endereço dele.
 *
 * ISTO JÁ MENTIU EM PRODUÇÃO DUAS VEZES, e as duas o Sérgio viu antes de mim.
 * Em 18/09 a frase embaixo do botão dizia "Pagamento processado pela Eduzz" num
 * material cobrado pela Tutory. Consertei a frase e deixei passar o selo verde
 * do lado, que dizia a mesma mentira por outro caminho: ele nascia de "tem
 * link de checkout?", e todo checkout era tratado como Eduzz. Em 27/09 ele
 * apontou o selo, no Tecnologia da Informação Esquematizada.
 *
 * Por isso a resposta passou a morar numa função só. Dois lugares decidindo a
 * mesma coisa por conta própria é a razão de um ter sido consertado e o outro
 * não.
 *
 * DEVOLVE null PARA QUEM NÃO RECONHECE, e quem chama escreve uma frase
 * verdadeira e genérica. Nunca o nome de uma empresa por eliminação: o catálogo
 * já teve três destinos de compra e vai ter mais, e afirmar a mais é pior que
 * afirmar de menos quando o assunto é para onde vai o dinheiro.
 */
export function processadorDoCheckout(url: string | null | undefined): string | null {
  if (!url) return null;

  // endereço torto não pode derrubar a página: o campo vem do painel, digitado
  // à mão, e um espaço a mais já quebraria o new URL()
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }

  if (/(^|\.)eduzz\.com$/i.test(host)) return 'Eduzz';
  if (/(^|\.)plataformatutory\.com\.br$/i.test(host)) return 'Tutory';
  return null;
}

/** Reaponta um link da loja para o endereço vigente dela. */
export function paraLoja(link: string): string {
  if (URL_DA_LOJA === SITE_URL) return link;
  return link.replace(/^https?:\/\/(www\.)?esquematizaai\.com/i, URL_DA_LOJA);
}

/**
 * O mesmo, para os links soltos DENTRO de um texto de venda.
 *
 * O texto dos produtos veio do site antigo e trazia links de venda cruzada
 * ("Prefere revisar com flashcards? Conheça o..."). Depois da virada eles ainda
 * funcionariam, porque o redirecionamento os pegaria, mas com um pulo a mais e
 * uma piscada no navegador. Reapontar aqui evitava isso.
 *
 * ESSES LINKS SAÍRAM EM 22/09, a pedido do Sérgio: quem está decidindo comprar
 * era mandado para outra página no meio da decisão. Hoje não sobra nenhum no
 * conteudo-produto.json, então esta função passa direto e fica de pé só para o
 * dia em que o raspador do WordPress rodar de novo e trouxer link outra vez.
 *
 * NÃO É REDE PARA O QUE VEM DO PAINEL. Só o texto importado passa por aqui: a
 * descrição escrita no painel entra por `produto.sobre` e é desenhada crua. Um
 * endereço colado no painel não é reapontado por ninguém.
 *
 * SÓ MEXE EM /produto: link para artigo do blog ou para a home continua no site
 * novo, que é onde esse conteúdo passou a morar.
 */
export function textoParaLoja(texto: string): string {
  if (URL_DA_LOJA === SITE_URL) return texto;
  return texto.replace(
    /https?:\/\/(?:www\.)?esquematizaai\.com(\/produto\/[^\s")\]]*)/gi,
    (_, caminho) => URL_DA_LOJA + caminho,
  );
}

/**
 * Área do aluno, para onde vai o botão do topo.
 *
 * VOLTOU PARA A LOJA EM 05/10/2026, e a volta é o ponto. Durante um tempo o
 * aluno entrava pelo membros.esquematizaai.com; agora a conta, o pedido e o
 * download estão todos no WooCommerce, e é para lá que o Sérgio está migrando
 * quem comprou pela Eduzz e pela Tutory. Duas portas para a mesma coisa é o
 * tipo de confusão que vira e-mail de suporte: o aluno tenta a porta antiga,
 * não encontra o material novo e acha que perdeu o acesso que pagou.
 */
export const AREA_ALUNO_URL = 'https://loja.esquematizaai.com/minha-conta/';

// Suporte do Esquematiza Aí: +55 11 5286-5954.
// Todo botão de WhatsApp do site aponta para cá; trocar aqui muda o site inteiro.
export const WHATSAPP_NUMERO = '551152865954';
export const whatsappUrl = (mensagem: string) =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;

// Pasta de amostras no Google Drive. É para cá que vai o botão "Ver amostras
// grátis" de TODOS os produtos: em vez de servir PDF por produto, manda a pessoa
// para a pasta compartilhada. Trocar este link muda o botão do site inteiro.
export const AMOSTRAS_DRIVE_URL =
  'https://drive.google.com/drive/folders/1zHPjcFj8e86R4681MfL9LbkS-2a34f_O?usp=sharing';

// Pasta pública dos vídeos de depoimento, no Supabase Storage.
// Cada aluno tem dois arquivos com o mesmo nome: <slug>.mp4 e <slug>.jpg.
export const DEPOIMENTOS_VIDEO_BASE =
  'https://xjcasijvuzjtnaxxvunm.supabase.co/storage/v1/object/public/depoimentos';

// Google Analytics 4. Vazio desliga a medição em todo o site.
export const GA_MEDICAO_ID = 'G-ZLPK9R4PZ6';

/**
 * Google Tag Manager da TAOS, a agência de tráfego. Vazio desliga em todo o
 * site, que é o jeito de desligar o pixel do Meta sem depender deles.
 *
 * É o MESMO container que roda na loja.esquematizaai.com, de propósito: assim a
 * visita aqui e a compra lá contam como uma jornada só.
 *
 * Quem publica tag dentro dele é a agência. Na prática isso quer dizer que eles
 * conseguem rodar JavaScript em toda página pública do site, sem passar por
 * aqui. É como o mercado trabalha, e é bom saber o que está sendo dado: por
 * isso o componente deixa o /admin de fora.
 */
export const GTM_CONTAINER_ID = 'GTM-MGPVKJSG';

// VSL padrão (usada em /mentoria pelo componente YouTubeEmbed).
// Reformulada pelo Sérgio em 03/09; a anterior era 'cr-ZiaBDSf8'. Conferi na
// API do YouTube que o vídeo é do canal Esquematiza Aí e que o título é
// "Estudar mais horas é o conselho que mais reprova", o mesmo da headline.
export const YOUTUBE_ID = 'k4MQQSxXX_0';
export const YOUTUBE_START = 0;

/**
 * Redes sociais do rodapé.
 *
 * SÓ APARECE O QUE TEM ENDEREÇO. O Sérgio pediu os quatro ícones, mas o único
 * link que existe hoje é o do Instagram: no site atual o Facebook aponta para
 * um "profile.php" sem identificador, e YouTube e TikTok não aparecem em lugar
 * nenhum. Ícone bonito levando a lugar nenhum é pior que ícone ausente, então
 * quem estiver em branco simplesmente não é desenhado.
 *
 * Para ligar os outros três, basta preencher a string aqui.
 */
/**
 * Redes sociais do rodapé. O ícone só aparece se a URL estiver preenchida,
 * porque ícone que não leva a lugar nenhum é pior que ícone ausente.
 *
 * Os três últimos vieram do Sérgio em 02/09. TIREI OS PARÂMETROS DE RASTREIO
 * que vinham colados nos links (`?si=`, `?_r=1&_t=`, `?mibextid=`): são códigos
 * de compartilhamento gerados pelo app dele naquele momento, não fazem parte do
 * endereço e podem envelhecer. Os endereços sem eles abrem os mesmos perfis.
 */
export const REDES_SOCIAIS = {
  instagram: 'https://www.instagram.com/esquematizaai/',
  youtube: 'https://youtube.com/@esquematizaai',
  tiktok: 'https://www.tiktok.com/@esquematizaai',
  facebook: 'https://www.facebook.com/share/1BaG8f3fsq/',
} as const;
