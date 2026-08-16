-- =============================================================================
-- Agenda de Cobranças — estrutura do banco
--
-- Cole este arquivo inteiro no Supabase em: SQL Editor > New query > Run.
-- Pode rodar mais de uma vez sem problema.
--
-- Depois de rodar, libere os e-mails que terão acesso (última seção do arquivo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Quem pode acessar a agenda
--
-- Só os e-mails cadastrados aqui enxergam as cobranças. Isso impede que alguém
-- que descubra o endereço do site crie uma conta e leia os dados dos clientes.
-- -----------------------------------------------------------------------------
create table if not exists public.membros (
  email      text primary key,
  criado_em  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. As cobranças
-- -----------------------------------------------------------------------------
create table if not exists public.cobrancas (
  id              uuid primary key default gen_random_uuid(),
  cliente         text        not null,
  telefone        text        not null default '',
  descricao       text        not null default '',
  valor           numeric(12,2) not null default 0 check (valor >= 0),
  vencimento      date        not null,
  status          text        not null default 'pendente'
                              check (status in ('pendente', 'pago', 'cancelado')),
  obs             text        not null default '',
  grupo_id        uuid,
  parcela         integer,
  total_parcelas  integer,
  pago_em         date,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index if not exists cobrancas_vencimento_idx on public.cobrancas (vencimento);
create index if not exists cobrancas_grupo_idx      on public.cobrancas (grupo_id);

-- Mantém `atualizado_em` sempre correto, mesmo em alterações feitas fora do site.
create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists cobrancas_atualizado_em on public.cobrancas;
create trigger cobrancas_atualizado_em
  before update on public.cobrancas
  for each row execute function public.marcar_atualizacao();

-- -----------------------------------------------------------------------------
-- 3. Regras de acesso (Row Level Security)
--
-- Sem isso, a chave pública do site daria acesso de leitura e escrita a
-- qualquer pessoa. Com RLS ligado, o banco recusa tudo que as regras abaixo
-- não permitirem explicitamente.
-- -----------------------------------------------------------------------------
alter table public.cobrancas enable row level security;
alter table public.membros   enable row level security;

-- `security definer` faz a função ler a tabela `membros` ignorando o RLS dela.
-- Sem isso, a política de `membros` chamaria esta função, que leria `membros`
-- de novo — uma recursão infinita.
create or replace function public.eh_membro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.membros m
     where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "membros leem cobrancas"      on public.cobrancas;
drop policy if exists "membros criam cobrancas"     on public.cobrancas;
drop policy if exists "membros alteram cobrancas"   on public.cobrancas;
drop policy if exists "membros apagam cobrancas"    on public.cobrancas;
drop policy if exists "membros veem a equipe"       on public.membros;

create policy "membros leem cobrancas"    on public.cobrancas
  for select to authenticated using (public.eh_membro());

create policy "membros criam cobrancas"   on public.cobrancas
  for insert to authenticated with check (public.eh_membro());

create policy "membros alteram cobrancas" on public.cobrancas
  for update to authenticated using (public.eh_membro()) with check (public.eh_membro());

create policy "membros apagam cobrancas"  on public.cobrancas
  for delete to authenticated using (public.eh_membro());

-- O site consulta esta tabela para avisar quando alguém entra com um e-mail
-- que ainda não foi liberado. Ninguém consegue alterá-la pelo site: incluir ou
-- remover pessoas só pelo painel do Supabase.
create policy "membros veem a equipe" on public.membros
  for select to authenticated using (public.eh_membro());

-- =============================================================================
-- 4. LIBERE OS E-MAILS  ←←← EDITE ESTA PARTE
--
-- Troque pelos e-mails que vão usar a agenda. Precisa ser exatamente o mesmo
-- e-mail usado para criar a conta no site.
-- =============================================================================
insert into public.membros (email) values
  ('troque-pelo-seu@email.com'),
  ('troque-pelo-email-da-colega@email.com')
on conflict (email) do nothing;

-- Para conferir quem está liberado:
--   select * from public.membros;
--
-- Para remover o acesso de alguém:
--   delete from public.membros where email = 'pessoa@email.com';
