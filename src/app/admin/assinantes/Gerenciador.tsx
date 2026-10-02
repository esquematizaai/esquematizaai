'use client';

import { useMemo, useState, useTransition } from 'react';
import { AREAS_DE_CONCURSO } from '@/lib/areas-de-concurso';
import { baixarAssinantes } from './actions';
import styles from './page.module.css';

export type Assinante = {
  email: string;
  telefone: string | null;
  area: string | null;
  origem: string;
  noResend: boolean;
  erroDoResend: string | null;
  criadoEm: string;
};

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  // fuso fixo para servidor e navegador escreverem a mesma data: sem isso o
  // React reclama de conteúdo diferente entre os dois ao montar
  timeZone: 'America/Sao_Paulo',
});

function data(iso: string): string {
  return FORMATO_DATA.format(new Date(iso));
}

/** 11987654321 -> (11) 98765-4321. Guardamos só dígitos; aqui vira legível. */
function telefoneLegivel(bruto: string | null): string {
  if (!bruto) return '';
  const d = bruto.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
}

function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Gerenciador({
  assinantes,
  total,
}: {
  assinantes: Assinante[];
  total: number;
}) {
  const [busca, setBusca] = useState('');
  const [area, setArea] = useState('');
  const [recado, setRecado] = useState<string | null>(null);
  const [baixando, comecar] = useTransition();

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return assinantes.filter((a) => {
      if (area && a.area !== area) return false;
      if (!termo) return true;
      return semAcento(a.email).includes(termo) || (a.telefone ?? '').includes(termo);
    });
  }, [assinantes, busca, area]);

  const comTelefone = useMemo(() => assinantes.filter((a) => a.telefone).length, [assinantes]);

  /**
   * Quantos por área, para o Sérgio saber se vale segmentar o disparo.
   *
   * Sem isso ele só sabe o total, e o campo de área vira um dado que ninguém
   * olha. É a pergunta que ele vai fazer no primeiro envio: "dá para mandar só
   * para quem é da Fiscal?".
   */
  const porArea = useMemo(() => {
    const conta = new Map<string, number>();
    for (const a of assinantes) {
      const chave = a.area ?? 'Não informou';
      conta.set(chave, (conta.get(chave) ?? 0) + 1);
    }
    return [...conta.entries()].sort((x, y) => y[1] - x[1]);
  }, [assinantes]);

  function baixar() {
    comecar(async () => {
      const r = await baixarAssinantes();
      if (!r.ok) {
        setRecado(r.erro);
        return;
      }

      // BOM na frente para o Excel abrir acento certo. Sem ele, "Bancária"
      // chega como "BancÃ¡ria" e o Sérgio acha que o site gravou errado.
      const blob = new Blob(['﻿' + r.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'assinantes-newsletter.csv';
      link.click();
      URL.revokeObjectURL(url);
      setRecado(`${r.linhas} ${r.linhas === 1 ? 'assinante baixado' : 'assinantes baixados'}.`);
    });
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Assinantes da newsletter</h1>
          <p className={styles.subtitulo}>
            {total === 0
              ? 'Ninguém se cadastrou ainda.'
              : `${total} ${total === 1 ? 'pessoa' : 'pessoas'}, ${comTelefone} com telefone`}
          </p>
        </div>
        <button type="button" className={styles.baixar} onClick={baixar} disabled={baixando || total === 0}>
          {baixando ? 'Preparando...' : 'Baixar CSV'}
        </button>
      </header>

      {total === 0 ? (
        <p className={styles.explicacao}>
          O pop-up da home pede o e-mail depois de 8 segundos. Até 02/10 ele mostrava
          &quot;Voou&quot; e descartava o endereço: quem se cadastrou nesses quase quatro meses
          se perdeu, e não dá para recuperar. A partir de agora cai aqui.
        </p>
      ) : (
        <>
          <div className={styles.resumo}>
            {porArea.map(([nome, quantos]) => (
              <span key={nome} className={styles.fatia}>
                <strong>{quantos}</strong> {nome}
              </span>
            ))}
          </div>

          <div className={styles.filtros}>
            <input
              type="search"
              className={styles.input}
              placeholder="Buscar por e-mail ou telefone"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar assinante"
            />
            <select
              className={styles.input}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              aria-label="Filtrar por área"
            >
              <option value="">Todas as áreas</option>
              {AREAS_DE_CONCURSO.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {recado && <p className={styles.recado}>{recado}</p>}

          <p className={styles.medida}>
            {visiveis.length === assinantes.length
              ? `Mostrando ${assinantes.length}${total > assinantes.length ? ` dos ${total} (os mais recentes)` : ''}`
              : `${visiveis.length} de ${assinantes.length} nesta tela`}
          </p>

          <ul className={styles.lista}>
            {visiveis.map((a) => (
              <li key={a.email} className={styles.item}>
                <span className={styles.email}>{a.email}</span>
                <span className={styles.telefone}>{telefoneLegivel(a.telefone) || '—'}</span>
                <span className={styles.area}>{a.area ?? '—'}</span>
                <span className={styles.quando}>{data(a.criadoEm)}</span>
                {/* o estado no Resend só vira selo quando algo deu errado ou
                    quando subiu: "ainda não subiu" é o normal enquanto a chave
                    não existir, e poluir a lista com isso não ajuda ninguém */}
                {a.erroDoResend ? (
                  <span className={styles.falhou} title={a.erroDoResend}>
                    Resend recusou
                  </span>
                ) : a.noResend ? (
                  <span className={styles.subiu}>no Resend</span>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
