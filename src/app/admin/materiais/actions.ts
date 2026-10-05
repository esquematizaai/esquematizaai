'use server';

import { revalidatePath } from 'next/cache';
import { criarSupabaseServer } from '@/lib/supabase/server';
import { exigirAdmin } from '@/lib/supabase/admin-guard';
import { enviarImagem } from '@/lib/supabase/enviar-imagem';
import { produtos } from '@/data/catalogo';
import { comparavel } from '@/lib/produtos-do-painel';
import { lerScript } from './script-ler';

export type ResultadoAjuste = { ok: boolean; erro?: string };

/**
 * Ajustes de produto feitos no painel.
 *
 * O catálogo continua vindo da planilha do Sérgio. Aqui grava-se SÓ o que for
 * alterado, na tabela produtos_ajustes. Se os dois fossem fonte de verdade,
 * reimportar a planilha apagaria em silêncio o que foi editado no painel.
 */

function revalidarLoja() {
  revalidatePath('/');
  revalidatePath('/vitrine');
  revalidatePath('/admin/materiais');
}

/**
 * Só endereço do nosso armazenamento, ou da loja, vira capa.
 *
 * NÃO É PRECIOSISMO: o next/image LANÇA para host fora da lista do
 * next.config, e a capa é desenhada em componente de servidor na home, na
 * página de área e na do produto. Capa de host estranho derrubaria a home da
 * loja, não só aquele produto.
 *
 * O botão de enviar já devolve o endereço certo. Isto existe para o caso de
 * alguém montar a requisição por fora do painel.
 */
