/**
 * As áreas que a pessoa escolhe ao assinar a newsletter.
 *
 * Fica num arquivo só porque a lista é usada nos dois lados: o pop-up desenha
 * as opções e a Server Action recusa qualquer valor fora daqui. Duas listas
 * iguais em lugares diferentes é o jeito conhecido de uma delas envelhecer.
 *
 * SAI DO CATÁLOGO, não de palpite: são as mesmas áreas de SLUG_DA_AREA, em
 * src/data/catalogo/rotulos.ts. "Geral" ficou de fora porque é rótulo interno
 * de produto e ninguém estuda para "concurso da área Geral".
 *
 * "Ainda não sei" é a última e existe de propósito: é a resposta verdadeira de
 * quem está começando, e sem ela essa pessoa chuta uma área e suja a
 * segmentação do disparo.
 */
export const AREAS_DE_CONCURSO = [
  'Fiscal',
  'Controle',
  'Policial',
  'Tribunais',
  'Bancária',
  'Legislativo',
  'OAB',
  'Ainda não sei',
] as const;

export type AreaDeConcurso = (typeof AREAS_DE_CONCURSO)[number];

export function areaValida(valor: string): valor is AreaDeConcurso {
  return (AREAS_DE_CONCURSO as readonly string[]).includes(valor);
}
