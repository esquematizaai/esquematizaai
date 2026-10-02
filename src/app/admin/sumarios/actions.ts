'use server';

import { revalidatePath } from 'next/cache';
import { criarSupabaseServer } from '@/lib/supabase/server';
import { exigirAdmin } from '@/lib/supabase/admin-guard';
import { lerSumarioColado } from '@/lib/sumario-colado';

export type Resultado = { ok: boolean; erro?: string };

/**
 * Edição dos sumários pelo painel.
 *
 * SALVAR ADOTA A DISCIPLINA. A partir do primeiro salvamento, `adotada_em` fica
 * preenchido e as reimportações da planilha param de mexer NAQUELA disciplina.
 * É o que permite as duas fontes conviverem enquanto a migração acontece: o
 * Sérgio migra no ritmo dele, uma disciplina por vez, sem que a planilha desfaça
 * o trabalho dele pelas costas.
 *
 * O caminho de volta existe: devolverParaPlanilha apaga os tópicos do banco e
 * limpa a marca, e a disciplina volta a seguir a planilha.
 */

function revalidarTudo() {
  // o sumário aparece na página de cada produto
  revalidatePath('/vitrine/produto/[id]', 'page');
  revalidatePath('/admin/sumarios');
  revalidatePath('/admin/cursos');
}

/** uma linha por tópico, na ordem em que a pessoa escreveu */
function emLinhas(texto: string): string[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function salvarSumario(formData: FormData): Promise<Resultado> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, erro: 'Disciplina não identificada.' };

  const topicos = emLinhas(String(formData.get('topicos') ?? ''));
  if (topicos.length === 0) {
    return {
      ok: false,
      erro: 'O sumário está vazio. Para voltar ao da planilha, use o botão "devolver para a planilha".',
    };
  }

  const area = String(formData.get('area') ?? '').trim() || null;

  const medidaTexto = String(formData.get('medida') ?? '').trim();
  const medida = medidaTexto ? Number(medidaTexto) : null;
  if (medidaTexto && (Number.isNaN(medida) || medida! < 0)) {
    return { ok: false, erro: 'Páginas ou cards deve ser um número.' };
  }
  const formato = String(formData.get('formato') ?? '');

  const supabase = await criarSupabaseServer();

  const { error: erroDisciplina } = await supabase
    .from('disciplinas')
    .update({
      area,
      paginas: formato === 'Resumo' ? medida : null,
      cards: formato === 'Flashcards' ? medida : null,
      adotada_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      atualizado_por: permissao.email,
    })
    .eq('id', id);

  if (erroDisciplina) return { ok: false, erro: 'Não foi possível salvar: ' + erroDisciplina.message };

  // apaga e repõe: é uma lista ordenada, e comparar item a item para descobrir
  // o que mudou custaria mais do que reescrever as poucas dezenas de linhas
  const { error: erroApagar } = await supabase
    .from('disciplina_topicos')
    .delete()
    .eq('disciplina_id', id);
  if (erroApagar) return { ok: false, erro: 'Não foi possível salvar: ' + erroApagar.message };

  const { error: erroInserir } = await supabase
    .from('disciplina_topicos')
    .insert(topicos.map((texto, i) => ({ disciplina_id: id, ordem: i + 1, texto })));
  if (erroInserir) return { ok: false, erro: 'Não foi possível salvar: ' + erroInserir.message };

  revalidarTudo();
  return { ok: true };
}

/**
 * Desfaz a adoção: a disciplina volta a seguir a planilha.
 *
 * Existe porque adotar é fácil de fazer sem querer, e sem volta o Sérgio
 * ficaria preso mantendo à mão uma disciplina que ele só queria espiar.
 */