function capaDeHostPermitido(url: string): boolean {
  const permitidos = [
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`,
    'https://loja.esquematizaai.com/wp-content/uploads/',
  ];
  return permitidos.some((p) => url.startsWith(p));
}

/**
 * Recusa link de compra que já pertence a outro produto.
 *
 * ISTO É O CONTRÁRIO DE PRECIOSISMO. O `somenteOsQueFaltam()` identifica
 * produto pelo checkout e pela página de vendas, de propósito: é assim que um
 * material cadastrado aqui some sozinho quando a planilha finalmente o alcança.
 * O efeito colateral é que checkout repetido faz o produto novo DESAPARECER da
 * vitrine sem erro nenhum, sem aviso e sem ninguém descobrir.
 *
 * A documentação do criarMaterial dizia que essa conferência existia. Não
 * existia: conferi o código em 19/09, depois que o Sérgio cadastrou o primeiro
 * material de verdade pelo painel.
 *
 * Confere contra os 197 da planilha INCLUSIVE os ocultos e inativos, porque
 * produto fora do ar continua ocupando o link dele, e contra os já criados no
 * painel. `ignorarId` existe para a edição não brigar com o próprio cadastro.
 */
async function conflitoDeLink(
  checkout: string | null,
  urlSite: string | null,
  ignorarId?: string,
): Promise<string | null> {
  const meus = [checkout, urlSite].filter((v): v is string => Boolean(v)).map(comparavel);
  if (meus.length === 0) return null;

  for (const p of produtos) {
    if (p.id === ignorarId) continue;
    const dele = [p.checkouts?.normal, p.checkouts?.black, p.urlSite]
      .filter((v): v is string => Boolean(v))
      .map(comparavel);
    if (dele.some((d) => meus.includes(d))) {
      return `Esse link já é de "${p.nome}", que vem da planilha. Dois produtos com o mesmo link fazem o novo sumir da vitrine sem aviso.`;
    }
  }

  const supabase = await criarSupabaseServer();
  const { data } = await supabase.from('produtos_novos').select('id, nome, checkout, url_site');
  for (const p of data ?? []) {
    if (p.id === ignorarId) continue;
    const dele = [p.checkout, p.url_site]
      .filter((v): v is string => Boolean(v))
      .map(comparavel);
    if (dele.some((d) => meus.includes(d))) {
      return `Esse link já é de "${p.nome}", que você cadastrou aqui no painel.`;
    }
  }

  return null;
}

export async function salvarAjuste(formData: FormData): Promise<ResultadoAjuste> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const supabase = await criarSupabaseServer();

  const produto_id = String(formData.get('produto_id') ?? '').trim();
  if (!produto_id) return { ok: false, erro: 'Produto não identificado.' };

  const precoTexto = String(formData.get('preco') ?? '').trim().replace(',', '.');
  const preco = precoTexto ? Number(precoTexto) : null;
  if (precoTexto && (Number.isNaN(preco) || preco! <= 0)) {
    return { ok: false, erro: 'Preço inválido. Use apenas números, por exemplo 597 ou 597,00.' };
  }

  /**
   * O preço riscado ao lado do cobrado.
   *
   * Até 05/10 isto só existia numa lista escrita no código, e o Sérgio topou
   * com a falta dela depois de mudar um preço sozinho pelo painel: achou o
   * campo do preço e não achou onde riscar o valor antigo.
   *
   * RECUSA VALOR MENOR OU IGUAL AO COBRADO. Riscar R$ 500 e cobrar R$ 600 não
   * é desconto, é erro de digitação na cara do cliente. E valor pelo qual o
   * material nunca foi vendido é propaganda enganosa, mas isso só quem sabe é
   * quem digita.
   */
  const deTexto = String(formData.get('preco_de') ?? '').trim().replace(/\./g, '').replace(',', '.');
  const precoDe = deTexto ? Number(deTexto) : null;
  if (deTexto && (Number.isNaN(precoDe) || precoDe! <= 0)) {
    return { ok: false, erro: 'Preço "de" inválido. Use apenas números, por exemplo 997.' };
  }
  if (precoDe !== null && preco !== null && precoDe <= preco) {
    return {
      ok: false,
      erro: 'O preço "de" precisa ser MAIOR que o preço de venda, senão o desconto vira piada.',
    };
  }

  const descricao = String(formData.get('descricao') ?? '').trim() || null;
  const observacao = String(formData.get('observacao') ?? '').trim() || null;
  const oculto = String(formData.get('oculto') ?? '') === 'on';
  const destaque = String(formData.get('destaque') ?? '') === 'on';

  /**
   * Posição na vitrine. Vazio é o normal e devolve o produto para a ordenação
   * automática; só os poucos que precisam abrir a lista recebem número.
   *
   * Recusa texto e número negativo em vez de gravar zero calado: o Sérgio vai
   * digitar isso no meio de uma lista de 173 produtos, e um valor engolido em
   * silêncio faria a vitrine ignorar a escolha dele sem dizer por quê.
   */
  const ordemBruta = String(formData.get('ordem') ?? '').trim();
  let ordem: number | null = null;
  if (ordemBruta) {
    const n = Number(ordemBruta);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, erro: 'Posição inválida. Use um número inteiro a partir de 1, ou deixe vazio.' };
    }
    ordem = n;
  }

  /**
   * Para onde o botão de comprar manda.
   *
   * O site é vitrine: não cobra, não entrega, só redireciona. Trocar este link
   * é a única coisa que muda a venda de um produto, e era a única que o Sérgio
   * não conseguia fazer sozinho. Ele usa plataformas diferentes em produtos
   * diferentes, e trocar uma dependia de mexer no repositório e esperar deploy.
   *
   * Vazio APAGA o ajuste e devolve o produto ao link da planilha, em vez de
   * gravar string vazia. Botão apontando para lugar nenhum é pior que botão
   * apontando para o link antigo.
   */
  const checkoutBruto = String(formData.get('checkout') ?? '').trim();
  let checkout: string | null = null;
  if (checkoutBruto) {
    checkout = /^https?:\/\//i.test(checkoutBruto) ? checkoutBruto : `https://${checkoutBruto}`;
    try {
      const u = new URL(checkout);
      if (!u.hostname.includes('.')) throw new Error('sem domínio');
    } catch {
      return { ok: false, erro: `"${checkoutBruto}" não parece um link de compra válido.` };
    }

    const conflito = await conflitoDeLink(checkout, null, produto_id);
    if (conflito) return { ok: false, erro: conflito };
  }

  const { error } = await supabase.from('produtos_ajustes').upsert(
    {
      produto_id,
      preco,
      preco_de: precoDe,
      descricao,
      observacao,
      oculto,
      destaque,
      ordem,
      checkout,
      atualizado_por: permissao.email,
    },
    { onConflict: 'produto_id' },
  );

  if (error) return { ok: false, erro: error.message };

  revalidarLoja();
  return { ok: true };
}

