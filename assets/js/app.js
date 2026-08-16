/**
 * Agenda de Cobranças — orquestração da interface.
 */

import {
  carregar, salvar, gerarOcorrencias, statusEfetivo,
  ROTULO_STATUS, carregarTema, salvarTema,
} from './store.js';

import {
  formatarMoeda, formatarData, nomeMes, paraISO, hojeISO, somarDias,
  textoRelativo, escapar, normalizar, telefoneWhatsApp, gerarId,
} from './utils.js';

const $ = (seletor) => document.querySelector(seletor);

const estado = {
  cobrancas: carregar(),
  mesRef: new Date(),          // mês exibido no calendário
  visao: 'calendario',
  filtros: { busca: '', status: 'todos', dia: null },
};

/* ====================================================== Renderização */

function renderizar() {
  renderizarIndicadores();
  $('#mes-titulo').textContent = nomeMes(estado.mesRef);
  if (estado.visao === 'calendario') renderizarCalendario();
  else renderizarLista();
}

/** Cobranças do mês exibido. */
function doMes() {
  const prefixo = `${estado.mesRef.getFullYear()}-${String(estado.mesRef.getMonth() + 1).padStart(2, '0')}`;
  return estado.cobrancas.filter((c) => c.vencimento.startsWith(prefixo));
}

const somar = (lista) => lista.reduce((total, c) => total + c.valor, 0);

function renderizarIndicadores() {
  const mes = doMes();
  const naoCancelada = (c) => c.status !== 'cancelado';

  const aReceber = mes.filter((c) => c.status === 'pendente');
  const recebido = mes.filter((c) => c.status === 'pago');
  const atrasado = estado.cobrancas.filter((c) => statusEfetivo(c) === 'atrasado');

  const limite = somarDias(hojeISO(), 7);
  const proximas = estado.cobrancas.filter(
    (c) => c.status === 'pendente' && c.vencimento >= hojeISO() && c.vencimento <= limite,
  );

  const preencher = (chave, lista) => {
    $(`#kpi-${chave}`).textContent = formatarMoeda(somar(lista));
    $(`#kpi-${chave}-qtd`).textContent =
      `${lista.length} ${lista.length === 1 ? 'cobrança' : 'cobranças'}`;
  };

  preencher('receber', aReceber.filter(naoCancelada));
  preencher('recebido', recebido);
  preencher('atrasado', atrasado);
  preencher('proximas', proximas);
}

function renderizarCalendario() {
  const ano = estado.mesRef.getFullYear();
  const mes = estado.mesRef.getMonth();

  const primeiroDia = new Date(ano, mes, 1);
  const inicioGrade = new Date(ano, mes, 1 - primeiroDia.getDay());

  // Agrupa por data para não varrer a lista inteira em cada célula.
  const porDia = new Map();
  for (const c of estado.cobrancas) {
    if (!porDia.has(c.vencimento)) porDia.set(c.vencimento, []);
    porDia.get(c.vencimento).push(c);
  }

  const hoje = hojeISO();
  const celulas = [];

  for (let i = 0; i < 42; i += 1) {
    const data = new Date(inicioGrade.getFullYear(), inicioGrade.getMonth(), inicioGrade.getDate() + i);
    const iso = paraISO(data);
    const doMesAtual = data.getMonth() === mes;
    const itens = (porDia.get(iso) || []).sort((a, b) => b.valor - a.valor);

    const classes = ['dia'];
    if (!doMesAtual) classes.push('dia--fora');
    if (iso === hoje) classes.push('dia--hoje');

    const visiveis = itens.slice(0, 3);
    const restantes = itens.length - visiveis.length;
    const totalDia = somar(itens.filter((c) => c.status !== 'cancelado'));

    celulas.push(`
      <button type="button" class="${classes.join(' ')}" data-dia="${iso}"
              aria-label="${itens.length} cobrança(s) em ${formatarData(iso)}">
        <span class="dia__topo">
          <span class="dia__numero">${data.getDate()}</span>
          ${totalDia > 0 ? `<span class="dia__total">${formatarMoeda(totalDia)}</span>` : ''}
        </span>
        ${visiveis.map((c) => `
          <span class="chip chip--${statusEfetivo(c)}" title="${escapar(c.cliente)} — ${formatarMoeda(c.valor)}">
            ${escapar(c.cliente)}
          </span>`).join('')}
        ${restantes > 0 ? `<span class="dia__mais">+${restantes} mais</span>` : ''}
      </button>`);
  }

  $('#calendario').innerHTML = celulas.join('');
}

