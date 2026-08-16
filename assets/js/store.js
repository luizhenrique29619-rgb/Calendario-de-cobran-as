/**
 * Camada de dados. Tudo fica no localStorage do navegador —
 * nenhuma informação é enviada para servidores.
 */

import { gerarId, hojeISO, somarDias, somarMeses } from './utils.js';

const CHAVE = 'agenda-cobrancas:v1';
const CHAVE_TEMA = 'agenda-cobrancas:tema';

export const STATUS = ['pendente', 'pago', 'cancelado'];

export const ROTULO_STATUS = {
  pendente: 'Pendente',
  atrasado: 'Atrasada',
  pago: 'Paga',
  cancelado: 'Cancelada',
};

/** Lê a lista de cobranças salvas. Nunca lança: dados inválidos viram lista vazia. */
export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? dados.filter(ehCobrancaValida).map(normalizarCobranca) : [];
  } catch {
    return [];
  }
}

export function salvar(cobrancas) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(cobrancas));
    return true;
  } catch {
    return false; // cota do navegador estourada ou armazenamento bloqueado
  }
}

function ehCobrancaValida(item) {
  return item && typeof item === 'object'
    && typeof item.cliente === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(String(item.vencimento));
}

function normalizarCobranca(item) {
  return {
    id: item.id || gerarId(),
    cliente: String(item.cliente).slice(0, 80),
    telefone: String(item.telefone ?? '').slice(0, 20),
    descricao: String(item.descricao ?? '').slice(0, 120),
    valor: Math.max(0, Number(item.valor) || 0),
    vencimento: item.vencimento,
    status: STATUS.includes(item.status) ? item.status : 'pendente',
    obs: String(item.obs ?? '').slice(0, 300),
    grupoId: item.grupoId || null,
    parcela: Number(item.parcela) || null,
    totalParcelas: Number(item.totalParcelas) || null,
    pagoEm: item.pagoEm || null,
    criadoEm: item.criadoEm || new Date().toISOString(),
  };
}

/**
 * Status efetivo: uma cobrança pendente com vencimento passado é "atrasado".
 * Esse status é derivado, não é gravado.
 */
export function statusEfetivo(cobranca) {
  if (cobranca.status === 'pendente' && cobranca.vencimento < hojeISO()) return 'atrasado';
  return cobranca.status;
}

/**
 * Gera as ocorrências de uma cobrança a partir dos dados do formulário.
 * Sem recorrência, devolve uma única cobrança.
 */
export function gerarOcorrencias(dados) {
  const total = Math.min(Math.max(Number(dados.parcelas) || 1, 1), 60);
  const repetir = dados.recorrencia && dados.recorrencia !== 'nenhuma' && total > 1;
  const grupoId = repetir ? gerarId() : null;

  const quantidade = repetir ? total : 1;
  const lista = [];

  for (let i = 0; i < quantidade; i += 1) {
    lista.push(normalizarCobranca({
      ...dados,
      id: gerarId(),
      vencimento: proximoVencimento(dados.vencimento, dados.recorrencia, i),
      grupoId,
      parcela: repetir ? i + 1 : null,
      totalParcelas: repetir ? quantidade : null,
      pagoEm: dados.status === 'pago' ? hojeISO() : null,
      criadoEm: new Date().toISOString(),
    }));
  }
  return lista;
}

function proximoVencimento(base, recorrencia, indice) {
  if (indice === 0) return base;
  switch (recorrencia) {
    case 'semanal': return somarDias(base, 7 * indice);
    case 'quinzenal': return somarDias(base, 15 * indice);
    case 'mensal': return somarMeses(base, indice);
    case 'anual': return somarMeses(base, 12 * indice);
    default: return base;
  }
}

/* ------------------------------------------------------------------ tema */

export function carregarTema() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch { /* armazenamento indisponível */ }
  const prefereEscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefereEscuro ? 'escuro' : 'claro';
}

export function salvarTema(tema) {
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch { /* ignora */ }
}
