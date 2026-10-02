/**
 * Entende o sumário que o Sérgio escreve, colado inteiro de uma vez.
 *
 * O QUE ISTO RESOLVE: "travo na parte de colocar o sumário". Para cadastrar o
 * Tecnologia da Informação ele precisaria criar 4 disciplinas na mão e digitar
 * 88 linhas, uma por uma, e depois ir em outra tela ligar cada uma ao material.
 * No SEFAZ-AL eram 16 disciplinas e 183 linhas. Ele escreve esse texto de
 * qualquer jeito para a página de venda; só faltava o painel saber lê-lo.
 *
 * NÃO INVENTA FORMATO NOVO. Lê o que ele já escreve, nas duas formas que eu vi
 * nos materiais de verdade:
 *
 *   ### 1. Matemática Financeira              <- SEFAZ-AL
 *   **Módulo 1 ✅ acesso imediato (9 cards)**
 *   1\. Regra de Três, Proporções: 9 cards
 *
 *   Ciência de Dados · 287 páginas            <- Tecnologia da Informação
 *   Módulo 1 ✅ acesso imediato (75 páginas)
 *   1. Dado, informação, conhecimento
 *
 * OS CABEÇALHOS DE MÓDULO CONTINUAM SENDO LINHA, e isso é de propósito: a
 * sanfona da página do produto já sabe que linha começando com "Módulo" ou com
 * 📝 é cabeçalho, desde 23/09. Inventar uma tabela de módulos aqui criaria uma
 * segunda verdade sobre a mesma coisa.
 *
 * ELE SEMPRE CONFERE ANTES DE GRAVAR. A tela mostra o que foi entendido, e é
 * por isso que `avisos` existe: palpite silencioso em 183 linhas é como criar
 * 16 disciplinas erradas sem ninguém perceber.
 */

export type DisciplinaColada = {
  nome: string;
  /** número de páginas ou cards que veio escrito ao lado do nome */
  medida: number | null;
  unidade: 'páginas' | 'cards' | null;
  /** as linhas na ordem, cabeçalho de módulo incluído */
  linhas: string[];
};

export type SumarioColado = {
  disciplinas: DisciplinaColada[];
  /** o que não deu para entender, para a pessoa olhar antes de gravar */
  avisos: string[];
  /** o formato deduzido pela unidade da medida; null quando não dá para saber */
  formatoProvavel: 'Resumo' | 'Flashcards' | null;
};

/** "## Sumário", "## Detalhes do produto": título de seção, não é disciplina. */
const TITULO_DE_SECAO = /^##(?!#)\s/;

/**
 * O título do próprio bloco, solto, sem cerquilha nenhuma.
 *
 * Ele cola o texto a partir de "*Sumário*" mais de uma vez, e avisar que o
 * título não é disciplina é ruído: a pessoa fica procurando erro onde não tem.
 */
const TITULO_SOLTO = /^(sum[áa]rio(\s+das\s+disciplinas)?|detalhes\s+do\s+produto)$/i;

/** linha que anuncia um módulo ou um bloco do que ainda está em produção */
const CABECALHO_DE_MODULO = /^\s*(?:M[óo]dulo\b|📝)/i;

/** "### 3. Direito Administrativo" */
const TITULO_COM_CERQUILHA = /^###\s+(.+?)\s*$/;

/**
 * "Ciência de Dados · 287 páginas", com qualquer um dos separadores que já
 * apareceram nos textos: ponto do meio, bolinha, travessão ou hífen.
 */
const NOME_COM_MEDIDA = /^(.+?)\s*[·•–-]\s*([\d.]+)\s*(páginas?|p[áa]gs?|cards?)\s*$/i;

/** "1. ", "1\. ", "- 1. ", "➥ ", "• " : começo de linha de assunto */
const COMECO_DE_TOPICO = /^\s*(?:[-*•➥]\s*)?\d+\s*\\?[.)]\s+|^\s*[-*•➥]\s+/;

/** tira o negrito, o itálico e os dois espaços de quebra dura do Markdown */
function semMarcacao(linha: string): string {
  return linha
    .replace(/\s+$/, '')
    .replace(/^\s*\*\*(.+)\*\*\s*$/, '$1')
    .replace(/^\s*\*(.+)\*\s*$/, '$1')
    .trim();
}

/** "1\. Regra de Três" -> "1. Regra de Três"; "- 1. Dado" -> "1. Dado" */
function topicoLimpo(linha: string): string {
  return linha
    .replace(/\s+$/, '')
    .replace(/^\s*[-*•]\s+/, '')
    .replace(/^(\s*\d+)\\\./, '$1.')
    .trim();
}