/** Aplica busca, status e filtro de dia. */
function filtrar() {
  const termo = normalizar(estado.filtros.busca.trim());

  return estado.cobrancas
    .filter((c) => {
      if (estado.filtros.dia && c.vencimento !== estado.filtros.dia) return false;

      if (estado.filtros.status !== 'todos'
        && statusEfetivo(c) !== estado.filtros.status) return false;

      if (termo) {
        const alvo = normalizar(`${c.cliente} ${c.descricao} ${c.obs}`);
        if (!alvo.includes(termo)) return false;
      }

      // Sem nenhum filtro ativo, a lista acompanha o mês exibido no calendário.
      if (!estado.filtros.dia && !termo && estado.filtros.status === 'todos') {
        const prefixo = `${estado.mesRef.getFullYear()}-${String(estado.mesRef.getMonth() + 1).padStart(2, '0')}`;
        if (!c.vencimento.startsWith(prefixo)) return false;
      }
      return true;
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.cliente.localeCompare(b.cliente));
}

function renderizarLista() {
  const itens = filtrar();
  const aviso = $('#filtro-dia-aviso');

  const buscaAtiva = estado.filtros.busca.trim() !== '' || estado.filtros.status !== 'todos';

  if (estado.filtros.dia) {
    aviso.hidden = false;
    $('#filtro-dia-texto').textContent =
      `Mostrando o dia ${formatarData(estado.filtros.dia)} · ${itens.length} cobrança(s)`;
  } else if (buscaAtiva) {
    aviso.hidden = false;
    $('#filtro-dia-texto').textContent =
      `Busca em todos os períodos · ${itens.length} cobrança(s) · total ${formatarMoeda(somar(itens))}`;
  } else {
    aviso.hidden = true;
    $('#filtro-dia-texto').textContent = '';
  }

  if (itens.length === 0) {
    $('#lista').innerHTML = `
      <div class="vazio">
        <strong>Nenhuma cobrança encontrada</strong>
        Ajuste os filtros ou cadastre uma nova cobrança.
      </div>`;
    return;
  }

  $('#lista').innerHTML = itens.map(montarItem).join('');
}

function montarItem(c) {
  const status = statusEfetivo(c);
  const parcela = c.totalParcelas ? ` · parcela ${c.parcela}/${c.totalParcelas}` : '';
  const relativo = c.status === 'pendente' ? ` · ${textoRelativo(c.vencimento)}` : '';
  const pago = c.status === 'pago' && c.pagoEm ? ` · recebido em ${formatarData(c.pagoEm)}` : '';
  const zap = telefoneWhatsApp(c.telefone);

  return `
    <article class="item item--${status}" data-id="${c.id}">
      <span class="item__faixa"></span>

      <div class="item__info">
        <div class="item__cliente">${escapar(c.cliente)}</div>
        <div class="item__meta">
          ${escapar(c.descricao || 'Sem descrição')} — vence ${formatarData(c.vencimento)}${relativo}${pago}${parcela}
        </div>
        ${c.obs ? `<div class="item__obs">${escapar(c.obs)}</div>` : ''}
      </div>

      <div class="item__valores">
        <div class="item__valor">${formatarMoeda(c.valor)}</div>
        <span class="etiqueta etiqueta--${status}">${ROTULO_STATUS[status]}</span>
      </div>

      <div class="item__acoes">
        ${c.status !== 'pago'
          ? `<button type="button" class="acao" data-acao="pagar" title="Marcar como paga">✓</button>`
          : `<button type="button" class="acao" data-acao="reabrir" title="Reabrir cobrança">↺</button>`}
        ${zap ? `<a class="acao" href="${linkWhatsApp(c, zap)}" target="_blank" rel="noopener" title="Cobrar no WhatsApp">💬</a>` : ''}
        <button type="button" class="acao" data-acao="duplicar" title="Duplicar">⧉</button>
        <button type="button" class="acao" data-acao="editar" title="Editar">✎</button>
        <button type="button" class="acao" data-acao="excluir" title="Excluir">🗑</button>
      </div>
    </article>`;
}

function linkWhatsApp(c, numero) {
  const item = c.descricao ? ` referente a ${c.descricao}` : '';
  const texto =
    `Olá, ${c.cliente}! Tudo bem? Passando para lembrar da cobrança${item} `
    + `no valor de ${formatarMoeda(c.valor)}, com vencimento em ${formatarData(c.vencimento)}. Obrigado!`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/* ====================================================== Persistência */

function commit(mensagem) {
  if (!salvar(estado.cobrancas)) {
    avisar('Não foi possível salvar no navegador. Verifique o espaço disponível.');
  } else if (mensagem) {
    avisar(mensagem);
  }
  renderizar();
}

/* ====================================================== Modal / form */

function abrirModal(cobranca = null) {
  $('#modal-titulo').textContent = cobranca ? 'Editar cobrança' : 'Nova cobrança';
  $('#form-erro').hidden = true;
  $('#f-id').value = cobranca?.id ?? '';
  $('#f-cliente').value = cobranca?.cliente ?? '';
  $('#f-telefone').value = cobranca?.telefone ?? '';
  $('#f-descricao').value = cobranca?.descricao ?? '';
  $('#f-valor').value = cobranca ? cobranca.valor : '';
  $('#f-vencimento').value = cobranca?.vencimento ?? (estado.filtros.dia || hojeISO());
  $('#f-status').value = cobranca?.status ?? 'pendente';
  $('#f-obs').value = cobranca?.obs ?? '';
  $('#f-recorrencia').value = 'nenhuma';
  $('#f-parcelas').value = 1;

  // Recorrência só faz sentido ao criar; editar altera apenas aquela cobrança.
  $('#bloco-recorrencia').hidden = Boolean(cobranca);

  $('#modal').hidden = false;
  $('#f-cliente').focus();
}

function fecharModal() {
  $('#modal').hidden = true;
}

function submeterFormulario(evento) {
  evento.preventDefault();

  const dados = {
    cliente: $('#f-cliente').value.trim(),
    telefone: $('#f-telefone').value.trim(),
    descricao: $('#f-descricao').value.trim(),
    valor: Number($('#f-valor').value),
    vencimento: $('#f-vencimento').value,
    status: $('#f-status').value,
    obs: $('#f-obs').value.trim(),
    recorrencia: $('#f-recorrencia').value,
    parcelas: Number($('#f-parcelas').value),
  };

  const erro = validar(dados);
  if (erro) {
    const campo = $('#form-erro');
    campo.textContent = erro;
    campo.hidden = false;
    return;
  }

  const id = $('#f-id').value;

  if (id) {
    const indice = estado.cobrancas.findIndex((c) => c.id === id);
    if (indice >= 0) {
      const anterior = estado.cobrancas[indice];
      estado.cobrancas[indice] = {
        ...anterior,
        ...dados,
        pagoEm: dados.status === 'pago' ? (anterior.pagoEm || hojeISO()) : null,
      };
    }
    fecharModal();
    commit('Cobrança atualizada.');
    return;
  }

  const novas = gerarOcorrencias(dados);
  estado.cobrancas.push(...novas);
  fecharModal();
  commit(novas.length > 1 ? `${novas.length} cobranças criadas.` : 'Cobrança criada.');
}

function validar(dados) {
  if (!dados.cliente) return 'Informe o nome do cliente.';
  if (!Number.isFinite(dados.valor) || dados.valor <= 0) return 'Informe um valor maior que zero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.vencimento)) return 'Informe uma data de vencimento válida.';
  if (dados.recorrencia !== 'nenhuma' && (dados.parcelas < 1 || dados.parcelas > 60)) {
    return 'A quantidade de parcelas deve ficar entre 1 e 60.';
  }
  return null;
}

/* ====================================================== Ações na lista */

function acaoNaLista(evento) {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;

  const id = botao.closest('.item')?.dataset.id;
  const indice = estado.cobrancas.findIndex((c) => c.id === id);
  if (indice < 0) return;

  const cobranca = estado.cobrancas[indice];

  switch (botao.dataset.acao) {
    case 'pagar':
      estado.cobrancas[indice] = { ...cobranca, status: 'pago', pagoEm: hojeISO() };
      commit('Cobrança marcada como paga.');
      break;

    case 'reabrir':
      estado.cobrancas[indice] = { ...cobranca, status: 'pendente', pagoEm: null };
      commit('Cobrança reaberta.');
      break;

    case 'editar':
      abrirModal(cobranca);
      break;

    case 'duplicar':
      estado.cobrancas.push({
        ...cobranca,
        id: gerarId(),
        status: 'pendente',
        pagoEm: null,
        grupoId: null,
        parcela: null,
        totalParcelas: null,
        criadoEm: new Date().toISOString(),
      });
      commit('Cobrança duplicada.');
      break;

    case 'excluir':
      if (confirm(`Excluir a cobrança de ${cobranca.cliente} (${formatarMoeda(cobranca.valor)})?`)) {
        estado.cobrancas.splice(indice, 1);
        commit('Cobrança excluída.');
      }
      break;
  }
}

/* ====================================================== Import / export */

function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function exportarJSON() {
  baixar(`cobrancas-${hojeISO()}.json`, JSON.stringify(estado.cobrancas, null, 2), 'application/json');
  avisar('Backup exportado.');
}

function exportarCSV() {
  const cabecalho = ['Cliente', 'Telefone', 'Descricao', 'Valor', 'Vencimento', 'Status', 'Pago em', 'Observacoes'];
  const celula = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const linhas = estado.cobrancas.map((c) => [
    c.cliente, c.telefone, c.descricao,
    c.valor.toFixed(2).replace('.', ','),   // separador decimal do Excel pt-BR
    formatarData(c.vencimento),
    ROTULO_STATUS[statusEfetivo(c)],
    c.pagoEm ? formatarData(c.pagoEm) : '',
    c.obs,
  ].map(celula).join(';'));

  const conteudo = `﻿${cabecalho.join(';')}\n${linhas.join('\n')}`;
  baixar(`cobrancas-${hojeISO()}.csv`, conteudo, 'text/csv;charset=utf-8');
  avisar('Planilha exportada.');
}

function importarArquivo(evento) {
  const arquivo = evento.target.files?.[0];
  if (!arquivo) return;

  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const dados = JSON.parse(String(leitor.result));
      if (!Array.isArray(dados)) throw new Error('formato inválido');

      const existentes = new Set(estado.cobrancas.map((c) => c.id));
      const novas = dados.filter((c) => c && !existentes.has(c.id));

      estado.cobrancas.push(...novas);
      estado.cobrancas = carregarNormalizado(estado.cobrancas);
      commit(`${novas.length} cobrança(s) importada(s).`);
    } catch {
      avisar('Arquivo inválido. Use um backup exportado por este site.');
    }
  };
  leitor.readAsText(arquivo);
  evento.target.value = '';
}

