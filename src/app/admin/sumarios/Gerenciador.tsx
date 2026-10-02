'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { salvarSumario, devolverParaPlanilha, salvarArea, criarDisciplina } from './actions';
import Importador, { type MaterialOpcao } from './Importador';
export type { MaterialOpcao };
import styles from './page.module.css';

export interface DisciplinaAdmin {
  id: string;
  nome: string;
  formato: 'Resumo' | 'Flashcards';
  area: string | null;
  paginas: number | null;
  cards: number | null;
  /** true = o painel manda nesta; false = ainda segue a planilha */
  adotada: boolean;
  /** o que a página de vendas mostra hoje */
  topicos: string[];
  /** o da planilha, sempre, para comparar e para o botão de voltar */
  topicosDaPlanilha: string[];
  atualizadoEm: string | null;
  atualizadoPor: string | null;
}

const AREAS = ['Fiscal', 'Gestão e Controle', 'Policial', 'Tribunal', 'Bancária', 'Legislativo'];

export default function Gerenciador({
  itens,
  materiais,
}: {
  itens: DisciplinaAdmin[];
  materiais: MaterialOpcao[];
}) {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'planilha' | 'painel' | 'sem-area'>('todas');
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [aviso, setAviso] = useState<{ id: string; texto: string; erro: boolean } | null>(null);
  const [salvando, iniciar] = useTransition();

  const visiveis = useMemo(() => {
    const termo = busca
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();

    return itens.filter((d) => {
      if (filtro === 'planilha' && d.adotada) return false;
      if (filtro === 'painel' && !d.adotada) return false;
      if (filtro === 'sem-area' && d.area) return false;
      if (!termo) return true;
      return d.nome
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .includes(termo);
    });
  }, [itens, busca, filtro]);

  const contagem = useMemo(
    () => ({
      total: itens.length,
      doPainel: itens.filter((d) => d.adotada).length,
      semArea: itens.filter((d) => !d.area).length,
    }),
    [itens],
  );

  const executar = (id: string, acao: (fd: FormData) => Promise<{ ok: boolean; erro?: string }>, fd: FormData) => {
    setAviso(null);
    iniciar(async () => {
      const r = await acao(fd);
      setAviso({ id, texto: r.ok ? 'Salvo. A página de vendas atualiza em até 1 minuto.' : (r.erro ?? 'Falhou.'), erro: !r.ok });
    });
  };

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Sumários das disciplinas</h1>
          <p className={styles.subtitulo}>
            {contagem.total} disciplinas. {contagem.doPainel} editadas aqui, {contagem.total - contagem.doPainel}{' '}
            ainda vindo da planilha.
          </p>
        </div>

        <button
          type="button"
          className={styles.salvar}
          onClick={() => {
            setCriando((v) => !v);
            setAbertaId(null);
            setAviso(null);
          }}
          aria-expanded={criando}
        >
          {criando ? 'Cancelar' : 'Nova disciplina'}
        </button>
      </header>

      {/* Colar o sumario inteiro resolve o "travo na parte do sumario": e o
          caminho de quem tem o texto pronto. "Nova disciplina", acima, continua
          sendo o caminho de quem vai digitar uma so. */}
      <Importador materiais={materiais} />

      {aviso?.id === 'nova' && (
        <p className={aviso.erro ? styles.erro : styles.sucesso}>{aviso.texto}</p>
      )}

      {/* Cadastrar disciplina que não existe na planilha. Nasce já mantida
          aqui, porque não tem de onde herdar. */}
      {criando && (
        <div className={styles.item}>
          <div className={styles.editor}>
            <form
              action={(fd) => {
                setAviso(null);
                iniciar(async () => {
                  const r = await criarDisciplina(fd);
                  setAviso({
                    id: 'nova',
                    texto: r.ok ? 'Disciplina cadastrada.' : (r.erro ?? 'Falhou.'),
                    erro: !r.ok,
                  });
                  if (r.ok) {
                    setCriando(false);
                    // a lista vem do servidor: sem isso a disciplina recém
                    // cadastrada só apareceria no próximo carregamento
                    router.refresh();
                  }
                });
              }}
            >
              <label className={styles.rotulo} htmlFor="nova-nome">
                Nome da disciplina
              </label>
              <input
                id="nova-nome"
                name="nome"
                className={styles.input}
                style={{ width: '100%', minWidth: 0 }}
                placeholder="Direito Ambiental"
                required
              />

              <div className={styles.camposLado}>
                <label className={styles.campo}>
                  <span className={styles.rotulo}>Formato</span>
                  <select name="formato" className={styles.select} defaultValue="Flashcards">
                    <option value="Flashcards">Flashcards</option>
                    <option value="Resumo">Resumo</option>
                  </select>
                </label>

                <label className={styles.campo}>
                  <span className={styles.rotulo}>Área</span>
                  <select name="area" className={styles.select} defaultValue="">
                    <option value="">sem área</option>
                    {AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.campo}>
                  <span className={styles.rotulo}>Páginas ou cards</span>
                  <input type="number" name="medida" min={0} className={styles.input} />
                </label>
              </div>

              <label className={styles.rotulo} htmlFor="nova-topicos">
                Tópicos, um por linha
              </label>
              <textarea
                id="nova-topicos"
                name="topicos"
                className={styles.textarea}
                rows={10}
                placeholder={'01. Princípios\n02. Licenciamento ambiental'}
                required
              />

              <div className={styles.acoes}>
                <button type="submit" className={styles.salvar} disabled={salvando}>
                  {salvando ? 'Cadastrando...' : 'Cadastrar disciplina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Explicação curta e no lugar certo: sem ela, alguém edita achando que
          está mudando a planilha, e depois não entende por que a reimportação
          não desfez nada. */}
      <p className={styles.explicacao}>
        Enquanto ninguém edita uma disciplina, ela segue a planilha e as importações atualizam ela
        normalmente. Ao salvar, ela passa a ser mantida por aqui e a planilha para de mexer nela.
        Dá para voltar atrás a qualquer momento.
      </p>

      <div className={styles.controles}>
        <input
          type="search"
          className={styles.busca}
          placeholder="Buscar disciplina"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <div className={styles.filtros}>
          {(
            [
              ['todas', `Todas (${contagem.total})`],
              ['planilha', `Da planilha (${contagem.total - contagem.doPainel})`],
              ['painel', `Editadas aqui (${contagem.doPainel})`],
              ['sem-area', `Sem área (${contagem.semArea})`],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              className={`${styles.filtro} ${filtro === valor ? styles.filtroAtivo : ''}`}
              onClick={() => setFiltro(valor)}
              aria-pressed={filtro === valor}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <ul className={styles.lista}>
        {visiveis.map((d) => {
          const aberta = abertaId === d.id;
          const medida = d.formato === 'Resumo' ? d.paginas : d.cards;
          const rotuloMedida = d.formato === 'Resumo' ? 'páginas' : 'cards';

          return (
            <li key={d.id} className={styles.item}>
              <div className={styles.linha}>
                <button
                  type="button"
                  className={styles.abrir}
                  onClick={() => setAbertaId(aberta ? null : d.id)}
                  aria-expanded={aberta}
                >
                  <span className={styles.nome}>{d.nome}</span>
                  <span className={`${styles.marca} ${d.formato === 'Resumo' ? styles.marcaResumo : styles.marcaFlash}`}>
                    {d.formato}
                  </span>
                  <span className={styles.medida}>
                    {d.topicos.length} tópicos
                    {medida ? ` · ${medida} ${rotuloMedida}` : ''}
                  </span>
                  <span className={`${styles.origem} ${d.adotada ? styles.origemPainel : ''}`}>
                    {d.adotada ? 'editada aqui' : 'da planilha'}
                  </span>
                  <span className={styles.area}>{d.area ?? 'sem área'}</span>
                  <span className={styles.seta} aria-hidden="true">
                    {aberta ? '▴' : '▾'}
                  </span>
                </button>
              </div>

              {aberta && (
                <div className={styles.editor}>
                  <form
                    action={(fd) => {
                      fd.set('id', d.id);
                      fd.set('formato', d.formato);
                      executar(d.id, salvarSumario, fd);
                    }}
                  >
                    <label className={styles.rotulo} htmlFor={`topicos-${d.id}`}>
                      Tópicos, um por linha
                    </label>
                    <textarea
                      id={`topicos-${d.id}`}
                      name="topicos"
                      className={styles.textarea}
                      rows={Math.min(24, Math.max(8, d.topicos.length + 2))}
                      defaultValue={d.topicos.join('\n')}
                      spellCheck
                    />

                    <div className={styles.camposLado}>
                      <label className={styles.campo}>
                        <span className={styles.rotulo}>Área</span>
                        <select name="area" defaultValue={d.area ?? ''} className={styles.select}>
                          <option value="">sem área</option>
                          {AREAS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.campo}>
                        <span className={styles.rotulo}>{d.formato === 'Resumo' ? 'Páginas' : 'Cards'}</span>
                        <input
                          type="number"
                          name="medida"
                          min={0}
                          defaultValue={medida ?? ''}
                          className={styles.input}
                        />
                      </label>
                    </div>

                    <div className={styles.acoes}>
                      <button type="submit" className={styles.salvar} disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Salvar sumário'}
                      </button>

                      {d.adotada && (
                        <button
                          type="button"
                          className={styles.desfazer}
                          disabled={salvando}
                          onClick={() => {
                            const fd = new FormData();
                            fd.set('id', d.id);
                            executar(d.id, devolverParaPlanilha, fd);
                          }}
                        >
                          Devolver para a planilha
                        </button>
                      )}

                      {!d.adotada && (
                        <button
                          type="button"
                          className={styles.desfazer}
                          disabled={salvando}
                          onClick={(e) => {
                            // todo botão dentro de um form tem .form: pega o
                            // valor atual da área sem sair caçando no DOM
                            const form = e.currentTarget.form;
                            if (!form) return;
                            const fd = new FormData(form);
                            fd.set('id', d.id);
                            executar(d.id, salvarArea, fd);
                          }}
                          title="Grava só a área, sem passar o sumário para o painel"
                        >
                          Salvar só a área
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Comparação, quando as duas versões existem e diferem: sem
                      isso a pessoa não tem como saber o que mudou em relação à
                      planilha antes de decidir se volta atrás. */}
                  {d.adotada && d.topicosDaPlanilha.length > 0 && (
                    <details className={styles.comparar}>
                      <summary>Ver o que a planilha tem ({d.topicosDaPlanilha.length} tópicos)</summary>
                      <pre className={styles.pre}>{d.topicosDaPlanilha.join('\n')}</pre>
                    </details>
                  )}

                  {d.atualizadoEm && (
                    <p className={styles.rodape}>
                      última alteração em {new Date(d.atualizadoEm).toLocaleString('pt-BR')}
                      {d.atualizadoPor ? ` por ${d.atualizadoPor}` : ''}
                    </p>
                  )}

                  {aviso?.id === d.id && (
                    <p className={aviso.erro ? styles.erro : styles.sucesso}>{aviso.texto}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {visiveis.length === 0 && <p className={styles.vazio}>Nenhuma disciplina com esse filtro.</p>}
    </div>
  );
}
