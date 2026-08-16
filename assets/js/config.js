/**
 * ============================================================================
 *  CONFIGURAÇÃO DO BANCO DE DADOS  ←←← EDITE ESTE ARQUIVO
 * ============================================================================
 *
 *  Enquanto os dois valores abaixo estiverem vazios, o site funciona em
 *  "modo local": as cobranças ficam salvas só no navegador que você está
 *  usando, e ninguém mais enxerga.
 *
 *  Para você e sua colega verem a mesma agenda:
 *
 *   1. Crie uma conta gratuita em https://supabase.com e um novo projeto.
 *   2. No projeto, abra "SQL Editor", cole todo o conteúdo do arquivo
 *      supabase/schema.sql e clique em Run. Antes de rodar, troque os e-mails
 *      no final do arquivo pelos e-mails de vocês duas.
 *   3. Vá em "Project Settings" > "API" e copie os dois valores abaixo:
 *        - Project URL          -> SUPABASE_URL
 *        - anon / public key    -> SUPABASE_ANON_KEY
 *   4. Cole aqui, salve, e envie para o GitHub. A Vercel republica sozinha.
 *
 *  A chave "anon" é pública de propósito — ela vai no código do site e
 *  qualquer visitante consegue lê-la. Quem protege os dados são as regras de
 *  acesso (RLS) criadas pelo schema.sql: sem estar na lista de e-mails
 *  liberados, essa chave não abre nada. NUNCA coloque aqui a chave
 *  "service_role": essa ignora todas as regras.
 */

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
