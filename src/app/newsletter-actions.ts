'use server';

import { createClient } from '@supabase/supabase-js';
import { areaValida } from '@/lib/areas-de-concurso';

/**
 * A inscrição na newsletter.
 *
 * O QUE ISTO CONSERTA: o pop-up da home pedia e-mail desde 09/06 e não mandava
 * para lugar nenhum. A pessoa via "Voou. Em breve você recebe as novidades" e o
 * endereço era descartado. Quase quatro meses de gente se cadastrando no vazio.
 *
 * SÃO DOIS PASSOS, E CADA UM GRAVA. O pop-up pede o e-mail primeiro e só depois
 * abre telefone e área. Se a gravação fosse uma só, no fim, quem desistisse no
 * segundo passo se perderia de novo, que é exatamente o problema que estamos
 * consertando. O e-mail entra assim que é digitado; o resto completa a linha.
 *
 * O RESEND É O DESTINO, NÃO A FONTE. A lista mora no nosso banco primeiro: se a
 * API deles estiver fora do ar na hora, a pessoa não se perde, e trocar de
 * ferramenta um dia não significa perder a lista. O envio para o Resend é a
 * segunda coisa que acontece, e falhar nele não falha a inscrição.
 */

export type ResultadoNewsletter = { ok: true } | { ok: false; erro: string };

/**
 * Cliente com a chave de serviço.
 *
 * A tabela `leads` não aceita escrita de visitante, de propósito: fosse o
 * navegador gravando direto, qualquer um encheria a lista com um laço de
 * requisições. Quem escreve é esta função, depois de validar.
 */
function clienteDeServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { persistSession: false } });
}

function lerEmail(valor: FormDataEntryValue | null): string | null {
  const bruto = String(valor ?? '').trim().toLowerCase();
  if (bruto.length > 180) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(bruto)) return null;
  return bruto;
}

/**
 * Guarda só os dígitos, e recusa o que não parece telefone brasileiro.
 *
 * Com DDD são 10 ou 11 dígitos; com o 55 na frente, 12 ou 13. Guardar o que a
 * pessoa digitou, com parênteses e traço de um jeito diferente a cada vez,
 * transformaria a exportação num campo impossível de usar em disparo.
 */
function lerTelefone(valor: FormDataEntryValue | null): string | null {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  const limpo = digitos.replace(/^55/, '');
  if (limpo.length < 10 || limpo.length > 11) return null;
  return limpo;
}

function lerArea(valor: FormDataEntryValue | null): string | null {
  const bruto = String(valor ?? '').trim();
  return areaValida(bruto) ? bruto : null;
}

/**
 * Primeiro passo: o e-mail entra na lista.
 *
 * `upsert` por e-mail, e não `insert`: quem já se cadastrou e voltou a preencher
 * não pode receber erro na cara nem virar linha duplicada. Para ela é a mesma
 * inscrição de sempre.
 */
export async function assinarNewsletter(formData: FormData): Promise<ResultadoNewsletter> {
  const email = lerEmail(formData.get('email'));
  if (!email) return { ok: false, erro: 'Confira o e-mail: parece faltar alguma coisa nele.' };

  const supabase = clienteDeServico();
  if (!supabase) {
    console.error('[newsletter] falta a chave de serviço: a inscrição não foi gravada');
    return { ok: false, erro: 'Não conseguimos registrar agora. Tente de novo em instantes.' };
  }

  const { error } = await supabase
    .from('leads')
    .upsert({ email, atualizado_em: new Date().toISOString() }, { onConflict: 'email' });

  if (error) {
    console.error('[newsletter] falha ao gravar o e-mail:', error.message);
    return { ok: false, erro: 'Não conseguimos registrar agora. Tente de novo em instantes.' };
  }

  return { ok: true };
}

/**
 * Segundo passo: telefone e área completam quem já entrou.
 *
 * NÃO FALHA POR CAMPO VAZIO. Quem fechar a janela sem preencher continua na
 * lista com o e-mail, e é assim que tem que ser: o telefone é bônus, o e-mail é
 * o produto.
 */
export async function completarNewsletter(formData: FormData): Promise<ResultadoNewsletter> {
  const email = lerEmail(formData.get('email'));
  if (!email) return { ok: false, erro: 'Confira o e-mail: parece faltar alguma coisa nele.' };

  const telefone = lerTelefone(formData.get('telefone'));
  const area = lerArea(formData.get('area'));

  const supabase = clienteDeServico();
  if (!supabase) return { ok: false, erro: 'Não conseguimos registrar agora.' };

  /**
   * CAMPO VAZIO NÃO APAGA O QUE JÁ ESTAVA LÁ.
   *
   * Quem já assinou e volta ao site vê o pop-up de novo, digita o mesmo e-mail
   * e chega no segundo passo com os campos em branco, porque a janela não sabe
   * o que ela preencheu meses atrás. Mandando `telefone: null` nessa hora, o
   * "Concluir" apagaria o telefone que ela já tinha dado. Descobri testando o
   * caminho de quem volta, que é o que menos se testa e o mais comum.
   */
  const mudancas: Record<string, string | null> = {
    email,
    atualizado_em: new Date().toISOString(),
  };
  if (telefone) mudancas.telefone = telefone;
  if (area) mudancas.area = area;

  const { error } = await supabase.from('leads').upsert(mudancas, { onConflict: 'email' });

  if (error) {
    console.error('[newsletter] falha ao completar o cadastro:', error.message);
    return { ok: false, erro: 'Não conseguimos registrar agora.' };
  }

  // o Resend é a última coisa, e falhar nele não desfaz a inscrição
  await mandarParaOResend({ email, telefone, area });

  return { ok: true };
}

/**
 * Sobe o contato para o Resend.
 *
 * FICA ATRÁS DA CHAVE DE PROPÓSITO: enquanto RESEND_API_KEY não existir, a
 * inscrição funciona e fica guardada aqui, com resend_id nulo. No dia em que a
 * chave entrar, quem ficou para trás é reconhecível por esse campo nulo e sobe
 * de uma vez, sem duplicar ninguém.
 *
 * Telefone e área vão como `properties`, que é o campo livre do Resend. Assim o
 * Sérgio consegue segmentar o disparo por área sem precisar de planilha.
 */
async function mandarParaOResend(contato: {
  email: string;
  telefone: string | null;
  area: string | null;
}): Promise<void> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return;

  const propriedades: Record<string, string> = {};
  if (contato.telefone) propriedades.telefone = contato.telefone;
  if (contato.area) propriedades.area = contato.area;

  const supabase = clienteDeServico();

  try {
    const resposta = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: contato.email,
        unsubscribed: false,
        ...(Object.keys(propriedades).length > 0 ? { properties: propriedades } : {}),
      }),
    });

    const corpo = (await resposta.json()) as { id?: string; message?: string };

    if (!resposta.ok) {
      // guarda o motivo na própria linha: sem isso, descobrir por que alguém
      // não chegou na lista viraria arqueologia de log
      await supabase?.from('leads').update({ resend_erro: corpo.message ?? `HTTP ${resposta.status}` }).eq('email', contato.email);
      console.error('[newsletter] Resend recusou:', corpo.message ?? resposta.status);
      return;
    }

    await supabase
      ?.from('leads')
      .update({ resend_id: corpo.id ?? null, resend_erro: null })
      .eq('email', contato.email);
  } catch (e) {
    console.error('[newsletter] Resend indisponível:', e instanceof Error ? e.message : e);
  }
}