/** Devolve o produto ao que a planilha diz, apagando o ajuste inteiro. */
export async function limparAjuste(produto_id: string): Promise<ResultadoAjuste> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const supabase = await criarSupabaseServer();
  const { error } = await supabase.from('produtos_ajustes').delete().eq('produto_id', produto_id);
  if (error) return { ok: false, erro: error.message };
  revalidarLoja();
  return { ok: true };
}

/**
 * Cria um material que ainda não existe na planilha.
 *
 * Hoje produto novo depende de mandar a planilha e rodar a importação, e nesta
 * semana isso deixou material lançado dias fora do ar. Aqui o Sérgio cadastra e
 * a vitrine pega em até um minuto.
 *
 * A PLANILHA GANHA QUANDO ALCANÇAR: quando o mesmo produto vier nela, casado
 * pelo checkout ou pela página de vendas, o daqui sai da vitrine sozinho. Por
 * isso a validação abaixo recusa checkout ou página que já pertençam a alguém.
 */
export async function criarMaterial(formData: FormData): Promise<ResultadoAjuste> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const nome = String(formData.get('nome') ?? '').trim();
  if (!nome) return { ok: false, erro: 'Escreva o nome do material.' };

  const categoria = String(formData.get('categoria') ?? '').trim();
  if (!['assinatura', 'combo', 'isolado'].includes(categoria)) {
    return { ok: false, erro: 'Escolha se é assinatura, combo ou material isolado.' };
  }

  const precoTexto = String(formData.get('preco') ?? '').trim().replace(/\./g, '').replace(',', '.');
  const preco = Number(precoTexto);
  if (!precoTexto || Number.isNaN(preco) || preco <= 0) {
    return { ok: false, erro: 'Preço inválido. Use apenas números, por exemplo 597 ou 597,00.' };
  }

  const deTexto = String(formData.get('preco_de') ?? '').trim().replace(/\./g, '').replace(',', '.');
  const precoDe = deTexto ? Number(deTexto) : null;
  if (deTexto && (Number.isNaN(precoDe) || precoDe! <= preco)) {
    return {
      ok: false,
      erro: 'O preço "de" precisa ser MAIOR que o preço de venda, senão o desconto vira piada.',
    };
  }

  const checkout = String(formData.get('checkout') ?? '').trim() || null;
  const urlSite = String(formData.get('url_site') ?? '').trim() || null;
  if (!checkout && !urlSite) {
    return {
      ok: false,
      erro: 'Falta o caminho de compra: o link do checkout ou o link da página de vendas. Sem um dos dois o botão não teria para onde ir.',
    };
  }

  const paraLink = (v: string | null) => {
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) return `https://${v}`;
    return v;
  };

  // Barreira que a documentacao prometia e o codigo nao tinha. Roda DEPOIS de
  // normalizar o link, senao "chk.eduzz.com/x" e "https://chk.eduzz.com/x"
  // passariam como dois links diferentes.
  const conflito = await conflitoDeLink(paraLink(checkout), paraLink(urlSite));
  if (conflito) return { ok: false, erro: conflito };

  const supabase = await criarSupabaseServer();

  // o id é o endereço da página; sai do nome, como na planilha
  const id = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    // de novo depois do corte: cortar em 80 podia deixar o hifen solto no fim
    .replace(/-+$/, '');

  if (!id) return { ok: false, erro: 'O nome precisa ter letras ou números.' };

  const { error } = await supabase.from('produtos_novos').insert({
    id,
    nome,
    categoria,
    area: String(formData.get('area') ?? '').trim() || null,
    ferramenta: String(formData.get('ferramenta') ?? '').trim() || null,
    formato: String(formData.get('formato') ?? '').trim() || null,
    preco,
    preco_de: precoDe,
    checkout: paraLink(checkout),
    url_site: paraLink(urlSite),
    capa_url: String(formData.get('capa_url') ?? '').trim() || null,
    capa_largura: Number(formData.get('capa_largura')) || null,
    capa_altura: Number(formData.get('capa_altura')) || null,
    descricao: String(formData.get('descricao') ?? '').trim() || null,
    atualizado_por: permissao.email,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, erro: `Já existe um material com o endereço "${id}". Mude o nome.` };
    }
    return { ok: false, erro: 'Não foi possível cadastrar: ' + error.message };
  }

  revalidarLoja();
  return { ok: true };
}