/** Passa a lista pelo saneamento do store (grava e relê). */
function carregarNormalizado(lista) {
  salvar(lista);
  return carregar();
}

function limparTudo() {
  if (!confirm('Isso apaga TODAS as cobranças salvas neste navegador. Continuar?')) return;
  estado.cobrancas = [];
  commit('Todos os dados foram apagados.');
}

/* ====================================================== Tema e avisos */

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  $('#btn-tema-icone').textContent = tema === 'escuro' ? '☀️' : '🌙';
  salvarTema(tema);
}

let timerToast;
function avisar(mensagem) {
  const toast = $('#toast');
  toast.textContent = mensagem;
  toast.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { toast.hidden = true; }, 2800);
}

/* ====================================================== Eventos */

function trocarVisao(visao) {
  estado.visao = visao;
  document.querySelectorAll('.aba').forEach((aba) => {
    aba.classList.toggle('is-ativa', aba.dataset.visao === visao);
  });
  $('#visao-calendario').hidden = visao !== 'calendario';
  $('#visao-lista').hidden = visao !== 'lista';
  renderizar();
}

function irParaMes(delta) {
  estado.mesRef = new Date(estado.mesRef.getFullYear(), estado.mesRef.getMonth() + delta, 1);
  renderizar();
}

function ligarEventos() {
  $('#btn-nova').addEventListener('click', () => abrirModal());
  $('#mes-anterior').addEventListener('click', () => irParaMes(-1));
  $('#mes-proximo').addEventListener('click', () => irParaMes(1));
  $('#mes-hoje').addEventListener('click', () => { estado.mesRef = new Date(); renderizar(); });

  document.querySelectorAll('.aba').forEach((aba) => {
    aba.addEventListener('click', () => trocarVisao(aba.dataset.visao));
  });

  $('#filtro-busca').addEventListener('input', (e) => {
    estado.filtros.busca = e.target.value;
    if (estado.visao !== 'lista') trocarVisao('lista');
    else renderizarLista();
  });

  $('#filtro-status').addEventListener('change', (e) => {
    estado.filtros.status = e.target.value;
    if (estado.visao !== 'lista') trocarVisao('lista');
    else renderizarLista();
  });

  // Clique em um dia do calendário abre a lista já filtrada.
  $('#calendario').addEventListener('click', (e) => {
    const dia = e.target.closest('[data-dia]')?.dataset.dia;
    if (!dia) return;
    estado.filtros.dia = dia;
    trocarVisao('lista');
  });

  $('#filtro-dia-limpar').addEventListener('click', () => {
    estado.filtros = { busca: '', status: 'todos', dia: null };
    $('#filtro-busca').value = '';
    $('#filtro-status').value = 'todos';
    renderizarLista();
  });

  $('#lista').addEventListener('click', acaoNaLista);
  $('#form-cobranca').addEventListener('submit', submeterFormulario);

  $('#modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-fechar]')) fecharModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fecharModal();
      $('#menu-dados').hidden = true;
    }
  });

  $('#btn-tema').addEventListener('click', () => {
    aplicarTema(document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro');
  });

  // Menu de dados
  const botaoDados = $('#btn-dados');
  const menuDados = $('#menu-dados');

  botaoDados.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDados.hidden = !menuDados.hidden;
    botaoDados.setAttribute('aria-expanded', String(!menuDados.hidden));
  });

  document.addEventListener('click', () => {
    menuDados.hidden = true;
    botaoDados.setAttribute('aria-expanded', 'false');
  });

  menuDados.addEventListener('click', (e) => {
    const acao = e.target.dataset.acao;
    if (!acao) return;
    if (acao === 'exportar-json') exportarJSON();
    if (acao === 'exportar-csv') exportarCSV();
    if (acao === 'importar') $('#input-arquivo').click();
    if (acao === 'limpar') limparTudo();
  });

  $('#input-arquivo').addEventListener('change', importarArquivo);
}

/* ====================================================== Inicialização */

aplicarTema(carregarTema());
ligarEventos();
renderizar();
