'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { editarMaterialDoPainel, salvarAjuste, limparAjuste, criarMaterial, apagarMaterialDoPainel, trocarCapaDoPainel } from './actions';
import CapaUpload from './CapaUpload';
import PainelScript from './PainelScript';
import styles from './page.module.css';

export type ItemAdmin = {
  id: string;
  nome: string;
  categoria: string;
  area: string | null;
  ferramenta: string | null;
  precoPlanilha: number | null;
  precoAjustado: number | null;
  /** preço riscado ao lado do cobrado; null = sem risco */
  precoDe: number | null;
  temCheckout: boolean;
  vendavel: boolean;
  descricaoAjustada: string | null;
  observacao: string | null;
  oculto: boolean;
  destaque: boolean;
  /** posição manual na vitrine; null = ordenação automática */
  ordem: number | null;
  /** link de compra que vem da planilha */
  checkoutPlanilha: string | null;
  /** link de compra trocado no painel; null = usa o da planilha */
  checkoutAjustado: string | null;
  ajustadoEm: string | null;
};

/** Material criado aqui no painel, que não existe na planilha. */
export type MaterialDoPainel = {
  id: string;
  nome: string;
  categoria: string;
  area: string | null;
  ferramenta: string | null;
  preco: number;
  precoDe: number | null;
  checkout: string | null;
  urlSite: string | null;
  capaUrl: string | null;
  descricao: string | null;
  oculto: boolean;
  criadoEm: string | null;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const SEGMENTOS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'combo', rotulo: 'Combos' },
  { valor: 'isolado', rotulo: 'Isolados' },
  { valor: 'assinatura', rotulo: 'Assinaturas' },
];

/**
 * O que dá para escrever na descrição, dito na hora de escrever.
 *
 * O Sérgio perguntou em 19/09 se o campo aceitava HTML, porque queria pôr cor.
 * Não aceita e não vai aceitar: HTML no campo do painel viraria código rodando
 * no site. Mas ele também não sabia que tinha Markdown, e ficava sem destaque
 * nenhum por não saber o que pedir.
 *
 * Cor livre continua fora de propósito: dez produtos com dez cores escolhidas
 * na hora acabam com a identidade visual e não tem volta fácil.
 *
 * LINK SAIU DESTA LISTA EM 22/09. Era o próprio painel ensinando a escrever o
 * que o Sérgio acabara de mandar tirar de 25 páginas: link no meio da descrição
 * manda embora quem chegou ali para decidir a compra. O aviso trocou de lado e
 * agora conta também o que acontece sozinho, porque endereço colado vira link
 * sem ninguém pedir e a pessoa não ia entender de onde saiu.
 */
function AjudaDeFormatacao() {
  return (
    <span className={styles.dicaForm}>
      Dá para formatar: <code>**negrito**</code>, <code>## título</code> e{' '}
      <code>- item de lista</code>. As caixas coloridas do blog também funcionam, como{' '}
      <code>:::importante</code> e <code>:::dica</code>. HTML não funciona, e é de propósito: as
      tags apareceriam escritas na página.
      <br />
      Não ponha link: ele tira da página quem está decidindo comprar. Endereço colado no meio do
      texto vira link sozinho, então escreva só o nome do material.
    </span>
  );
}