/** Apaga um material criado no painel. Não mexe nos que vêm da planilha. */
export async function apagarMaterialDoPainel(id: string): Promise<ResultadoAjuste> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const supabase = await criarSupabaseServer();
  const { error } = await supabase.from('produtos_novos').delete().eq('id', id);
  if (error) return { ok: false, erro: error.message };

  revalidarLoja();
  return { ok: true };
}

/**
 * Envia a capa e devolve a URL pública.
 *
 * Fica aqui porque o formulário de material é quem chama, mas o trabalho todo é
 * de lib/supabase/enviar-imagem, que o blog vai usar igual quando chegar a vez
 * dele: mesma função, só mudando a pasta.
 */
export async function enviarCapa(formData: FormData) {
  const pasta = String(formData.get('pasta') ?? 'produtos');
  return enviarImagem(pasta === 'blog' ? 'blog' : 'produtos', formData, 'imagem');
}

/* ==================================================================
   Script de produto: conferir, gravar e exportar
   ================================================================== */

export type ConferenciaDoScript = {
  ok: boolean;
  erros: string[];
  avisos: string[];
  /** o que vai ser gravado, campo a campo, para a tela mostrar */
  campos?: {
    nome: string;
    tipo: string;
    preco: number;
    precoDe: number | null;
    checkout: string | null;
    paginaDeVendas: string | null;
    area: string | null;
    ferramenta: string | null;
    formato: string | null;
    descricao: string | null;
    endereco: string;
    enderecoVeioDoNome: boolean;
  };
};

/**
 * Lê o script e diz o que ele vira, SEM GRAVAR NADA.
 *
 * Separado do gravar de propósito: a tela de conferência é o pedido central do
 * Sérgio ("produto ficou assim, conferido"), e ela precisa poder errar à
 * vontade sem consequência.
 */
export async function conferirScript(texto: string): Promise<ConferenciaDoScript> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erros: [permissao.erro], avisos: [] };

  const leitura = lerScript(texto);
  if (!leitura.ok) return { ok: false, erros: leitura.erros, avisos: leitura.avisos };

  const erros: string[] = [];

  // Colisões, que precisam de banco e por isso ficam fora do leitor puro.
  const conflito = await conflitoDeLink(leitura.campos.checkout, leitura.campos.paginaDeVendas);
  if (conflito) erros.push(conflito);

  const daPlanilha = produtos.find((p) => p.id === leitura.campos.endereco);
  if (daPlanilha) {
    erros.push(
      `endereço: "${leitura.campos.endereco}" já é o endereço de "${daPlanilha.nome}", que vem da planilha. Escreva um campo "endereco:" diferente no script.`,
    );
  } else {
    const supabase = await criarSupabaseServer();
    const { data } = await supabase
      .from('produtos_novos')
      .select('nome')
      .eq('id', leitura.campos.endereco)
      .maybeSingle();
    if (data) {
      erros.push(
        `endereço: "${leitura.campos.endereco}" já é de "${data.nome}", cadastrado aqui no painel. Para mudar aquele material, use o botão Ajustar.`,
      );
    }
  }

  return {
    ok: erros.length === 0,
    erros,
    avisos: leitura.avisos,
    campos: leitura.campos,
  };
}

/**
 * Grava o produto do script.
 *
 * RELÊ O TEXTO DO ZERO, e não recebe o objeto montado pelo navegador. Se
 * confiasse no objeto, bastaria adulterar a requisição para gravar um preço que
 * a conferência nunca viu. O texto colado é o único dado que atravessa.
 *
 * Copia campo a campo, por nome. Nunca espalha objeto: nenhum campo do arquivo
 * escolhe comportamento, e `atualizado_por` vem sempre de quem está logado.
 */
