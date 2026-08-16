/**
 * Funções utilitárias: datas, moeda e formatação de texto.
 * Datas são sempre tratadas como "YYYY-MM-DD" no fuso local,
 * evitando o deslocamento de um dia causado por new Date("2026-01-01").
 */

const moedaBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarMoeda = (valor) => moedaBRL.format(Number(valor) || 0);

/** Converte "YYYY-MM-DD" em Date local (meia-noite). */
export function paraData(iso) {
  const [ano, mes, dia] = String(iso).split('-').map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

/** Converte Date em "YYYY-MM-DD". */
export function paraISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export const hojeISO = () => paraISO(new Date());

/** Formata "YYYY-MM-DD" como "05/08/2026". */
export function formatarData(iso) {
  return paraData(iso).toLocaleDateString('pt-BR');
}

/** "Agosto de 2026" — só a primeira letra em maiúscula. */
export function nomeMes(data) {
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Diferença em dias entre duas datas ISO (b - a). */
export function diferencaDias(isoA, isoB) {
  const MS_DIA = 86400000;
  return Math.round((paraData(isoB) - paraData(isoA)) / MS_DIA);
}

/** Soma meses preservando o "fim de mês" (31/01 + 1 mês => 28/02). */
export function somarMeses(iso, meses) {
  const d = paraData(iso);
  const diaOriginal = d.getDate();
  const alvo = new Date(d.getFullYear(), d.getMonth() + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(diaOriginal, ultimoDia));
  return paraISO(alvo);
}

export function somarDias(iso, dias) {
  const d = paraData(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

/** Texto do dia relativo a hoje: "vence hoje", "venceu há 3 dias", "vence em 5 dias". */
export function textoRelativo(iso) {
  const dias = diferencaDias(hojeISO(), iso);
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias === -1) return 'venceu ontem';
  if (dias > 1) return `vence em ${dias} dias`;
  return `venceu há ${Math.abs(dias)} dias`;
}

/** Gera um identificador simples e único o suficiente para uso local. */
export const gerarId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Escapa texto que será inserido via innerHTML. */
export function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Normaliza texto para busca (sem acentos, minúsculo). */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Monta um número no padrão do WhatsApp (somente dígitos, com DDI 55). */
export function telefoneWhatsApp(telefone) {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  if (digitos.length < 10) return null;
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}