export async function devolverParaPlanilha(formData: FormData): Promise<Resultado> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, erro: 'Disciplina não identificada.' };

  const supabase = await criarSupabaseServer();

  const { error: erroApagar } = await supabase
    .from('disciplina_topicos')
    .delete()
    .eq('disciplina_id', id);
  if (erroApagar) return { ok: false, erro: erroApagar.message };

  const { error } = await supabase
    .from('disciplinas')
    .update({
      adotada_em: null,
      atualizado_em: new Date().toISOString(),
      atualizado_por: permissao.email,
    })
    .eq('id', id);

  if (error) return { ok: false, erro: error.message };

  revalidarTudo();
  return { ok: true };
}

/**
 * Cria uma disciplina que não existe na planilha.
 *
 * O Sérgio pediu "CADASTRAR/ATUALIZAR", e só o atualizar tinha sido feito: a
 * tela nascia com as 109 da planilha e não havia como acrescentar. Disciplina
 * nova nasce já adotada, porque ela não tem de onde herdar nada.
 */
export async function criarDisciplina(formData: FormData): Promise<Resultado> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const nome = String(formData.get('nome') ?? '').trim();
  if (!nome) return { ok: false, erro: 'Escreva o nome da disciplina.' };

  const formato = String(formData.get('formato') ?? '').trim();
  if (formato !== 'Resumo' && formato !== 'Flashcards') {
    return { ok: false, erro: 'Escolha se é Resumo ou Flashcards.' };
  }

  const topicos = emLinhas(String(formData.get('topicos') ?? ''));
  if (topicos.length === 0) {
    return { ok: false, erro: 'Escreva pelo menos um tópico, um por linha.' };
  }

  const area = String(formData.get('area') ?? '').trim() || null;
  const medidaTexto = String(formData.get('medida') ?? '').trim();
  const medida = medidaTexto ? Number(medidaTexto) : null;
  if (medidaTexto && (Number.isNaN(medida) || medida! < 0)) {
    return { ok: false, erro: 'Páginas ou cards deve ser um número.' };
  }

  const supabase = await criarSupabaseServer();

  const { data, error } = await supabase
    .from('disciplinas')
    .insert({
      nome,
      formato,
      area,
      paginas: formato === 'Resumo' ? medida : null,
      cards: formato === 'Flashcards' ? medida : null,
      adotada_em: new Date().toISOString(),
      atualizado_por: permissao.email,
    })
    .select('id')
    .single();

  if (error) {
    // a mesma disciplina pode existir nos dois formatos, mas não duas vezes no
    // mesmo; o banco garante isso e aqui a mensagem explica o que houve
    if (error.code === '23505') {
      return { ok: false, erro: `Já existe uma disciplina "${nome}" em ${formato}.` };
    }
    return { ok: false, erro: 'Não foi possível cadastrar: ' + error.message };
  }

  const { error: erroTopicos } = await supabase
    .from('disciplina_topicos')
    .insert(topicos.map((texto, i) => ({ disciplina_id: data.id, ordem: i + 1, texto })));

  if (erroTopicos) {
    // sem os tópicos a disciplina não serve para nada, então ela não fica
    await supabase.from('disciplinas').delete().eq('id', data.id);
    return { ok: false, erro: 'Não foi possível salvar os tópicos: ' + erroTopicos.message };
  }

  revalidarTudo();
  return { ok: true };
}

/**
 * Taguear a disciplina por área, sem adotar o sumário dela.
 *
 * O Sérgio pediu as duas coisas separadas, e são mesmo: dá para querer
 * organizar as 46 disciplinas que estão sem área hoje sem ter a menor intenção
 * de reescrever o sumário delas.
 */
export async function salvarArea(formData: FormData): Promise<Resultado> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, erro: 'Disciplina não identificada.' };

  const area = String(formData.get('area') ?? '').trim() || null;

  const supabase = await criarSupabaseServer();
  const { error } = await supabase
    .from('disciplinas')
    .update({
      area,
      atualizado_em: new Date().toISOString(),
      atualizado_por: permissao.email,
    })
    .eq('id', id);

  if (error) return { ok: false, erro: error.message };

  revalidarTudo();
  return { ok: true };
}