/** "1.191" e "287" viram número; o ponto aqui é separador de milhar. */
function numero(bruto: string): number | null {
  const n = Number(bruto.replace(/\./g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "### 1. Matemática Financeira" -> "Matemática Financeira" */
function semNumeracao(nome: string): string {
  return nome.replace(/^\d+\s*[.)]\s*/, '').trim();
}

export function lerSumarioColado(texto: string): SumarioColado {
  const avisos: string[] = [];
  const disciplinas: DisciplinaColada[] = [];
  let atual: DisciplinaColada | null = null;

  const linhas = texto.split(/\r?\n/);

  for (let i = 0; i < linhas.length; i++) {
    const crua = linhas[i];
    if (!crua.trim()) continue;

    const linha = semMarcacao(crua);
    if (!linha) continue;

    if (TITULO_DE_SECAO.test(crua)) continue;
    if (TITULO_SOLTO.test(linha)) continue;

    // cabeçalho de módulo pertence à disciplina aberta, e entra como linha
    if (CABECALHO_DE_MODULO.test(linha)) {
      if (!atual) {
        avisos.push(`Linha ${i + 1}: achei um módulo antes de qualquer disciplina, e ele foi ignorado.`);
        continue;
      }
      atual.linhas.push(linha);
      continue;
    }

    const comCerquilha = crua.match(TITULO_COM_CERQUILHA);
    const comMedida = linha.match(NOME_COM_MEDIDA);

    if (comCerquilha || comMedida) {
      const nome = comCerquilha
        ? semNumeracao(semMarcacao(comCerquilha[1]))
        : semNumeracao(comMedida![1]);

      // "### Módulo 1" não existe nos textos dele, mas se existir é melhor
      // avisar do que criar uma disciplina chamada Módulo 1
      if (CABECALHO_DE_MODULO.test(nome)) {
        avisos.push(`Linha ${i + 1}: "${nome}" parece módulo e veio escrito como disciplina.`);
        continue;
      }

      const unidadeBruta = comMedida?.[3]?.toLowerCase() ?? null;
      atual = {
        nome,
        medida: comMedida ? numero(comMedida[2]) : null,
        unidade: unidadeBruta ? (unidadeBruta.startsWith('card') ? 'cards' : 'páginas') : null,
        linhas: [],
      };
      disciplinas.push(atual);
      continue;
    }

    if (!atual) {
      avisos.push(`Linha ${i + 1}: "${linha.slice(0, 50)}" veio antes de qualquer disciplina.`);
      continue;
    }

    // dentro de uma disciplina, o que não é módulo é assunto. Linha que não tem
    // cara de assunto numerado ainda entra, porque ele escreve "➥ 11. Lei
    // Complementar" nos blocos em produção, mas fica registrada no aviso para
    // ele conferir se era aquilo mesmo.
    if (!COMECO_DE_TOPICO.test(crua) && !/^\d/.test(linha)) {
      avisos.push(`Linha ${i + 1}: "${linha.slice(0, 50)}" entrou como assunto de ${atual.nome}.`);
    }
    atual.linhas.push(topicoLimpo(crua));
  }

  const vazias = disciplinas.filter((d) => d.linhas.length === 0);
  for (const d of vazias) avisos.push(`"${d.nome}" ficou sem nenhum assunto embaixo.`);

  const comConteudo = disciplinas.filter((d) => d.linhas.length > 0);

  /**
   * Medida que não veio ao lado do nome sai da soma dos módulos.
   *
   * No formato do SEFAZ-AL o total nunca aparece junto da disciplina: ele
   * escreve "Módulo 1 (9 cards)" e "Módulo 2 (93 cards)", e 9 + 93 é o 102 que
   * a disciplina tem. Sem somar, ele teria que digitar à mão as 16 medidas que
   * já estão escritas no texto que acabou de colar.
   *
   * Só vale quando TODOS os módulos trazem número: somar três de quatro daria
   * um total menor que o real, e número errado na tela de venda é pior que
   * número nenhum.
   */
  for (const d of comConteudo) {
    if (d.medida !== null) continue;

    const cabecalhos = d.linhas.filter((l) => CABECALHO_DE_MODULO.test(l));
    const medidos = cabecalhos
      .map((l) => l.match(/\(\s*([\d.]+)\s*(páginas?|p[áa]gs?|cards?)\s*\)/i))
      .filter((m): m is RegExpMatchArray => m !== null);

    // o bloco "📝 Em produção" não traz número e não deve impedir a soma
    const comNumero = cabecalhos.filter((l) => !/^\s*📝/.test(l));
    if (medidos.length === 0 || medidos.length !== comNumero.length) continue;

    const soma = medidos.reduce((t, m) => t + (numero(m[1]) ?? 0), 0);
    if (soma > 0) {
      d.medida = soma;
      d.unidade = medidos[0][2].toLowerCase().startsWith('card') ? 'cards' : 'páginas';
    }
  }

  // o formato sai da unidade que ele escreveu: página é resumo, card é
  // flashcard. Mistura dos dois no mesmo texto não dá para adivinhar.
  const unidades = new Set(comConteudo.map((d) => d.unidade).filter(Boolean));
  const formatoProvavel =
    unidades.size === 1
      ? unidades.has('cards')
        ? 'Flashcards'
        : 'Resumo'
      : null;

  if (unidades.size > 1) {
    avisos.push('O texto mistura páginas e cards, então escolha o formato à mão.');
  }

  return { disciplinas: comConteudo, avisos, formatoProvavel };
}
