/**
 * Acrescenta o Módulo VI ao quadro "Detalhes do produto" do Combo Resumo
 * Fiscal Regular, escrevendo em produtos_ajustes.detalhes.
 *
 * POR QUE EXISTE: a página se contradizia. A descrição, escrita pelo Sérgio no
 * painel, dizia "37 (trinta e sete) RESUMOS ESQUEMATIZADOS, somando 4.281
 * páginas". O quadro de baixo listava 33, somando 3.405, porque vinha da
 * planilha e ninguém conseguia mexer nele. As quatro disciplinas que faltavam
 * somam 876 páginas, e 3.405 + 876 dá exatamente os 4.281 anunciados.
 *
 * O texto das quatro linhas é o que o Sérgio mandou, com o separador do site
 * (ponto médio) no lugar da seta que ele usou na mensagem.
 *
 * O CABEÇALHO NÃO TEM SELO DE LIBERAÇÃO, de propósito. Os módulos II a V dizem
 * "disponível 08 (oito) dias após a compra" e o I diz "acesso imediato". Qual
 * vale para este eu não sei, e prazo de entrega inventado é promessa que a
 * empresa vai ter que cumprir. O Sérgio acrescenta no painel em dez segundos.
 *
 *   node scripts/modulo-vi-fiscal.mjs           # mostra e não grava
 *   node scripts/modulo-vi-fiscal.mjs --gravar  # grava
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const c = l.indexOf('=');
      return [l.slice(0, c).trim(), l.slice(c + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const PRODUTO = 'combo-resumo-fiscal-regular';

const conteudo = JSON.parse(
  fs.readFileSync(path.join(raiz, 'src/data/catalogo/conteudo-produto.json'), 'utf8'),
).conteudo[PRODUTO];

const MODULO_VI = [
  '**MÓDULO VI ,  TECNOLOGIA DA INFORMAÇÃO (VERSÕES ENXUTAS)**',
  '',
  '34. Ciência de Dados (Versão Enxuta) · 409 páginas',
  '',
  '35. Desenvolvimento de Sistemas (Versão Enxuta) · 172 páginas',
  '',
  '36. Infraestrutura de TIC e Segurança da Informação (Versão Enxuta) · 225 páginas',
  '',
  '37. Inteligência Artificial (Versão Enxuta) · 70 páginas',
].join('\n');

const novo = `${conteudo.detalhes.trimEnd()}\n\n${MODULO_VI}\n`;

// confere antes de gravar: numeração seguida de 1 a 37, seis módulos, e a soma
// das páginas batendo com os 4.281 que a descrição anuncia
const numeradas = novo.split('\n').filter((l) => /^\d+\.\s/.test(l));
const numeros = numeradas.map((l) => Number(l.match(/^(\d+)\./)[1]));
const paginas = novo.match(/(\d[\d.]*) páginas/g) ?? [];
const soma = paginas.reduce((t, p) => t + Number(p.replace(/\D/g, '')), 0);
const modulos = novo.split('\n').filter((l) => /MÓDULO/i.test(l)).length;

const seguido = numeros.every((n, i) => n === i + 1);

console.log('linhas numeradas :', numeradas.length);
console.log('numeração seguida:', seguido ? 'sim, de 1 a ' + numeros[numeros.length - 1] : 'NÃO');
console.log('módulos          :', modulos);
console.log('soma das páginas :', soma.toLocaleString('pt-BR'));
console.log('');
console.log('--- o que entra no fim do quadro ---');
console.log(MODULO_VI);
console.log('--- fim ---');

if (!seguido || numeradas.length !== 37 || modulos !== 6 || soma !== 4281) {
  console.error('\nAlguma conta não fechou. Não gravo nada assim.');
  process.exit(1);
}

if (!process.argv.includes('--gravar')) {
  console.log('\nNada gravado. Rode com --gravar para valer.');
  process.exit(0);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { error } = await supabase
  .from('produtos_ajustes')
  .update({ detalhes: novo })
  .eq('produto_id', PRODUTO);

if (error) {
  console.error('\nnão gravou:', error.message);
  process.exit(1);
}

console.log('\ngravado em produtos_ajustes.detalhes de', PRODUTO);