/**
 * Importa um sumário inteiro, colado de uma vez.
 *
 * O PEDIDO QUE GEROU ISTO: "travo na parte de colocar o sumário". Para o
 * Tecnologia da Informação seriam 4 disciplinas criadas à mão e 88 linhas
 * digitadas uma a uma, e depois outra tela para ligar cada uma ao material. No
 * SEFAZ-AL eram 16 disciplinas e 183 linhas. Ele já escreve esse texto para a
 * página de venda; só faltava o painel saber lê-lo.
 *
 * FAZ AS DUAS TELAS DE UMA VEZ. Criar a disciplina em Sumários e ligar ao
 * material em Cursos eram dois passos em lugares diferentes, e esquecer o
 * segundo era deixar o trabalho inteiro invisível no site. Foi o que aconteceu
 * com o SEFAZ-AL: as 16 disciplinas estavam cadastradas e certas, e a página
 * não mostrava nada.
 *
 * SUBSTITUI, NÃO SOMA. Disciplina que já existe com aquele nome e formato tem
 * os tópicos trocados pelos novos, e o material tem a lista de disciplinas
 * refeita. É o que faz reimportar depois de corrigir o texto ser seguro: sem
 * isso, a segunda importação deixaria a disciplina com o sumário duplicado.
 */
export async function importarSumario(formData: FormData): Promise<Resultado> {
  const permissao = await exigirAdmin('produtos');
  if (!permissao.ok) return { ok: false, erro: permissao.erro };

  const formato = String(formData.get('formato') ?? '').trim();
  if (formato !== 'Resumo' && formato !== 'Flashcards') {
    return { ok: false, erro: 'Escolha se o material é de Resumos ou de Flashcards.' };
  }

  const lido = lerSumarioColado(String(formData.get('texto') ?? ''));
  if (lido.disciplinas.length === 0) {
    return { ok: false, erro: 'Não reconheci nenhuma disciplina nesse texto.' };
  }

  const produtoId = String(formData.get('produto') ?? '').trim();
  const supabase = await criarSupabaseServer();
  const ids: string[] = [];

  for (const d of lido.disciplinas) {
    const medidas = {
      paginas: formato === 'Resumo' ? d.medida : null,
      cards: formato === 'Flashcards' ? d.medida : null,
    };

    // onConflict no par nome+formato: é a mesma chave que o banco usa, então a
    // segunda importação atualiza em vez de bater na restrição de duplicidade
    const { data, error } = await supabase
      .from('disciplinas')
      .upsert(
        {
          nome: d.nome,
          formato,
          ...medidas,
          adotada_em: new Date().toISOString(),
          atualizado_por: permissao.email,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'nome,formato' },
      )
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, erro: `Falhou em "${d.nome}": ${error?.message ?? 'sem id de volta'}` };
    }

    ids.push(data.id as string);

    // troca os tópicos: apaga os de antes e grava os novos na ordem do texto
    await supabase.from('disciplina_topicos').delete().eq('disciplina_id', data.id);
    const { error: erroTopicos } = await supabase
      .from('disciplina_topicos')
      .insert(d.linhas.map((texto, i) => ({ disciplina_id: data.id, ordem: i + 1, texto })));

    if (erroTopicos) {
      return { ok: false, erro: `Os assuntos de "${d.nome}" não entraram: ${erroTopicos.message}` };
    }
  }

  if (produtoId) {
    // a lista do material é refeita, e não acrescentada: reimportar um texto
    // corrigido tem que deixar o material com exatamente o que está no texto
    await supabase.from('curso_disciplinas').delete().eq('produto_id', produtoId);
    const { error: erroVinculo } = await supabase
      .from('curso_disciplinas')
      .insert(ids.map((disciplina_id, i) => ({ produto_id: produtoId, disciplina_id, ordem: i + 1 })));

    if (erroVinculo) {
      return { ok: false, erro: 'As disciplinas entraram, mas não consegui ligar ao material: ' + erroVinculo.message };
    }
  }

  revalidarTudo();
  return { ok: true };
}
