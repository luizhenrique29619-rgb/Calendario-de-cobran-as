/**
 * Camada de dados com dois modos, atrás da mesma interface:
 *
 *  - nuvem: config.js preenchido. As cobranças ficam no Supabase e todo mundo
 *           que tem acesso enxerga a mesma agenda, de qualquer aparelho.
 *  - local: config.js vazio. As cobranças ficam só no navegador atual.
 *
 * O app.js não precisa saber em qual dos dois está — só `modo()` muda a
 * mensagem exibida ao usuário.
 */

import * as nuvem from './supabase.js';
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

export const modo = () => (nuvem.configurado() ? 'nuvem' : 'local');
export { SemSessao } from './supabase.js';

/* ------------------------------------------------------------- saneamento */

function ehCobrancaValida(item) {
  return item && typeof item === 'object'
    && typeof item.cliente === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(String(item.vencimento));
}

/** Dá forma conhecida a uma cobrança, venha ela do banco, do backup ou do form. */
function normalizar(item) {
  return {
    id: item.id ?? null,
    cliente: String(item.cliente).slice(0, 80),
    telefone: String(item.telefone ?? '').slice(0, 20),
    descricao: String(item.descricao ?? '').slice(0, 120),
    valor: Math.max(0, Number(item.valor) || 0),
    vencimento: item.vencimento,
    status: STATUS.includes(item.status) ? item.status : 'pendente',
    obs: String(item.obs ?? '').slice(0, 300),
    grupoId: item.grupoId ?? item.grupo_id ?? null,
    parcela: Number(item.parcela) || null,
    totalParcelas: Number(item.totalParcelas ?? item.total_parcelas) || null,
    pagoEm: item.pagoEm ?? item.pago_em ?? null,
    criadoEm: item.criadoEm ?? item.criado_em ?? new Date().toISOString(),
  };
}

/** Converte para os nomes de coluna do banco. */
function paraBanco(c) {
  return {
    cliente: c.cliente,
    telefone: c.telefone,
    descricao: c.descricao,
    valor: c.valor,
    vencimento: c.vencimento,
    status: c.status,
    obs: c.obs,
    grupo_id: c.grupoId,
    parcela: c.parcela,
    total_parcelas: c.totalParcelas,
    pago_em: c.pagoEm,
  };
}

/** Só os campos enviados, já traduzidos para o banco. */
function camposParaBanco(campos) {
  const mapa = {
    grupoId: 'grupo_id',
    totalParcelas: 'total_parcelas',
    pagoEm: 'pago_em',
    criadoEm: 'criado_em',
  };
  const saida = {};
  for (const [chave, valor] of Object.entries(campos)) {
    if (chave === 'id') continue;
    saida[mapa[chave] ?? chave] = valor;
  }
  return saida;
}

/**
 * Status efetivo: uma cobrança pendente com vencimento passado é "atrasado".
 * Esse status é derivado, não é gravado.
 */
export function statusEfetivo(cobranca) {
  if (cobranca.status === 'pendente' && cobranca.vencimento < hojeISO()) return 'atrasado';
  return cobranca.status;
}

/* --------------------------------------------------------- recorrência */

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

/**
 * Gera as ocorrências a partir dos dados do formulário.
 * Sem recorrência, devolve uma única cobrança.
 */
export function gerarOcorrencias(dados) {
  const total = Math.min(Math.max(Number(dados.parcelas) || 1, 1), 60);
  const repetir = dados.recorrencia && dados.recorrencia !== 'nenhuma' && total > 1;
  const quantidade = repetir ? total : 1;

  // No modo nuvem o id do grupo precisa ser um UUID, que é o tipo da coluna.
  const grupoId = repetir ? novoUUID() : null;

  const lista = [];
  for (let i = 0; i < quantidade; i += 1) {
    lista.push(normalizar({
      ...dados,
      id: null,
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

function novoUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Navegadores antigos ou páginas fora de HTTPS não têm randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ------------------------------------------------------------ modo local */

function lerLocal() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? dados.filter(ehCobrancaValida).map(normalizar) : [];
  } catch {
    return [];
  }
}

function gravarLocal(lista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    throw new Error('Não foi possível salvar no navegador. Verifique o espaço disponível.');
  }
}

/** Cobranças guardadas no navegador — usado para migrar para a nuvem. */
export const lerCobrancasLocais = lerLocal;

export function apagarCobrancasLocais() {
  try {
    localStorage.removeItem(CHAVE);
  } catch { /* ignora */ }
}

/* -------------------------------------------------------------- interface */

export async function listar() {
  if (modo() === 'local') return lerLocal();
  const linhas = await nuvem.listar();
  return (linhas ?? []).map(normalizar);
}

export async function inserirVarias(cobrancas) {
  const preparadas = cobrancas.map(normalizar);

  if (modo() === 'local') {
    const lista = lerLocal();
    const criadas = preparadas.map((c) => ({ ...c, id: c.id || gerarId() }));
    gravarLocal([...lista, ...criadas]);
    return criadas;
  }

  const linhas = await nuvem.inserir(preparadas.map(paraBanco));
  return (linhas ?? []).map(normalizar);
}

export async function atualizar(id, campos) {
  if (modo() === 'local') {
    const lista = lerLocal();
    const indice = lista.findIndex((c) => c.id === id);
    if (indice < 0) throw new Error('Cobrança não encontrada.');
    lista[indice] = normalizar({ ...lista[indice], ...campos });
    gravarLocal(lista);
    return lista[indice];
  }

  const linhas = await nuvem.atualizar(id, camposParaBanco(campos));
  if (!linhas?.length) throw new Error('Cobrança não encontrada.');
  return normalizar(linhas[0]);
}

export async function excluir(id) {
  if (modo() === 'local') {
    gravarLocal(lerLocal().filter((c) => c.id !== id));
    return;
  }
  await nuvem.excluir(id);
}

/** Apaga tudo. No modo nuvem some para todo mundo — o app.js confirma antes. */
export async function apagarTudo() {
  if (modo() === 'local') {
    gravarLocal([]);
    return;
  }
  const lista = await listar();
  for (const c of lista) await nuvem.excluir(c.id);
}

/* ------------------------------------------------------------------ tema */

export function carregarTema() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch { /* armazenamento indisponível */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

export function salvarTema(tema) {
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch { /* ignora */ }
}
