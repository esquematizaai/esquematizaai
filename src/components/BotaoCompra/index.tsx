'use client';

import { avisarGtm, comCampanha, type ItemMedido } from '@/lib/rastreio';
import { useHrefDoPlano, usePlano } from '@/components/planos/PlanoContext';
import { brl } from '@/lib/planos';

/**
 * O botão que leva ao checkout, medindo o clique e levando a campanha junto.
 *
 * Duas coisas acontecem no mesmo clique, e as duas precisam ser no navegador:
 *
 *  - o begin_checkout vai para o GTM, que é o último sinal que temos antes da
 *    pessoa sair do site. Depois disso quem mede é a Eduzz.
 *  - a utm do anúncio é colada no endereço do checkout. Sem isso a TAOS vê a
 *    venda acontecer e não sabe qual anúncio a trouxe.
 *
 * O ENDEREÇO É MONTADO NO CLIQUE, NÃO NA RENDERIZAÇÃO. A página do produto fica
 * guardada por 60 segundos e servida igual para todo mundo: um href montado no
 * servidor sairia com a campanha da visita anterior, colando a venda de uma
 * pessoa no anúncio de outra. No clique, quem manda é a aba de quem clicou.
 *
 * Por isso também não há `href` dinâmico aqui: o atributo continua sendo o
 * checkout limpo, o que mantém o botão funcionando com JavaScript desligado, ao
 * clique do meio e no "copiar endereço do link". A campanha entra por cima só
 * no clique normal.
 *
 * O PLANO É A EXCEÇÃO, e é exceção de propósito. Desde 07/10/2026 a loja vende
 * cada material em 12 ou 24 meses, e o prazo escolhido vai no próprio endereço.
 * Esse sim entra no atributo, porque é parte da oferta que a pessoa está vendo:
 * se ficasse só no clique, o clique do meio e o "copiar endereço" levariam o
 * prazo errado, e a loja cobraria 12 meses numa tela que anuncia 24.
 */
export default function BotaoCompra({
  href,
  item,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  href: string;
  item: ItemMedido;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}) {
  const { plano } = usePlano();
  const hrefDoPlano = useHrefDoPlano(href);
  // o preço medido acompanha o plano, senão a agência recebe o valor de 12
  // meses numa tela que está anunciando o de 24
  const itemDoPlano = plano ? { ...item, preco: plano.preco } : item;

  /**
   * Com planos, o preço entra no rótulo aqui e não na página.
   *
   * A página é desenhada no servidor e guardada por 60 segundos; o plano é
   * escolhido no navegador. Um rótulo montado lá diria "por R$ 697" enquanto o
   * card marcado mostra R$ 877, e quem usa leitor de tela ouviria o preço
   * errado sem nunca ver o certo.
   */
  const rotulo = plano
    ? `${ariaLabel ?? 'Comprar'}, acesso ${plano.meses} meses por ${brl(plano.preco)}`
    : ariaLabel;

  function aoClicar(evento: React.MouseEvent<HTMLAnchorElement>) {
    avisarGtm('begin_checkout', itemDoPlano);

    // Trocar o href aqui dentro vale para a navegação deste mesmo clique: o
    // navegador só lê o atributo depois que o evento termina de ser tratado.
    // Continua valendo para quem abre em aba nova com ctrl ou cmd, porque quem
    // decide COMO abrir é o navegador, e só o PARA ONDE muda aqui.
    //
    // Rodar de novo no segundo clique não duplica nada: comCampanha não mexe em
    // parâmetro que o endereço já tem.
    evento.currentTarget.href = comCampanha(hrefDoPlano);
  }

  return (
    <a
      className={className}
      href={hrefDoPlano}
      data-plano={plano?.meses ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={rotulo}
      onClick={aoClicar}
    >
      {children}
    </a>
  );
}