export async function gravarScript(formData: FormData): Promise<ResultadoAjuste> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const texto = String(formData.get('script') ?? '');
  const conferencia = await conferirScript(texto);
  if (!conferencia.ok || !conferencia.campos) {
    return { ok: false, erro: conferencia.erros[0] ?? 'O script não passou na conferência.' };
  }

  /**
   * A capa entra JUNTO, na mesma gravação.
   *
   * Ela vinha depois, num segundo passo na lista, e o Pedro apontou o custo:
   * o Sérgio precisa de velocidade, e mandar ele cadastrar, procurar o material
   * na lista e só então pôr a imagem são três viagens para uma tarefa só.
   *
   * O script continua sem carregar capa, porque um Claude de chat não produz
   * endereço do nosso armazenamento. O que mudou é que o botão de enviar imagem
   * agora fica na mesma tela da conferência, e o endereço dele viaja neste
   * formulário.
   */
  const capaUrl = String(formData.get('capa_url') ?? '').trim() || null;
  if (capaUrl && !capaDeHostPermitido(capaUrl)) {
    return { ok: false, erro: 'Esse endereço de capa não é aceito. Envie a imagem pelo botão.' };
  }

  const c = conferencia.campos;
  const supabase = await criarSupabaseServer();
  const { error } = await supabase.from('produtos_novos').insert({
    id: c.endereco,
    nome: c.nome,
    categoria: c.tipo,
    area: c.area,
    ferramenta: c.ferramenta,
    formato: c.formato,
    preco: c.preco,
    preco_de: c.precoDe,
    checkout: c.checkout,
    url_site: c.paginaDeVendas,
    descricao: c.descricao,
    capa_url: capaUrl,
    capa_largura: capaUrl ? Number(formData.get('capa_largura')) || null : null,
    capa_altura: capaUrl ? Number(formData.get('capa_altura')) || null : null,
    atualizado_por: permissao.email,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, erro: `Já existe um material no endereço "${c.endereco}".` };
    }
    return { ok: false, erro: 'Não foi possível cadastrar: ' + error.message };
  }

  revalidarLoja();
  return { ok: true };
}

/**
 * Troca a capa de um material criado no painel.
 *
 * Faltava caminho para isto. O cadastro pelo formulário manual tem o botão de
 * capa embutido, mas quem cadastra por script fica sem: o script não carrega
 * imagem de propósito, porque um Claude de chat não consegue produzir endereço
 * do nosso armazenamento, e link de fora não carrega no site.
 *
 * Então a capa se resolve DEPOIS, na lista, onde o material já está. Vale para
 * os dois caminhos, e também para trocar uma capa feia meses depois.
 */
export async function trocarCapaDoPainel(formData: FormData): Promise<ResultadoAjuste> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, erro: 'Material não identificado.' };

  const capaUrl = String(formData.get('capa_url') ?? '').trim() || null;
  const largura = Number(formData.get('capa_largura')) || null;
  const altura = Number(formData.get('capa_altura')) || null;

  /**
   * Só endereço do nosso armazenamento entra.
   *
   * O next/image LANÇA para host fora da lista do next.config, e a capa é
   * desenhada em componente de servidor na home, na página de área e na do
   * produto. Uma capa de host estranho derrubaria a home da loja, não só o
   * produto. O botão de enviar já devolve o endereço certo; esta checagem é
   * para o caso de alguém montar a requisição por fora.
   */
  if (capaUrl && !capaDeHostPermitido(capaUrl)) {
    return { ok: false, erro: 'Esse endereço de capa não é aceito. Envie a imagem pelo botão.' };
  }

  const supabase = await criarSupabaseServer();
  const { error } = await supabase
    .from('produtos_novos')
    .update({
      capa_url: capaUrl,
      capa_largura: capaUrl ? largura : null,
      capa_altura: capaUrl ? altura : null,
      atualizado_por: permissao.email,
    })
    .eq('id', id);

  if (error) return { ok: false, erro: 'Não foi possível trocar a capa: ' + error.message };

  revalidarLoja();
  return { ok: true };
}
