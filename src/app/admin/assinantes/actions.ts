'use server';

import { criarSupabaseServer } from '@/lib/supabase/server';
import { exigirAdmin } from '@/lib/supabase/admin-guard';

/**
 * A lista da newsletter em CSV, para disparo fora do site.
 *
 * POR QUE EXISTE: enquanto o Resend não estiver ligado, e mesmo depois dele, o
 * Sérgio precisa conseguir levar a lista para onde ele quiser sem depender de
 * mim. Lista que só o programador consegue exportar é lista refém.
 *
 * SAI PELO CLIENTE DA SESSÃO, não pela chave de serviço: a política do banco
 * confere de novo se quem pediu é dono. São e-mails e telefones de clientes, e
 * é o tipo de arquivo que não pode vazar por um endereço adivinhado.
 */
export type ResultadoCsv = { ok: true; csv: string; linhas: number } | { ok: false; erro: string };

/**
 * Campo de CSV que o Excel não estrague.
 *
 * Aspas dobradas e o campo inteiro entre aspas, porque nome de área tem acento
 * e um dia alguém vai ter vírgula em algum campo. Sem isso a planilha abre com
 * as colunas trocadas de lugar e ninguém entende por quê.
 */
function campo(valor: string | null): string {
  return `"${(valor ?? '').replace(/"/g, '""')}"`;
}

export async function baixarAssinantes(): Promise<ResultadoCsv> {
  const guarda = await exigirAdmin('dono');
  if (!guarda.ok) return { ok: false, erro: guarda.erro };

  const supabase = await criarSupabaseServer();
  const { data, error } = await supabase
    .from('leads')
    .select('email, telefone, area, origem, criado_em')
    .order('criado_em', { ascending: false });

  if (error) return { ok: false, erro: 'O banco recusou a leitura da lista.' };

  const linhas = data ?? [];
  const cabecalho = 'email,telefone,area,origem,cadastrado_em';
  const corpo = linhas.map((l) =>
    [
      campo(l.email as string),
      campo(l.telefone as string | null),
      campo(l.area as string | null),
      campo(l.origem as string),
      campo(l.criado_em as string),
    ].join(','),
  );

  return { ok: true, csv: [cabecalho, ...corpo].join('\n'), linhas: linhas.length };
}
