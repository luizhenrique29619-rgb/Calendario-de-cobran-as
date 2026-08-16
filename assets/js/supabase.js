/**
 * Cliente do Supabase escrito à mão sobre `fetch`.
 *
 * Usa as APIs REST do próprio Supabase (GoTrue para login, PostgREST para os
 * dados), então o site continua sem dependências e sem etapa de build.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const CHAVE_SESSAO = 'agenda-cobrancas:sessao';

/** O site só entra em modo nuvem depois que config.js estiver preenchido. */
export const configurado = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const base = () => SUPABASE_URL.replace(/\/+$/, '');

/** Erro que a interface trata pedindo login de novo. */
export class SemSessao extends Error {
  constructor() {
    super('Sua sessão expirou. Entre novamente.');
    this.name = 'SemSessao';
  }
}

/* ----------------------------------------------------------------- sessão */

let sessao = lerSessao();

function lerSessao() {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function gravarSessao(resposta) {
  sessao = {
    access_token: resposta.access_token,
    refresh_token: resposta.refresh_token,
    // `expires_in` vem em segundos; guardamos o instante do vencimento.
    expira_em: Date.now() + (Number(resposta.expires_in) || 3600) * 1000,
    email: resposta.user?.email ?? sessao?.email ?? '',
  };
  try {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  } catch { /* navegador sem armazenamento: a sessão dura só esta aba */ }
}

function apagarSessao() {
  sessao = null;
  try {
    localStorage.removeItem(CHAVE_SESSAO);
  } catch { /* ignora */ }
}

export const temSessao = () => Boolean(sessao?.refresh_token);
export const emailAtual = () => sessao?.email ?? '';

/* ------------------------------------------------------------------ login */

async function chamarAuth(caminho, corpo) {
  let resposta;
  try {
    resposta = await fetch(`${base()}/auth/v1/${caminho}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error('Não foi possível falar com o servidor. Verifique sua conexão.');
  }

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(traduzirErro(dados, resposta.status));
  return dados;
}

function traduzirErro(dados, status) {
  const original = String(dados.error_description || dados.msg || dados.message || '');

  if (/invalid login credentials/i.test(original)) return 'E-mail ou senha incorretos.';
  if (/already registered|already exists/i.test(original)) return 'Este e-mail já tem cadastro. Use "Entrar".';
  if (/password.*(6|at least)/i.test(original)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/email.*invalid|unable to validate email/i.test(original)) return 'E-mail inválido.';
  if (/email not confirmed/i.test(original)) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
  if (/rate limit|too many/i.test(original)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  if (status === 401 || status === 403) return 'Acesso negado. Confira se o seu e-mail foi liberado no banco.';

  return original || `Falha na comunicação com o servidor (código ${status}).`;
}

export async function entrar(email, senha) {
  const dados = await chamarAuth('token?grant_type=password', { email, password: senha });
  gravarSessao(dados);
  return emailAtual();
}

/**
 * Cria a conta. Se o projeto exigir confirmação por e-mail, o Supabase não
 * devolve sessão — nesse caso avisamos em vez de fingir que entrou.
 */
export async function cadastrar(email, senha) {
  const dados = await chamarAuth('signup', { email, password: senha });

  if (!dados.access_token) {
    throw new Error('Conta criada. Confirme o e-mail pelo link que o Supabase enviou e depois faça login.');
  }
  gravarSessao(dados);
  return emailAtual();
}

export async function recuperarSenha(email) {
  await chamarAuth('recover', { email });
}

export async function sair() {
  const token = sessao?.access_token;
  apagarSessao();

  if (!token) return;
  // O logout é só higiene do lado do servidor: a sessão local já foi apagada.
  try {
    await fetch(`${base()}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
  } catch { /* offline: tudo bem, o importante é a sessão local ter sumido */ }
}

/** Devolve um token válido, renovando quando estiver perto de vencer. */
async function token() {
  if (!sessao?.refresh_token) throw new SemSessao();
  if (sessao.access_token && Date.now() < sessao.expira_em - 60_000) return sessao.access_token;

  try {
    const dados = await chamarAuth('token?grant_type=refresh_token', {
      refresh_token: sessao.refresh_token,
    });
    gravarSessao(dados);
    return sessao.access_token;
  } catch {
    apagarSessao();
    throw new SemSessao();
  }
}

/* ------------------------------------------------------------------ dados */

async function rest(caminho, opcoes = {}) {
  const autorizacao = await token();

  let resposta;
  try {
    resposta = await fetch(`${base()}/rest/v1/${caminho}`, {
      ...opcoes,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${autorizacao}`,
        'Content-Type': 'application/json',
        ...opcoes.headers,
      },
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Sua alteração não foi salva.');
  }

  if (resposta.status === 401) {
    apagarSessao();
    throw new SemSessao();
  }

  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.status === 403 || dados.code === '42501') {
      throw new Error('Seu e-mail ainda não foi liberado para esta agenda.');
    }
    throw new Error(traduzirErro(dados, resposta.status));
  }

  if (resposta.status === 204) return null;
  return resposta.json().catch(() => null);
}

/** Lista vazia significa que o e-mail logado não está entre os liberados. */
export async function temAcesso() {
  const linhas = await rest('membros?select=email&limit=1');
  return Array.isArray(linhas) && linhas.length > 0;
}

export const listar = () =>
  rest('cobrancas?select=*&order=vencimento.asc');

export const inserir = (linhas) =>
  rest('cobrancas', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(linhas),
  });

export const atualizar = (id, campos) =>
  rest(`cobrancas?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(campos),
  });

export const excluir = (id) =>
  rest(`cobrancas?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
