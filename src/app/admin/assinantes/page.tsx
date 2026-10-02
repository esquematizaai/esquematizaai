import { criarSupabaseServer } from '@/lib/supabase/server';
import { exigirAdmin } from '@/lib/supabase/admin-guard';
import Gerenciador, { type Assinante } from './Gerenciador';

export const dynamic = 'force-dynamic';

/**
 * Quem assinou a newsletter.
 *
 * SÓ DONO ABRE, e isso é decisão, não descuido: a lista tem e-mail e telefone
 * de cliente. Sete contas entram no painel hoje e uma delas é da agência de
 * tráfego, contratada para cuidar de anúncio. A política do banco confere de
 * novo, então nem um endereço adivinhado nem uma chamada por fora alcançam.
 *
 * A tela existe porque lista que só o programador enxerga é lista refém. Até
 * 02/10 esses cadastros nem existiam: o pop-up pedia o e-mail e descartava.
 */
export default async function AssinantesPage() {
  const guarda = await exigirAdmin('dono');

  if (!guarda.ok) {
    return (
      <div style={{ maxWidth: '640px' }}>
        <h1>Assinantes da newsletter</h1>
        <p>{guarda.erro}</p>
      </div>
    );
  }

  const supabase = await criarSupabaseServer();

  /**
   * Os 500 mais recentes, não a lista inteira.
   *
   * A tela serve para olhar quem entrou e conferir se está chegando. Quem
   * precisa da lista toda usa o botão de baixar, que lê tudo. Trazer dez mil
   * linhas para a tela deixaria o painel lento para ninguém ler o fim.
   */
  const { data } = await supabase
    .from('leads')
    .select('email, telefone, area, origem, resend_id, resend_erro, criado_em')
    .order('criado_em', { ascending: false })
    .limit(500);

  const { count } = await supabase.from('leads').select('email', { count: 'exact', head: true });

  const assinantes: Assinante[] = (data ?? []).map((l) => ({
    email: l.email as string,
    telefone: (l.telefone as string | null) ?? null,
    area: (l.area as string | null) ?? null,
    origem: l.origem as string,
    noResend: Boolean(l.resend_id),
    erroDoResend: (l.resend_erro as string | null) ?? null,
    criadoEm: l.criado_em as string,
  }));

  return <Gerenciador assinantes={assinantes} total={count ?? assinantes.length} />;
}
