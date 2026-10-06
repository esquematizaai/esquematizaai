/*
 * Aviso da nova área de membros. Temporário: morre sozinho em 31/12/2026.
 *
 * QUEM ESCREVEU FOI O SÉRGIO, e o arquivo está aqui quase como ele mandou, de
 * propósito. Ele acompanha a migração dos alunos da Eduzz e da Tutory para a
 * área de alunos da loja, e vai querer mudar o texto e as datas sem esperar
 * ninguém. Arquivo solto em public/ é o formato que ele consegue editar: troca
 * o conteúdo, sobe, pronto. Virar componente React custaria a ele essa
 * autonomia e não compraria nada, porque o aviso tem prazo de validade.
 *
 * ELE OFERECEU PUBLICAR PELO GTM E RECUSAMOS. O container GTM-MGPVKJSG é da
 * agência: o que entra e sai dele é decisão deles, e bloqueador de anúncio
 * derruba GTM todo dia. Este aviso é a única forma de quem comprou lá atrás
 * descobrir onde foi parar o material que pagou. Não pode depender de terceiro
 * nem de quem não usa bloqueador.
 *
 * DUAS COISAS MUDARAM EM RELAÇÃO AO QUE ELE MANDOU:
 *
 * 1. /admin entrou na lista de páginas que não mostram o aviso. O painel é área
 *    interna, e quem está lá dentro não é aluno procurando material. É a mesma
 *    regra do GTM e do Analytics, pelo mesmo motivo.
 *
 * 2. A pílula "Novidade para alunos" acima do título saiu. É regra da casa:
 *    etiqueta em cima do título dá cara de página gerada por robô.
 *
 * A comparação de caminho deixou de ser expressão regular e passou a olhar o
 * primeiro pedaço da URL. Faz a mesma coisa, sem barra invertida para alguma
 * ferramenta comer no caminho, e de quebra deixa de casar com /checkoutqualquer.
 */
