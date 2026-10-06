import { criarSupabaseServer } from '@/lib/supabase/server';
import { produtos, ofertaAtual, conteudoDe } from '@/data/catalogo';
import Gerenciador, { type ItemAdmin, type MaterialDoPainel } from './Gerenciador';
import { textoDoModelo } from './script-modelo';
import { exportacaoDaLoja } from '@/lib/catalogo-exportacao';

// Sempre dinâmico: reflete os ajustes na hora em que são salvos.
export const dynamic = 'force-dynamic';

export default async function MateriaisAdminPage() {
  const supabase = await criarSupabaseServer();

  /**
   * Colunas nomeadas, não `*`.
   *
   * `*` mandava para o navegador a coluna `observacao`, que é recado interno
   * entre nós, e o `atualizado_por`, que é o e-mail de quem editou. Com a
   * equipe do Sérgio dentro do painel isso deixou de ser detalhe.
   */
  const { data: ajustes } = await supabase
    .from('produtos_ajustes')
    .select('produto_id, preco, descricao, detalhes, observacao, oculto, destaque, ordem, checkout, preco_de, atualizado_em');

  /**
   * Os materiais criados aqui no painel.
   *
   * A tela lia só `produtos_ajustes`, ou seja, mostrava os 197 da planilha e
   * NENHUM dos criados aqui. O Sérgio cadastrou o primeiro em 18/09 e ficou sem
   * conseguir ver, corrigir nem apagar: a função de apagar existia no código
   * desde sempre e nunca tinha sido ligada em lugar nenhum.
   */
  const { data: doPainel } = await supabase
    .from('produtos_novos')
    .select('id, nome, categoria, area, ferramenta, preco, preco_de, checkout, url_site, capa_url, descricao, detalhes, oculto, criado_em')
    .order('criado_em', { ascending: false });

  const criadosAqui: MaterialDoPainel[] = (doPainel ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    categoria: p.categoria as string,
    area: (p.area as string | null) ?? null,
    ferramenta: (p.ferramenta as string | null) ?? null,
    preco: Number(p.preco),
    precoDe: p.preco_de != null ? Number(p.preco_de) : null,
    checkout: (p.checkout as string | null) ?? null,
    urlSite: (p.url_site as string | null) ?? null,
    capaUrl: (p.capa_url as string | null) ?? null,
    descricao: (p.descricao as string | null) ?? null,
    detalhes: (p.detalhes as string | null) ?? null,
    oculto: Boolean(p.oculto),
    criadoEm: (p.criado_em as string | null) ?? null,
  }));

  const porId = new Map((ajustes ?? []).map((a) => [a.produto_id as string, a]));

  // Junta a planilha (base) com os ajustes do painel. Os dois valores aparecem
  // lado a lado, para ninguém editar achando que está mexendo na planilha.
  const itens: ItemAdmin[] = produtos.map((p) => {
    const ajuste = porId.get(p.id);
    const oferta = ofertaAtual(p);

    return {
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      area: p.area,
      ferramenta: p.ferramenta,
      precoPlanilha: p.precos.cheio,
      precoAjustado: ajuste?.preco != null ? Number(ajuste.preco) : null,
      temCheckout: Boolean(p.checkouts.normal || p.checkouts.black),
      vendavel: oferta !== null,
      descricaoAjustada: (ajuste?.descricao as string | null) ?? null,
      detalhesAjustados: (ajuste?.detalhes as string | null) ?? null,
      /**
       * O texto que a planilha tem hoje, para o campo abrir preenchido.
       *
       * Vai junto de proposito, e nao so quando ha ajuste: sao ate 33 linhas
       * numeradas, e pedir para o Sergio redigitar tudo isso para acrescentar
       * um modulo seria o mesmo que nao ter o campo.
       */
      detalhesDaPlanilha: conteudoDe(p).detalhes ?? null,
      observacao: (ajuste?.observacao as string | null) ?? null,
      oculto: Boolean(ajuste?.oculto),
      destaque: Boolean(ajuste?.destaque),
      precoDe: ajuste?.preco_de != null ? Number(ajuste.preco_de) : null,
      ordem: (ajuste?.ordem as number | null) ?? null,
      checkoutPlanilha: p.checkouts.normal,
      checkoutAjustado: (ajuste?.checkout as string | null) ?? null,
      ajustadoEm: (ajuste?.atualizado_em as string | null) ?? null,
    };
  });

  /**
   * Os dois textos sao montados no SERVIDOR: o da loja inteira precisa do
   * catalogo ja ajustado pelo painel, que o navegador nao tem.
   *
   * Duas formas da data: a de nome de arquivo (ano-mes-dia, que ordena sozinha
   * na pasta de downloads) e a de ler (dia/mes/ano, dentro do arquivo).
   */
  const paraArquivo = new Date().toISOString().slice(0, 10);
  const daLoja = await exportacaoDaLoja(new Date().toLocaleDateString('pt-BR'));

  return (
    <Gerenciador
      itens={itens}
      criadosAqui={criadosAqui}
      modeloDoScript={textoDoModelo()}
      exportacaoDaLoja={daLoja.texto}
      hoje={paraArquivo}
      quantosMateriais={daLoja.quantos}
    />
  );
}
