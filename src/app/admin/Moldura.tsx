'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { sair } from './login/actions';
import BotaoCriar from './BotaoCriar';
import type { Funcao } from '@/lib/supabase/admin-guard';
import styles from './layout.module.css';

const IconPackage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>
  </svg>
);
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

/**
 * Cada item do menu pertence a um papel.
 *
 * Esconder o que a pessoa não pode usar não é enfeite: ela abriria a tela,
 * escreveria o artigo inteiro e só descobriria na hora de salvar, quando o
 * banco recusasse. O trabalho perdido seria dela e a culpa pareceria do site.
 *
 * Quem barra de verdade são as políticas do banco e o proxy. Isto aqui é só
 * não oferecer a porta trancada.
 */
const navItems: { href: string; label: string; icon: React.ReactNode; funcao: Funcao }[] = [
  { href: '/admin/materiais', label: 'Materiais', icon: <IconPackage />, funcao: 'produtos' },
  { href: '/admin/sumarios', label: 'Sumários', icon: <IconFile />, funcao: 'produtos' },
  { href: '/admin/cursos', label: 'Cursos', icon: <IconPackage />, funcao: 'produtos' },
  { href: '/admin/noticias', label: 'Notícias', icon: <IconFile />, funcao: 'blog' },
  { href: '/admin/blog', label: 'Blog', icon: <IconFile />, funcao: 'blog' },
  { href: '/admin/assinantes', label: 'Assinantes', icon: <IconMail />, funcao: 'dono' },
  { href: '/admin/acessos', label: 'Acessos', icon: <IconUsers />, funcao: 'dono' },
];

const ROTULO_DO_PAPEL: Record<Funcao, string> = {
  produtos: 'Materiais e cursos',
  blog: 'Blog e notícias',
  dono: 'Dono',
};

/**
 * "Materiais e cursos e Blog e notícias e Dono" era o que saía do join simples,
 * com três papéis. Vírgula no meio e "e" só no último é como se lê em voz alta.
 */
function descreverPapeis(funcoes: Funcao[]): string {
  const nomes = funcoes.map((f) => ROTULO_DO_PAPEL[f]);
  if (nomes.length === 0) return 'Sem acesso';
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

export default function Moldura({
  children,
  funcoes,
  email,
}: {
  children: React.ReactNode;
  funcoes: Funcao[];
  email: string | null;
}) {
  const pathname = usePathname();
  const itensVisiveis = navItems.filter((i) => funcoes.includes(i.funcao));

  // A tela de login não usa a moldura do painel (sidebar).
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <Image
            src="/logos/logo-horizontal-branco.png"
            alt="Esquematiza Aí"
            width={155}
            height={40}
            style={{ objectFit: 'contain' }}
            priority
          />
          <span className={styles.adminBadge}>Admin</span>
        </div>

        <nav className={styles.nav}>
          {itensVisiveis.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.userRow}>
            {/* Quem está logado e o que essa conta pode, escrito. Com a equipe
                dividindo o painel, "Administrador / Proprietário" fixo em todo
                mundo esconde justamente o que a pessoa precisa saber quando um
                botão não aparece para ela. */}
            <div className={styles.userAvatar}>{(email ?? 'A').charAt(0).toUpperCase()}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{email ?? 'Administrador'}</span>
              <span className={styles.userRole}>{descreverPapeis(funcoes)}</span>
            </div>
          </div>
          <Link href="/" className={styles.backLink}>
            <IconArrowLeft />
            <span>Voltar ao Site</span>
          </Link>
          <form action={sair}>
            <button type="submit" className={styles.logoutBtn}>Sair</button>
          </form>
        </div>
      </aside>

      <main className={styles.main}>
        {children}
      </main>

      {/* No canto onde vivia o botão de WhatsApp do site, que é o suporte ao
          aluno e não tinha o que fazer dentro do painel da equipe. Oferece o
          que a pessoa PODE criar, conforme o papel dela. */}
      <BotaoCriar funcoes={funcoes} />
    </div>
  );
}
