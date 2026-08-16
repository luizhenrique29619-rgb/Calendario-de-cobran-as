/**
 * Agenda de Cobranças — orquestração da interface.
 */

import * as store from './store.js';
import * as auth from './supabase.js';
import { ROTULO_STATUS, statusEfetivo, SemSessao } from './store.js';

import {
  formatarMoeda, formatarData, nomeMes, paraISO, hojeISO, somarDias,
  textoRelativo, escapar, normalizar, telefoneWhatsApp,
} from './utils.js';

const $ = (seletor) => document.querySelector(seletor);

const estado = {
  cobrancas: [],
  mesRef: new Date(),          // mês exibido no calendário
  visao: 'calendario',
  filtros: { busca: '', status: 'todos', dia: null },
  criandoConta: false,
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
  return estado.cobrancas.filter((c) => c.vencimento.startsWith(prefixoDoMes()));
}

function prefixoDoMes() {
  return `${estado.mesRef.getFullYear()}-${String(estado.mesRef.getMonth() + 1).padStart(2, '0')}`;
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
    const itens = (porDia.get(iso) || []).sort((a, b) => b.valor - a.valor);

    const classes = ['dia'];
    if (data.getMonth() !== mes) classes.push('dia--fora');
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
        if (!c.vencimento.startsWith(prefixoDoMes())) return false;
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
    <article class="item item--${status}" data-id="${escapar(c.id)}">
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

/* ====================================================== Dados */

async function recarregar() {
  estado.cobrancas = await store.listar();
  renderizar();
}

/**
 * Executa uma operação que grava dados, cuidando de erro, aviso e recarga.
 * Concentrar isso aqui evita repetir try/catch em cada ação da lista.
 */
async function executar(operacao, mensagem) {
  try {
    await operacao();
    await recarregar();
    if (mensagem) avisar(mensagem);
    return true;
  } catch (erro) {
    if (erro instanceof SemSessao) {
      mostrarLogin('Sua sessão expirou. Entre novamente.');
      return false;
    }
    avisar(erro.message || 'Não foi possível concluir a operação.', 'erro');
    return false;
  }
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

const fecharModal = () => { $('#modal').hidden = true; };

async function submeterFormulario(evento) {
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

  const botao = $('#form-cobranca button[type=submit]');
  botao.disabled = true;
  botao.textContent = 'Salvando…';

  const id = $('#f-id').value;
  let sucesso;

  if (id) {
    const anterior = estado.cobrancas.find((c) => c.id === id);
    sucesso = await executar(() => store.atualizar(id, {
      cliente: dados.cliente,
      telefone: dados.telefone,
      descricao: dados.descricao,
      valor: dados.valor,
      vencimento: dados.vencimento,
      status: dados.status,
      obs: dados.obs,
      pagoEm: dados.status === 'pago' ? (anterior?.pagoEm || hojeISO()) : null,
    }), 'Cobrança atualizada.');
  } else {
    const novas = store.gerarOcorrencias(dados);
    sucesso = await executar(() => store.inserirVarias(novas),
      novas.length > 1 ? `${novas.length} cobranças criadas.` : 'Cobrança criada.');
  }

  botao.disabled = false;
  botao.textContent = 'Salvar';
  if (sucesso) fecharModal();
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

async function acaoNaLista(evento) {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;

  const id = botao.closest('.item')?.dataset.id;
  const cobranca = estado.cobrancas.find((c) => c.id === id);
  if (!cobranca) return;

  switch (botao.dataset.acao) {
    case 'pagar':
      await executar(() => store.atualizar(id, { status: 'pago', pagoEm: hojeISO() }),
        'Cobrança marcada como paga.');
      break;

    case 'reabrir':
      await executar(() => store.atualizar(id, { status: 'pendente', pagoEm: null }),
        'Cobrança reaberta.');
      break;

    case 'editar':
      abrirModal(cobranca);
      break;

    case 'duplicar':
      await executar(() => store.inserirVarias([{
        ...cobranca,
        id: null,
        status: 'pendente',
        pagoEm: null,
        grupoId: null,
        parcela: null,
        totalParcelas: null,
        criadoEm: new Date().toISOString(),
      }]), 'Cobrança duplicada.');
      break;

    case 'excluir':
      if (confirm(`Excluir a cobrança de ${cobranca.cliente} (${formatarMoeda(cobranca.valor)})?`)) {
        await executar(() => store.excluir(id), 'Cobrança excluída.');
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

function exportarJSON(lista = estado.cobrancas, nome = `cobrancas-${hojeISO()}.json`) {
  baixar(nome, JSON.stringify(lista, null, 2), 'application/json');
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

async function importarArquivo(evento) {
  const arquivo = evento.target.files?.[0];
  evento.target.value = '';
  if (!arquivo) return;

  let dados;
  try {
    dados = JSON.parse(await arquivo.text());
    if (!Array.isArray(dados)) throw new Error('formato inválido');
  } catch {
    avisar('Arquivo inválido. Use um backup exportado por este site.', 'erro');
    return;
  }

  const novas = dados.filter((c) => c && typeof c.cliente === 'string' && c.vencimento);
  if (novas.length === 0) {
    avisar('Nenhuma cobrança encontrada no arquivo.', 'erro');
    return;
  }

  const destino = store.modo() === 'nuvem' ? 'a agenda compartilhada' : 'este navegador';
  if (!confirm(`Importar ${novas.length} cobrança(s) para ${destino}?`)) return;

  await executar(() => store.inserirVarias(novas), `${novas.length} cobrança(s) importada(s).`);
}

async function limparTudo() {
  const alcance = store.modo() === 'nuvem'
    ? 'Isso apaga TODAS as cobranças da agenda compartilhada, inclusive para as outras pessoas.'
    : 'Isso apaga TODAS as cobranças salvas neste navegador.';

  if (!confirm(`${alcance}\n\nContinuar?`)) return;
  await executar(() => store.apagarTudo(), 'Todos os dados foram apagados.');
}

/* ====================================================== Migração local → nuvem */

function verificarMigracao() {
  if (store.modo() !== 'nuvem') return;

  const locais = store.lerCobrancasLocais();
  if (locais.length === 0) return;

  $('#migrar-qtd').textContent = locais.length;
  $('#banner-migrar').hidden = false;
}

async function migrarParaNuvem() {
  const locais = store.lerCobrancasLocais();
  if (locais.length === 0) return;

  const botao = $('#btn-migrar');
  botao.disabled = true;
  botao.textContent = 'Enviando…';

  // Baixa uma cópia antes de limpar o navegador: se algo der errado no meio do
  // caminho, o usuário ainda tem o arquivo para reimportar.
  exportarJSON(locais, `backup-antes-da-migracao-${hojeISO()}.json`);

  const sucesso = await executar(
    () => store.inserirVarias(locais.map((c) => ({ ...c, id: null }))),
    `${locais.length} cobrança(s) enviadas para a agenda compartilhada.`,
  );

  if (sucesso) {
    store.apagarCobrancasLocais();
    $('#banner-migrar').hidden = true;
  }

  botao.disabled = false;
  botao.textContent = 'Enviar para a nuvem';
}

/* ====================================================== Login */

function mostrarLogin(mensagem = '') {
  $('#tela-login').hidden = false;
  $('#usuario').hidden = true;
  $('#btn-sair').hidden = true;

  const erro = $('#login-erro');
  erro.textContent = mensagem;
  erro.hidden = !mensagem;
  $('#login-aviso').hidden = true;
  $('#l-email').focus();
}

function esconderLogin() {
  $('#tela-login').hidden = true;
  $('#usuario').textContent = auth.emailAtual();
  $('#usuario').hidden = false;
  $('#btn-sair').hidden = false;
}

/** Depois de autenticar, confirma que o e-mail está liberado e carrega tudo. */
async function entrarNaAgenda() {
  if (!await auth.temAcesso()) {
    await auth.sair();
    mostrarLogin(
      `O e-mail ${auth.emailAtual() || 'informado'} não está liberado para esta agenda. `
      + 'Peça para incluí-lo na tabela "membros" do banco.',
    );
    return;
  }

  esconderLogin();
  await recarregar();
  verificarMigracao();
}

async function submeterLogin(evento) {
  evento.preventDefault();

  const email = $('#l-email').value.trim();
  const senha = $('#l-senha').value;
  const erro = $('#login-erro');
  const botao = $('#login-enviar');

  erro.hidden = true;
  $('#login-aviso').hidden = true;

  if (!email || senha.length < 6) {
    erro.textContent = 'Informe o e-mail e uma senha de pelo menos 6 caracteres.';
    erro.hidden = false;
    return;
  }

  botao.disabled = true;
  botao.textContent = estado.criandoConta ? 'Criando…' : 'Entrando…';

  try {
    if (estado.criandoConta) await auth.cadastrar(email, senha);
    else await auth.entrar(email, senha);
    await entrarNaAgenda();
  } catch (e) {
    erro.textContent = e.message;
    erro.hidden = false;
  } finally {
    botao.disabled = false;
    botao.textContent = estado.criandoConta ? 'Criar conta' : 'Entrar';
  }
}

function alternarModoLogin() {
  estado.criandoConta = !estado.criandoConta;

  $('#login-subtitulo').textContent = estado.criandoConta
    ? 'Crie sua conta com o e-mail que foi liberado para a agenda.'
    : 'Entre para ver a agenda compartilhada.';
  $('#login-enviar').textContent = estado.criandoConta ? 'Criar conta' : 'Entrar';
  $('#login-alternar').textContent = estado.criandoConta ? 'Já tenho conta' : 'Não tenho conta ainda';
  $('#l-senha').autocomplete = estado.criandoConta ? 'new-password' : 'current-password';
  $('#login-erro').hidden = true;
  $('#login-aviso').hidden = true;
}

async function esqueciSenha() {
  const email = $('#l-email').value.trim();
  const erro = $('#login-erro');
  const aviso = $('#login-aviso');

  if (!email) {
    erro.textContent = 'Digite seu e-mail no campo acima e clique de novo.';
    erro.hidden = false;
    return;
  }

  try {
    await auth.recuperarSenha(email);
    erro.hidden = true;
    aviso.textContent = `Se existir conta para ${email}, o link de redefinição chegará por e-mail.`;
    aviso.hidden = false;
  } catch (e) {
    erro.textContent = e.message;
    erro.hidden = false;
  }
}

async function sair() {
  await auth.sair();
  estado.cobrancas = [];
  renderizar();
  mostrarLogin();
}

/* ====================================================== Tema e avisos */

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  $('#btn-tema-icone').textContent = tema === 'escuro' ? '☀️' : '🌙';
  store.salvarTema(tema);
}

let timerToast;
function avisar(mensagem, tipo = 'ok') {
  const toast = $('#toast');
  toast.textContent = mensagem;
  toast.classList.toggle('toast--erro', tipo === 'erro');
  toast.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { toast.hidden = true; }, tipo === 'erro' ? 5000 : 2800);
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

  // Login
  $('#form-login').addEventListener('submit', submeterLogin);
  $('#login-alternar').addEventListener('click', alternarModoLogin);
  $('#login-esqueci').addEventListener('click', esqueciSenha);
  $('#btn-sair').addEventListener('click', sair);

  // Banners
  document.querySelectorAll('[data-fechar-banner]').forEach((botao) => {
    botao.addEventListener('click', () => { botao.closest('.banner').hidden = true; });
  });
  $('#btn-migrar').addEventListener('click', migrarParaNuvem);

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
    if (acao === 'exportar-json') { exportarJSON(); avisar('Backup exportado.'); }
    if (acao === 'exportar-csv') exportarCSV();
    if (acao === 'importar') $('#input-arquivo').click();
    if (acao === 'limpar') limparTudo();
  });

  $('#input-arquivo').addEventListener('change', importarArquivo);

  // Com duas pessoas mexendo na mesma agenda, o que está na tela envelhece.
  // Recarregar ao voltar para a aba evita trabalhar em cima de dado velho.
  window.addEventListener('focus', () => {
    if (store.modo() === 'nuvem' && $('#tela-login').hidden) {
      recarregar().catch(() => { /* silencioso: é atualização de fundo */ });
    }
  });
}

/* ====================================================== Inicialização */

async function iniciar() {
  aplicarTema(store.carregarTema());
  ligarEventos();

  if (store.modo() === 'local') {
    $('#banner-local').hidden = false;
    await recarregar();
    return;
  }

  if (!auth.temSessao()) {
    renderizar();
    mostrarLogin();
    return;
  }

  try {
    await entrarNaAgenda();
  } catch (e) {
    // Sessão guardada que o servidor não aceita mais: explica em vez de só
    // devolver o formulário de login sem motivo aparente.
    renderizar();
    mostrarLogin(e.message);
  }
}

iniciar();