function normalizar(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Gerenciador({
  itens,
  criadosAqui,
  modeloDoScript,
  exportacaoDaLoja,
  hoje,
  quantosMateriais,
}: {
  itens: ItemAdmin[];
  criadosAqui: MaterialDoPainel[];
  /** texto do modelo que o Sérgio manda para o Claude dele preencher */
  modeloDoScript: string;
  /** a loja inteira, para consulta; montada no servidor, só sai daqui */
  exportacaoDaLoja: string;
  /** data de hoje no formato de nome de arquivo */
  hoje: string;
  quantosMateriais: number;
}) {
  const router = useRouter();
  const [apagando, setApagando] = useState<string | null>(null);
  const [trocandoCapa, setTrocandoCapa] = useState<string | null>(null);
  const [editandoPainel, setEditandoPainel] = useState<MaterialDoPainel | null>(null);
  const [busca, setBusca] = useState('');
  const [segmento, setSegmento] = useState('todos');
  const [soAjustados, setSoAjustados] = useState(false);
  const [editando, setEditando] = useState<ItemAdmin | null>(null);
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);
  const [avisoNovo, setAvisoNovo] = useState('');
  const [salvando, iniciar] = useTransition();

  /**
   * O botão "+" do canto manda para cá com ?novo=1 e o formulário já abre.
   *
   * Sem isto ele levaria a pessoa até a tela e a deixaria procurando o botão de
   * cadastrar, que é exatamente o que ela acabou de clicar. O parâmetro sai da
   * barra de endereços depois de abrir, para recarregar a página não reabrir o
   * formulário sozinho.
   */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('novo') !== '1') return;
    setCriando(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const foiAjustado = (i: ItemAdmin) =>
    i.precoAjustado !== null ||
    i.descricaoAjustada !== null ||
    i.checkoutAjustado !== null ||
    i.oculto ||
    i.destaque;

  const lista = useMemo(() => {
    const termo = normalizar(busca.trim());
    return itens.filter((i) => {
      if (segmento !== 'todos' && i.categoria !== segmento) return false;
      if (soAjustados && !foiAjustado(i)) return false;
      if (termo && !normalizar(i.nome).includes(termo)) return false;
      return true;
    });
  }, [itens, busca, segmento, soAjustados]);

  const totalAjustados = itens.filter(foiAjustado).length;
  const totalOcultos = itens.filter((i) => i.oculto).length;

  const salvar = (formData: FormData) => {
    setErro('');
    iniciar(async () => {
      const r = await salvarAjuste(formData);
      if (!r.ok) { setErro(r.erro ?? 'Não foi possível salvar.'); return; }
      setEditando(null);
      router.refresh();
    });
  };

  const restaurar = (i: ItemAdmin) => {
    if (!confirm(`Desfazer os ajustes de "${i.nome}" e voltar ao que a planilha diz?`)) return;
    iniciar(async () => {
      await limparAjuste(i.id);
      setEditando(null);
      router.refresh();
    });
  };

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Materiais</h1>
          <p className={styles.subtitulo}>
            {itens.length} produtos do catálogo. {totalAjustados} com ajuste, {totalOcultos} ocultos.
          </p>
        </div>

        <button
          type="button"
          className={styles.btnPrimario}
          onClick={() => {
            setCriando((v) => !v);
            setEditando(null);
            setErro('');
            setAvisoNovo('');
          }}
          aria-expanded={criando}
        >
          {criando ? 'Cancelar' : 'Novo material'}
        </button>
      </header>

      {avisoNovo && <p className={styles.sucessoNovo}>{avisoNovo}</p>}

      <PainelScript
        modelo={modeloDoScript}
        exportacao={exportacaoDaLoja}
        hoje={hoje}
        quantosMateriais={quantosMateriais}
      />

      {/* Cadastro de material que ainda não existe na planilha. Até agora isso
          dependia de mandar a planilha e alguém rodar a importação, e nesta
          semana deixou produto lançado dias fora do ar. */}
      {criando && (
        <form
          className={styles.formNovo}
          action={(fd) => {
            setErro('');
            iniciar(async () => {
              const r = await criarMaterial(fd);
              if (r.ok) {
                setCriando(false);
                setAvisoNovo('Material cadastrado. A vitrine mostra em até 1 minuto.');
                router.refresh();
              } else {
                setErro(r.erro ?? 'Falhou.');
              }
            });
          }}
        >
          <p className={styles.dicaForm}>
            A planilha continua mandando: quando esse material aparecer nela, o cadastro daqui sai
            de cena sozinho e ninguém precisa apagar nada.
          </p>

          <label className={styles.campoLargo}>
            <span className={styles.rotulo}>Nome do material</span>
            <input name="nome" className={styles.input} required placeholder="Resumo Direito Ambiental" />
          </label>

          <div className={styles.linhaCampos}>
            <label className={styles.campo}>
              <span className={styles.rotulo}>Tipo</span>
              <select name="categoria" className={styles.input} defaultValue="isolado">
                <option value="isolado">Material isolado</option>
                <option value="combo">Combo</option>
                <option value="assinatura">Assinatura</option>
              </select>
            </label>

            <label className={styles.campo}>
              <span className={styles.rotulo}>Área</span>
              <select name="area" className={styles.input} defaultValue="">
                <option value="">sem área</option>
                {['Fiscal', 'Controle', 'Policial', 'Tribunais', 'Bancária', 'Legislativo'].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.campo}>
              <span className={styles.rotulo}>Ferramenta</span>
              <select name="ferramenta" className={styles.input} defaultValue="">
                <option value="">não informar</option>
                {['Resumo', 'Flashcards', 'Vade Mecum', 'Questões Inéditas', 'R + F + Q + V'].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.linhaCampos}>
            <label className={styles.campo}>
              <span className={styles.rotulo}>Preço de venda</span>
              <input name="preco" className={styles.input} required placeholder="597" inputMode="decimal" />
            </label>

            <label className={styles.campo}>
              <span className={styles.rotulo}>Preço &quot;de&quot;, opcional</span>
              <input name="preco_de" className={styles.input} placeholder="997" inputMode="decimal" />
            </label>
          </div>

          <p className={styles.dicaForm}>
            <strong>O caminho de compra é obrigatório</strong>, e serve qualquer um dos dois. Sem
            um deles o botão de comprar não teria para onde ir.
          </p>

          <div className={styles.linhaCampos}>
            <label className={styles.campo}>
              <span className={styles.rotulo}>Link do checkout</span>
              <input name="checkout" className={styles.input} placeholder="eduzz, tutory, loja... cole o endereço" />
            </label>

            <label className={styles.campo}>
              <span className={styles.rotulo}>Link da página de vendas</span>
              <input
                name="url_site"
                className={styles.input}
                placeholder="esquematizaai.com/produto/..."
              />
            </label>
          </div>

          <CapaUpload />

          <label className={styles.campoLargo}>
            <span className={styles.rotulo}>Descrição, opcional</span>
            <textarea name="descricao" className={styles.input} rows={4} />
            <span className={styles.dicaForm}>
              Com o link da página de vendas preenchido, a descrição, o cronograma e o FAQ entram
              sozinhos na próxima raspagem. Sem ele, o que estiver escrito aqui é tudo que a página
              vai ter.
            </span>
            <AjudaDeFormatacao />
          </label>

          <div className={styles.acoesForm}>
            <button type="submit" className={styles.btnPrimario} disabled={salvando}>
              {salvando ? 'Cadastrando...' : 'Cadastrar material'}
            </button>
          </div>
        </form>
      )}

      {/* Recado que evita o mal-entendido mais caro desta tela: achar que
          editar aqui muda a planilha, ou que a planilha vai apagar o ajuste. */}
      <p className={styles.dica}>
        O catálogo vem da planilha do Sérgio. O que você mudar aqui vira um ajuste que fica
        <strong> por cima</strong> dela: reimportar a planilha não apaga o que foi editado, e
        &quot;Voltar ao valor da planilha&quot; desfaz o ajuste a qualquer momento.
      </p>

      <div className={styles.filtros}>
        <input
          className={styles.busca}
          type="search"
          placeholder="Buscar pelo nome do material..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className={styles.chips}>
          {SEGMENTOS.map((s) => (
            <button
              key={s.valor}
              type="button"
              className={`${styles.chip} ${segmento === s.valor ? styles.chipAtivo : ''}`}
              onClick={() => setSegmento(s.valor)}
            >
              {s.rotulo}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.chip} ${soAjustados ? styles.chipAtivo : ''}`}
            onClick={() => setSoAjustados((v) => !v)}
          >
            Só os ajustados
          </button>
        </div>
      </div>

      {editando && (
        <form action={salvar} className={styles.formulario}>
          <input type="hidden" name="produto_id" value={editando.id} />
          <h2 className={styles.formTitulo}>{editando.nome}</h2>
          <p className={styles.formId}>{editando.id}</p>

          <div className={styles.linha}>
            <label className={styles.campo}>
              <span className={styles.rotulo}>
                Preço{' '}
                <em className={styles.ajuda}>
                  planilha: {editando.precoPlanilha !== null ? brl.format(editando.precoPlanilha) : 'sem preço'}
                </em>
              </span>
              <input
                className={styles.input}
                name="preco"
                defaultValue={editando.precoAjustado ?? ''}
                placeholder="deixe vazio para usar o da planilha"
              />
            </label>

            {/* O PRECO RISCADO SO EXISTIA NO FORMULARIO DE CRIAR MATERIAL.
                Quem edita material da planilha achava o preco e nao achava o
                "de": ele morava numa lista escrita no codigo, e so eu mexia. O
                Sergio topou com isso em 05/10, depois de mudar o preco sozinho
                e nao conseguir riscar o valor antigo. */}
            <label className={styles.campo}>
              <span className={styles.rotulo}>
                Preço &quot;de&quot;, riscado <em className={styles.ajuda}>opcional</em>
              </span>
              <input
                className={styles.input}
                name="preco_de"
                inputMode="decimal"
                defaultValue={editando.precoDe ?? ''}
                placeholder="vazio = sem risco"
              />
              <span className={styles.ajuda}>
                Aparece riscado ao lado do preço, com a porcentagem de desconto. Precisa ser
                MAIOR que o preço de venda. Só coloque valor pelo qual o material já foi
                vendido de verdade: riscar preço que nunca existiu é propaganda enganosa.
              </span>
            </label>

            <label className={styles.campo}>
              <span className={styles.rotulo}>Posição na vitrine</span>
              <input
                className={styles.input}
                name="ordem"
                inputMode="numeric"
                defaultValue={editando.ordem ?? ''}
                placeholder="vazio = deixa o site decidir"
              />
              <span className={styles.ajuda}>
                Quem tem número aparece primeiro, do menor para o maior. Para colocar dois
                materiais na frente, dê 1 a um e 2 ao outro; o resto da vitrine se organiza
                sozinho depois deles.
              </span>
            </label>

            <div className={styles.campo}>
              <span className={styles.rotulo}>Exibição</span>
              {/* O rótulo dizia só "Destacar na vitrine", e desde 23/09 esta
                  caixinha faz mais do que isso: é ela que escolhe o carrossel
                  da primeira tela da home. Era o que o Sérgio pediu sem saber
                  que já existia, perguntando "como faço para editar os cursos
                  aqui?". Um controle que faz duas coisas precisa dizer as duas,
                  senão ele marca e não entende o que mudou. */}
              <label className={styles.check}>
                <input type="checkbox" name="destaque" defaultChecked={editando.destaque} />
                <span>
                  Destacar
                  <em className={styles.dicaCheck}>
                    entra no carrossel da primeira tela da home, até 6 materiais, na ordem do
                    campo Posição acima. Na vitrine, vem à frente de quem não tem Posição.
                  </em>
                </span>
              </label>
              <label className={styles.check}>
                <input type="checkbox" name="oculto" defaultChecked={editando.oculto} />
                Ocultar do site
              </label>
            </div>
          </div>

          {/* O link de compra, que é a única coisa que o site decide por
              produto: ele não cobra, não entrega, só redireciona. Era a única
              que o Sérgio não conseguia mudar sozinho, e ele precisa, porque
              usa plataformas diferentes em produtos diferentes. */}
          <label className={styles.campoLargo}>
            <span className={styles.rotulo}>
              Link de compra{' '}
              <em className={styles.ajuda}>
                {editando.checkoutPlanilha
                  ? `planilha: ${editando.checkoutPlanilha}`
                  : 'a planilha não tem link; hoje o botão leva para a página de vendas'}
              </em>
            </span>
            <input
              className={styles.input}
              name="checkout"
              defaultValue={editando.checkoutAjustado ?? ''}
              placeholder="deixe vazio para usar o da planilha"
            />
            <span className={styles.dicaForm}>
              Para onde o botão de comprar manda. Serve para trocar a plataforma de pagamento de um
              material sem mexer em mais nada. Apagar o campo devolve o link da planilha.
            </span>
          </label>

          <label className={styles.campo}>
            <span className={styles.rotulo}>
              Descrição <em className={styles.ajuda}>vazio = usa a da página de vendas</em>
            </span>
            <textarea
              className={styles.textarea}
              name="descricao"
              rows={4}
              defaultValue={editando.descricaoAjustada ?? ''}
            />
            <AjudaDeFormatacao />
          </label>

          <label className={styles.campo}>
            <span className={styles.rotulo}>
              Observação interna <em className={styles.ajuda}>não aparece no site</em>
            </span>
            <input
              className={styles.input}
              name="observacao"
              defaultValue={editando.observacao ?? ''}
              placeholder="ex.: preço combinado com o Sérgio em 30/07"
            />
          </label>

          {erro && <p className={styles.erro}>{erro}</p>}

          <div className={styles.acoesForm}>
            <button type="submit" className={styles.btnPrimario} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar ajuste'}
            </button>
            <button
              type="button"
              className={styles.btnSecundario}
              onClick={() => { setEditando(null); setErro(''); }}
              disabled={salvando}
            >
              Cancelar
            </button>
            {foiAjustado(editando) && (
              <button
                type="button"
                className={styles.btnRestaurar}
                onClick={() => restaurar(editando)}
                disabled={salvando}
              >
                Voltar ao valor da planilha
              </button>
            )}
          </div>
        </form>
      )}

      {/* Os criados aqui vêm ANTES da lista da planilha, e separados.
          A tela mostrava só os 197 da planilha, então o material que o Sérgio
          cadastrou em 18/09 existia no site e não aparecia no painel: sem jeito
          de ver, corrigir nem apagar. São poucos e são os que mudam, por isso
          ficam no topo. */}
      {criadosAqui.length > 0 && (
        <section className={styles.secaoPainel}>
          <h2 className={styles.tituloSecao}>
            Cadastrados aqui no painel ({criadosAqui.length})
          </h2>
          <p className={styles.subtituloSecao}>
            Estes não vêm da planilha. Quando a planilha trouxer o mesmo material,
            casado pelo link de compra, o daqui sai de cena sozinho.
          </p>

          <div className={styles.lista}>
            {criadosAqui.map((m) => (
              <article key={m.id} className={`${styles.item} ${m.oculto ? styles.itemOculto : ''}`}>
                <div className={styles.itemTexto}>
                  <div className={styles.itemTopo}>
                    <span className={styles.seloPainel}>Do painel</span>
                    <span className={styles.selo}>{m.categoria}</span>
                    {m.area && <span className={styles.seloArea}>{m.area}</span>}
                    {m.oculto && <span className={styles.seloOculto}>Oculto</span>}
                  </div>
                  <h2 className={styles.itemTitulo}>{m.nome}</h2>
                  <p className={styles.itemPreco}>
                    <span className={styles.precoNovo}>{brl.format(m.preco)}</span>
                    {m.precoDe != null && (
                      <span className={styles.precoAntigo}>de {brl.format(m.precoDe)}</span>
                    )}
                  </p>
                  <p className={styles.itemEndereco}>/vitrine/produto/{m.id}</p>
                </div>

                <div className={styles.itemAcoes}>
                  {/* ATÉ 06/10 ESTE BOTÃO NÃO EXISTIA. Material cadastrado no
                      painel só aceitava troca de capa depois de criado: preço,
                      descrição e checkout não tinham onde mexer. O Sérgio
                      concluiu, com razão, que precisaria criar um produto novo
                      para corrigir um texto. */}
                  <button
                    type="button"
                    className={styles.btnLinha}
                    onClick={() => {
                      setEditandoPainel(editandoPainel?.id === m.id ? null : m);
                      setErro('');
                    }}
                    aria-expanded={editandoPainel?.id === m.id}
                  >
                    Ajustar
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecundario}
                    onClick={() => setTrocandoCapa(trocandoCapa === m.id ? null : m.id)}
                    aria-expanded={trocandoCapa === m.id}
                  >
                    {m.capaUrl ? 'Trocar capa' : 'Pôr capa'}
                  </button>
                  <a
                    className={styles.btnSecundario}
                    href={`/vitrine/produto/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver no site
                  </a>
                  <button
                    type="button"
                    className={styles.btnPerigo}
                    disabled={apagando === m.id}
                    onClick={() => {
                      // confirmação com o endereço escrito: apagar é definitivo
                      // e leva a página junto, e o nome sozinho não deixa isso
                      // óbvio para quem cadastrou dez materiais parecidos
                      const certeza = window.confirm(
                        `Apagar "${m.nome}" de vez?\n\nO endereço /vitrine/produto/${m.id} deixa de existir. Isso não tem desfazer.`,
                      );
                      if (!certeza) return;
                      setApagando(m.id);
                      setErro('');
                      iniciar(async () => {
                        const r = await apagarMaterialDoPainel(m.id);
                        setApagando(null);
                        if (!r.ok) return setErro(r.erro ?? 'Não foi possível apagar.');
                        setAvisoNovo(`"${m.nome}" foi apagado.`);
                        router.refresh();
                      });
                    }}
                  >
                    {apagando === m.id ? 'Apagando...' : 'Apagar'}
                  </button>
                </div>

                {/* A capa fica aqui e não no script de propósito: um Claude de
                    chat não consegue produzir endereço do nosso armazenamento,
                    e link de fora derrubaria a página. Resolvendo na lista,
                    serve para os dois caminhos de cadastro e também para
                    trocar uma capa feia meses depois. */}
                {trocandoCapa === m.id && (
                  <form
                    className={styles.formCapa}
                    action={(fd) => {
                      fd.set('id', m.id);
                      setErro('');
                      iniciar(async () => {
                        const r = await trocarCapaDoPainel(fd);
                        if (!r.ok) return setErro(r.erro ?? 'Não foi possível trocar a capa.');
                        setTrocandoCapa(null);
                        setAvisoNovo(`Capa de "${m.nome}" atualizada.`);
                        router.refresh();
                      });
                    }}
                  >
                    <CapaUpload />
                    <div className={styles.acoesForm}>
                      <button type="submit" className={styles.btnPrimario} disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Salvar a capa'}
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecundario}
                        onClick={() => setTrocandoCapa(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {editandoPainel?.id === m.id && (
                  <form
                    className={styles.formEdicao}
                    action={(fd) => {
                      fd.set('id', m.id);
                      setErro('');
                      iniciar(async () => {
                        const r = await editarMaterialDoPainel(fd);
                        if (!r.ok) return setErro(r.erro ?? 'Não foi possível salvar.');
                        setEditandoPainel(null);
                        setAvisoNovo(`"${m.nome}" foi atualizado.`);
                        router.refresh();
                      });
                    }}
                  >
                    {/* O endereço não está aqui de propósito: mudar o endereço
                        de uma página que já está no ar quebra link
                        compartilhado, anúncio apontando para lá e o que o
                        Google indexou. Renomear material é comum; mudar o
                        endereço dele não. */}
                    <p className={styles.formId}>/vitrine/produto/{m.id}</p>

                    <label className={styles.campo}>
                      <span className={styles.rotulo}>Nome</span>
                      <input name="nome" className={styles.input} defaultValue={m.nome} required />
                    </label>

                    <div className={styles.linhaCampos}>
                      <label className={styles.campo}>
                        <span className={styles.rotulo}>Preço de venda</span>
                        <input name="preco" className={styles.input} defaultValue={m.preco} required inputMode="decimal" />
                      </label>
                      <label className={styles.campo}>
                        <span className={styles.rotulo}>Preço &quot;de&quot;, riscado</span>
                        <input name="preco_de" className={styles.input} defaultValue={m.precoDe ?? ''} inputMode="decimal" placeholder="vazio = sem risco" />
                      </label>
                    </div>

                    <div className={styles.linhaCampos}>
                      <label className={styles.campo}>
                        <span className={styles.rotulo}>Área</span>
                        <input name="area" className={styles.input} defaultValue={m.area ?? ''} />
                      </label>
                      <label className={styles.campo}>
                        <span className={styles.rotulo}>Ferramenta</span>
                        <input name="ferramenta" className={styles.input} defaultValue={m.ferramenta ?? ''} />
                      </label>
                      <label className={styles.campo}>
                        <span className={styles.rotulo}>Categoria</span>
                        <input name="categoria" className={styles.input} defaultValue={m.categoria} />
                      </label>
                    </div>

                    <label className={styles.campo}>
                      <span className={styles.rotulo}>Link do checkout</span>
                      <input name="checkout" className={styles.input} defaultValue={m.checkout ?? ''} placeholder="eduzz, tutory, loja... cole o endereço" />
                    </label>

                    <label className={styles.campo}>
                      <span className={styles.rotulo}>Link da página de vendas</span>
                      <input name="url_site" className={styles.input} defaultValue={m.urlSite ?? ''} />
                    </label>

                    <label className={styles.campo}>
                      <span className={styles.rotulo}>Descrição</span>
                      <textarea name="descricao" className={styles.textarea} rows={10} defaultValue={m.descricao ?? ''} />
                    </label>

                    <label className={styles.check}>
                      <input type="checkbox" name="oculto" defaultChecked={m.oculto} />
                      Ocultar do site
                    </label>

                    <div className={styles.acoesForm}>
                      <button type="submit" className={styles.btnPrimario} disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button type="button" className={styles.btnSecundario} onClick={() => setEditandoPainel(null)}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <p className={styles.contador}>{lista.length} de {itens.length}</p>

      <div className={styles.lista}>
        {lista.map((i) => (
          <article key={i.id} className={`${styles.item} ${i.oculto ? styles.itemOculto : ''}`}>
            <div className={styles.itemTexto}>
              <div className={styles.itemTopo}>
                <span className={styles.selo}>{i.categoria}</span>
                {i.area && <span className={styles.seloArea}>{i.area}</span>}
                {i.destaque && <span className={styles.seloDestaque}>Destaque</span>}
                {i.checkoutAjustado && <span className={styles.seloNeutro}>Link trocado</span>}
                {i.oculto && <span className={styles.seloOculto}>Oculto</span>}
                {!i.vendavel && <span className={styles.seloAlerta}>Sem destino de compra</span>}
                {!i.temCheckout && i.vendavel && (
                  <span className={styles.seloNeutro}>Vende pela loja</span>
                )}
              </div>

              <h2 className={styles.itemTitulo}>{i.nome}</h2>

              <p className={styles.itemPreco}>
                {i.precoAjustado !== null ? (
                  <>
                    <span className={styles.precoNovo}>{brl.format(i.precoAjustado)}</span>
                    <span className={styles.precoAntigo}>
                      planilha: {i.precoPlanilha !== null ? brl.format(i.precoPlanilha) : '—'}
                    </span>
                  </>
                ) : (
                  <span className={styles.precoNovo}>
                    {i.precoPlanilha !== null ? brl.format(i.precoPlanilha) : 'sem preço'}
                  </span>
                )}
              </p>

              {i.observacao && <p className={styles.itemObs}>{i.observacao}</p>}
            </div>

            <div className={styles.itemAcoes}>
              <button type="button" className={styles.btnLinha} onClick={() => { setEditando(i); setErro(''); }}>
                Ajustar
              </button>
              <a
                className={styles.btnLinha}
                href={`/vitrine/produto/${i.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no site
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
