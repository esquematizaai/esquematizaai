import { criarSupabaseServer } from '@/lib/supabase/server';
import sumarios from '@/data/catalogo/sumarios.json';
import { produtos } from '@/data/catalogo';
import { lerProdutosDoPainel, somenteOsQueFaltam } from '@/lib/produtos-do-painel';
import Gerenciador, { type DisciplinaAdmin, type MaterialOpcao } from './Gerenciador';

// Sempre dinâmico: quem acabou de salvar precisa ver o que salvou.
export const dynamic = 'force-dynamic';

/**
 * Sumários das disciplinas, editáveis pelo painel.
 *
 * O Sérgio pediu isso porque o sumário "está sempre mudando" e hoje só muda na
 * planilha, o que exige alguém mexer no repositório. Aqui ele edita direto, e a
 * página de vendas pega em até um minuto.
 *
 * AS DUAS FONTES APARECEM LADO A LADO, de propósito. Enquanto ninguém tocou na
 * disciplina, ela mostra os tópicos da planilha e diz de onde vieram. Salvou uma
 * vez, ela passa a ser do painel e a planilha para de mandar naquela. Sem deixar
 * isso na cara, alguém edita achando que está mudando a planilha.
 */

const emLinhas = (t: string | null) =>
  String(t || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** tópicos que vêm da planilha, por nome e formato */
function topicosDaPlanilha(): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const d of sumarios.resumosRegulares.disciplinas) {
    if (d.sumario) mapa.set(`Resumo::${d.disciplina}`, emLinhas(d.sumario));
  }
  for (const d of sumarios.flashcardsRegulares) {
    if (d.arvoreAssuntos) mapa.set(`Flashcards::${d.disciplina}`, emLinhas(d.arvoreAssuntos));
  }
  return mapa;
}

export default async function SumariosAdminPage() {
  const supabase = await criarSupabaseServer();

  const [{ data: disciplinas }, { data: topicos }] = await Promise.all([
    supabase
      .from('disciplinas')
      .select('id, nome, formato, area, paginas, cards, adotada_em, atualizado_em, atualizado_por')
      .order('formato')
      .order('nome'),
    supabase.from('disciplina_topicos').select('disciplina_id, ordem, texto').order('ordem'),
  ]);

  const daPlanilha = topicosDaPlanilha();

  const doBanco = new Map<string, string[]>();
  for (const t of topicos ?? []) {
    const lista = doBanco.get(t.disciplina_id as string);
    if (lista) lista.push(t.texto as string);
    else doBanco.set(t.disciplina_id as string, [t.texto as string]);
  }

  const itens: DisciplinaAdmin[] = (disciplinas ?? []).map((d) => {
    const chave = `${d.formato}::${d.nome}`;
    const adotada = Boolean(d.adotada_em);

    return {
      id: d.id as string,
      nome: d.nome as string,
      formato: d.formato as 'Resumo' | 'Flashcards',
      area: (d.area as string | null) ?? null,
      paginas: (d.paginas as number | null) ?? null,
      cards: (d.cards as number | null) ?? null,
      adotada,
      // o que a página de vendas mostra hoje
      topicos: adotada ? (doBanco.get(d.id as string) ?? []) : (daPlanilha.get(chave) ?? []),
      // sempre disponível, para o botão de voltar para a planilha
      topicosDaPlanilha: daPlanilha.get(chave) ?? [],
      atualizadoEm: (d.atualizado_em as string | null) ?? null,
      atualizadoPor: (d.atualizado_por as string | null) ?? null,
    };
  });

  /**
   * Os materiais que podem receber um sumário, para o importador já ligar.
   *
   * Inclui os cadastrados no painel, e não só os da planilha: foi exatamente
   * por eles faltarem nesta lista que o SEFAZ-AL ficou com as 16 disciplinas
   * cadastradas e invisíveis no site.
   */
  const doPainel = await lerProdutosDoPainel();
  const materiais: MaterialOpcao[] = [...produtos, ...somenteOsQueFaltam(doPainel, produtos)]
    .filter((p) => ['assinatura', 'combo', 'isolado'].includes(p.categoria) && p.status !== 'inativo')
    .map((p) => ({ id: p.id, nome: p.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return <Gerenciador itens={itens} materiais={materiais} />;
}
