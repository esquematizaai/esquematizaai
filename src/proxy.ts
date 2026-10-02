import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Proxy (o antigo "middleware" do Next < 16). Faz duas coisas:
 *  1. Mantém a sessão do Supabase fresca, sincronizando os cookies a cada request.
 *  2. Protege /admin: sem usuário logado, redireciona para /admin/login.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: getUser() valida o token no servidor (getSession() apenas lê o cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const ehAreaAdmin = pathname.startsWith('/admin');
  const ehLogin = pathname === '/admin/login';

  if (!ehAreaAdmin) return response;

  /**
   * Ter sessão NÃO é o mesmo que ser administrador.
   *
   * O cadastro do Supabase aceita qualquer pessoa, e a chave anônima vai no
   * HTML de todas as páginas. Ou seja: conseguir uma sessão é coisa de dois
   * minutos para qualquer um na internet. Quem manda é a tabela
   * `administradores`, consultada pela função eh_admin() do banco.
   *
   * A barreira que realmente protege está nas políticas do banco: mesmo
   * chamando a API do Supabase por fora, sem passar por aqui, quem não é
   * administrador não escreve nada. Esta checagem evita abrir um painel que a
   * pessoa não conseguiria usar, e impede que ela veja os rascunhos.
   *
   * A permissão é resolvida uma vez só, porque dela dependem os dois desvios
   * abaixo. Sem isso, um usuário logado e sem permissão ficaria preso num
   * laço: o painel o mandaria para o login, e o login o mandaria de volta.
   */
  const ehAdmin = user ? Boolean((await supabase.rpc('eh_admin')).data) : false;

  /**
   * Cada área do painel pede o seu papel.
   *
   * Sem isto, quem só cuida de produto abriria /admin/blog, escreveria o artigo
   * inteiro e só descobriria na hora de salvar, quando o banco recusasse. O
   * trabalho perdido seria dela, e a culpa pareceria do site.
   *
   * Isto é conveniência, não segurança: quem manda são as políticas do banco,
   * que perguntam por pode_produtos() e pode_blog() em cada tabela. Mesmo
   * chamando a API por fora, sem passar por aqui, a escrita é recusada.
   */
  const PAPEL_DA_AREA: { prefixo: string; rpc: string }[] = [
    { prefixo: '/admin/materiais', rpc: 'pode_produtos' },
    { prefixo: '/admin/sumarios', rpc: 'pode_produtos' },
    { prefixo: '/admin/cursos', rpc: 'pode_produtos' },
    { prefixo: '/admin/blog', rpc: 'pode_blog' },
    { prefixo: '/admin/noticias', rpc: 'pode_blog' },
    { prefixo: '/admin/acessos', rpc: 'eh_dono' },
    { prefixo: '/admin/assinantes', rpc: 'eh_dono' },
  ];

  // Tela de login: só quem já é administrador é levado direto ao painel.
  if (ehLogin) {
    if (ehAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Resto do painel: sem sessão ou sem permissão, volta para o login.
  if (!ehAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = user ? '?erro=sem-permissao' : '';
    return NextResponse.redirect(url);
  }

  // Está no painel, mas esta área pode não ser dela.
  const area = PAPEL_DA_AREA.find((a) => pathname.startsWith(a.prefixo));
  if (area) {
    const podeNestaArea = Boolean((await supabase.rpc(area.rpc)).data);
    if (!podeNestaArea) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '?erro=area-sem-acesso';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