(function () {
  var CFG = {
    fim: '2026-12-31T23:59:59-04:00',
    link: 'https://loja.esquematizaai.com/minha-conta/',
    whats: 'https://wa.me/551152865954?text=' + encodeURIComponent('Olá! Comprei pela Eduzz/Tutory e não recebi o e-mail da nova área de membros.'),
    chave: 'esq_popup_area_membros_v1',
    diasAposFechar: 7,
    atraso: 2500,
    fora: ['checkout', 'carrinho', 'obrigado', 'admin']
  };
  try {
    if (new Date() > new Date(CFG.fim)) return;
    if (CFG.fora.indexOf(location.pathname.split('/')[1]) !== -1) return;
    var s = null; try { s = JSON.parse(localStorage.getItem(CFG.chave) || 'null'); } catch (e) {}
    if (s && (s.clicou || (s.fechou && Date.now() - s.fechou < CFG.diasAposFechar * 864e5))) return;
  } catch (e) { return; }

  function salvar(o) { try { localStorage.setItem(CFG.chave, JSON.stringify(o)); } catch (e) {} }
  function evento(acao) { try { (window.dataLayer = window.dataLayer || []).push({ event: 'popup_area_membros', acao: acao }); } catch (e) {} }

  var css = ''
    + "@font-face{font-family:'EsqMoonlight';src:url('/fonts/TheMoonlight-Clean.ttf') format('truetype');font-display:swap}"
    + '#esq-pam{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(38,52,79,.55);opacity:0;transition:opacity .25s ease;font-family:Rubik,Arial,sans-serif}'
    + '#esq-pam.on{opacity:1}'
    + '#esq-pam .box{position:relative;width:100%;max-width:460px;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.25);overflow:hidden;transform:translateY(12px);transition:transform .25s ease}'
    + '#esq-pam.on .box{transform:none}'
    + '#esq-pam .faixa{height:6px;background:linear-gradient(90deg,#26344F 0 40%,#4EAED9 40% 70%,#FF7345 70% 85%,#8BE095 85%)}'
    + '#esq-pam .in{padding:26px 26px 22px}'
    + "#esq-pam h2{margin:0 0 12px;font-family:'Barlow Condensed',Arial Narrow,Arial,sans-serif;font-weight:700;font-size:30px;line-height:1.1;color:#26344F;letter-spacing:0}"
    + "#esq-pam h2 span{display:block;font-family:'EsqMoonlight','Barlow Condensed',cursive;font-weight:400;font-size:36px;line-height:1.15;color:#4EAED9;margin-top:2px}"
    + '#esq-pam p{margin:0 0 10px;font-size:15px;line-height:1.5;color:#3d4a63}'
    + '#esq-pam p b{color:#26344F}'
    + '#esq-pam .cta{display:block;text-align:center;margin:18px 0 10px;padding:13px 16px;border-radius:10px;background:#8BE095;color:#26344F;font-weight:700;font-size:15px;text-decoration:none}'
    + '#esq-pam .cta:hover{filter:brightness(.95)}'
    + '#esq-pam .sec{display:block;text-align:center;font-size:13px;color:#6b7280;text-decoration:underline}'
    + '#esq-pam .x{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:50%;background:#F1F3F6;color:#26344F;font-size:20px;line-height:34px;cursor:pointer;padding:0}'
    + '#esq-pam .x:hover{background:#E3E8EF}'
    + '@media (max-width:480px){#esq-pam .in{padding:22px 18px 18px}#esq-pam h2{font-size:26px}#esq-pam h2 span{font-size:31px}}';

  var html = ''
    + '<div class="box" role="dialog" aria-modal="true" aria-labelledby="esq-pam-t">'
    + '<div class="faixa"></div>'
    + '<button class="x" type="button" aria-label="Fechar">&times;</button>'
    + '<div class="in">'
    + '<h2 id="esq-pam-t">Seus materiais estão na <span>nova área de membros</span></h2>'
    + '<p>Comprou pela <b>Eduzz</b> ou pela <b>Tutory</b>? Seus materiais agora também estão no site do Esquematiza Aí, com o <b>mesmo prazo de acesso</b> da compra original.</p>'
    + '<p>Enviamos um e-mail com o link de acesso. Para entrar, use o mesmo e-mail da compra.</p>'
    + '<a class="cta" href="' + CFG.link + '" data-acao="clicou">Acessar a área de membros</a>'
    + '<a class="sec" href="' + CFG.whats + '" target="_blank" rel="noopener" data-acao="whatsapp">Não recebeu o e-mail? Fale com a gente no WhatsApp</a>'
    + '</div></div>';

  function abrir() {
    if (document.getElementById('esq-pam')) return;
    var st = document.createElement('style'); st.id = 'esq-pam-css'; st.textContent = css; document.head.appendChild(st);
    var w = document.createElement('div'); w.id = 'esq-pam'; w.innerHTML = html; document.body.appendChild(w);
    var antes = document.activeElement;
    function fechar() {
      salvar({ fechou: Date.now() }); evento('fechou');
      w.classList.remove('on'); document.removeEventListener('keydown', tecla);
      setTimeout(function () { w.remove(); st.remove(); try { antes && antes.focus(); } catch (e) {} }, 250);
    }
    function tecla(e) { if (e.key === 'Escape') fechar(); }
    w.querySelector('.x').addEventListener('click', fechar);
    w.addEventListener('click', function (e) { if (e.target === w) fechar(); });
    document.addEventListener('keydown', tecla);
    w.querySelector('.cta').addEventListener('click', function () { salvar({ clicou: Date.now() }); evento('clicou'); });
    w.querySelector('.sec').addEventListener('click', function () { evento('whatsapp'); });
    requestAnimationFrame(function () { w.classList.add('on'); w.querySelector('.cta').focus({ preventScroll: true }); });
    evento('exibiu');
  }
  function iniciar() { setTimeout(abrir, CFG.atraso); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
