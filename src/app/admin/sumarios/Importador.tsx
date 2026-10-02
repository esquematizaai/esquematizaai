'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { lerSumarioColado } from '@/lib/sumario-colado';
import { importarSumario } from './actions';
import styles from './page.module.css';

export type MaterialOpcao = { id: string; nome: string };

/**
 * Colar o sumário inteiro de uma vez.
 *
 * O PEDIDO QUE GEROU ISTO, do Sérgio: "preciso criar um novo material no site,
 * porém eu travo na parte de colocar o sumário". No Tecnologia da Informação
 * seriam 4 disciplinas criadas à mão e 88 linhas digitadas uma a uma; no
 * SEFAZ-AL, 16 disciplinas e 183 linhas. E depois outra tela para ligar tudo ao
 * material, que é justamente o passo que ele esqueceu no SEFAZ-AL e deixou o
 * trabalho inteiro invisível no site.
 *
 * ELE CONFERE ANTES DE GRAVAR, SEMPRE. A leitura acontece enquanto ele digita e
 * mostra o que foi entendido: quantas disciplinas, quantos módulos, quantos
 * assuntos em cada uma. Palpite silencioso em 183 linhas é criar dezesseis
 * disciplinas erradas sem ninguém perceber.
 */
export default function Importador({ materiais }: { materiais: MaterialOpcao[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [formato, setFormato] = useState<'' | 'Resumo' | 'Flashcards'>('');
  const [produto, setProduto] = useState('');
  const [recado, setRecado] = useState<{ texto: string; erro: boolean } | null>(null);
  const [gravando, iniciar] = useTransition();

  // a mesma função que a Server Action usa para valer: o que ele vê conferido
  // na tela é exatamente o que vai ser gravado
  const lido = useMemo(() => lerSumarioColado(texto), [texto]);

  const formatoEscolhido = formato || lido.formatoProvavel || '';

  function importar() {
    if (!formatoEscolhido) {
      setRecado({ texto: 'Escolha se o material é de Resumos ou de Flashcards.', erro: true });
      return;
    }

    iniciar(async () => {
      const dados = new FormData();
      dados.set('texto', texto);
      dados.set('formato', formatoEscolhido);
      dados.set('produto', produto);

      const r = await importarSumario(dados);
      if (!r.ok) {
        setRecado({ texto: r.erro ?? 'Não deu para importar.', erro: true });
        return;
      }

      const quantas = lido.disciplinas.length;
      setRecado({
        texto: produto
          ? `${quantas} ${quantas === 1 ? 'disciplina entrou' : 'disciplinas entraram'} e já estão ligadas ao material.`
          : `${quantas} ${quantas === 1 ? 'disciplina entrou' : 'disciplinas entraram'}. Falta ligar ao material, em Cursos.`,
        erro: false,
      });
      setTexto('');
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <button type="button" className={styles.btnSecundario} onClick={() => setAberto(true)}>
        Colar sumário inteiro
      </button>
    );
  }

  return (
    <section className={styles.importador}>
      <header className={styles.importadorTopo}>
        <h2 className={styles.importadorTitulo}>Colar sumário inteiro</h2>
        <button type="button" className={styles.btnSecundario} onClick={() => setAberto(false)}>
          Fechar
        </button>
      </header>

      <p className={styles.importadorAjuda}>
        Cole o sumário do jeito que você já escreve para a página de venda. Cada disciplina com o
        nome numa linha, os módulos embaixo dela e os assuntos embaixo de cada módulo. Confira o
        que eu entendi antes de gravar.
      </p>

      <textarea
        className={styles.textarea}
        rows={12}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={
          'Ciência de Dados · 287 páginas\n\nMódulo 1 ✅ acesso imediato (75 páginas)\n1. Dado, informação, conhecimento e inteligência\n2. Dados estruturados e não estruturados\n\nMódulo 2 ⏳ liberado após 8 dias (62 páginas)\n3. Modelagem dimensional'
        }
      />

      {texto.trim() && (
        <div className={styles.conferencia}>
          <p className={styles.conferenciaTitulo}>
            {lido.disciplinas.length === 0
              ? 'Não reconheci nenhuma disciplina ainda.'
              : `Entendi ${lido.disciplinas.length} ${lido.disciplinas.length === 1 ? 'disciplina' : 'disciplinas'}:`}
          </p>

          <ul className={styles.conferenciaLista}>
            {lido.disciplinas.map((d) => {
              const modulos = d.linhas.filter((l) => /^(M[óo]dulo|📝)/i.test(l)).length;
              return (
                <li key={d.nome}>
                  <strong>{d.nome}</strong>
                  <span>
                    {d.medida ? `${d.medida.toLocaleString('pt-BR')} ${d.unidade}` : 'sem medida'}
                    {' · '}
                    {modulos > 0 ? `${modulos} ${modulos === 1 ? 'módulo' : 'módulos'} · ` : ''}
                    {d.linhas.length - modulos} assuntos
                  </span>
                </li>
              );
            })}
          </ul>

          {/* aviso é o que eu não entendi, e precisa aparecer antes de gravar e
              não depois: é a diferença entre conferir e descobrir */}
          {lido.avisos.length > 0 && (
            <ul className={styles.avisos}>
              {lido.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.importadorCampos}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>O material é de</span>
          <select
            className={styles.select}
            value={formatoEscolhido}
            onChange={(e) => setFormato(e.target.value as 'Resumo' | 'Flashcards')}
          >
            <option value="">Escolha</option>
            <option value="Resumo">Resumos</option>
            <option value="Flashcards">Flashcards</option>
          </select>
          {!formato && lido.formatoProvavel && (
            <span className={styles.dica}>
              deduzi pelo texto, que fala em {lido.formatoProvavel === 'Resumo' ? 'páginas' : 'cards'}
            </span>
          )}
        </label>

        <label className={styles.campo}>
          <span className={styles.rotulo}>Ligar ao material</span>
          <select className={styles.select} value={produto} onChange={(e) => setProduto(e.target.value)}>
            <option value="">Não ligar agora</option>
            {materiais.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          <span className={styles.dica}>
            {produto
              ? 'a lista de disciplinas desse material será refeita com estas'
              : 'sem isto, o sumário não aparece na página de nenhum produto'}
          </span>
        </label>
      </div>

      {recado && (
        <p className={recado.erro ? styles.erro : styles.sucesso}>{recado.texto}</p>
      )}

      <button
        type="button"
        className={styles.btnPrimario}
        onClick={importar}
        disabled={gravando || lido.disciplinas.length === 0}
      >
        {gravando ? 'Importando...' : `Importar ${lido.disciplinas.length || ''}`.trim()}
      </button>

      <p className={styles.importadorAjuda}>
        Disciplina que já existir com o mesmo nome e formato tem os assuntos <strong>trocados</strong> pelos
        destes aqui.
      </p>
    </section>
  );
}
