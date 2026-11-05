-- =====================================================================
-- RESTAURAÇÃO: volta o banco ao formato que o site imbat-viagens usa
-- Pode rodar tudo de uma vez no SQL Editor (Run).
-- =====================================================================

-- 1) Remove a estrutura nova que criamos hoje (estava vazia)
drop view     if exists public.relatorio_alteracoes;
drop trigger  if exists ao_criar_usuario on auth.users;
drop table    if exists public.alteracoes cascade;
drop table    if exists public.cotacoes   cascade;
drop table    if exists public.viagens    cascade;
drop table    if exists public.perfis     cascade;
drop function if exists private.regras_viagem() cascade;
drop function if exists private.criar_perfil()  cascade;
drop function if exists private.papel_atual()   cascade;

-- 2) PERFIS (formato do site: usuário, departamento, cargo, permissões, master)
create table public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  usuario       text unique,
  email         text,
  departamento  text,
  cargo         text,
  papel         text not null default 'gerente',
  perms         jsonb not null default '{}'::jsonb,
  ativo         boolean not null default true,
  master        boolean not null default false,
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now()
);
create index perfis_criado_por_idx on public.perfis (criado_por);

-- 3) VIAGENS (formato do site)
create table public.viagens (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,
  solicitante_id uuid not null references public.perfis(id),
  status         text not null default 'Pendente',
  colaborador    text,
  departamento   text,
  origem         text,
  destino        text,
  ida            date,
  volta          date,
  horario        text,
  motivo         text,
  evento         text,
  hospedagem     text,
  transporte     text,
  observacoes    text,
  doc            jsonb not null default '{}'::jsonb,
  criado_em      timestamptz not null default now()
);
create index viagens_solicitante_idx on public.viagens (solicitante_id);
create index viagens_criado_em_idx   on public.viagens (criado_em desc);

-- 4) Religa a tabela de valores (viagens_fin) às viagens
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.viagens_fin'::regclass and contype = 'p') then
    alter table public.viagens_fin add primary key (viagem_id);
  end if;
end $$;
alter table public.viagens_fin drop constraint if exists viagens_fin_viagem_id_fkey;
alter table public.viagens_fin
  add constraint viagens_fin_viagem_id_fkey
  foreign key (viagem_id) references public.viagens(id) on delete cascade;

-- 5) Regras automáticas da viagem (função antiga, que continuava salva)
create trigger viagem_regras
  before update on public.viagens
  for each row execute function private.checar_viagem();

-- 6) Regras de acesso
alter table public.perfis  enable row level security;
alter table public.viagens enable row level security;

-- Perfis: quem está ativo vê os nomes da equipe; cada um sempre vê o próprio.
-- Cadastros e edições são feitos pela função de usuários do servidor.
create policy perfis_ler on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select private.ativo()));

create policy perfis_master_altera on public.perfis for update to authenticated
  using ((select private.master())) with check ((select private.master()));

-- Viagens
create policy viagens_ler on public.viagens for select to authenticated
  using ((solicitante_id = (select auth.uid()) and (select private.ativo()))
         or (select private.tem('aprovar'))  or (select private.tem('valores'))
         or (select private.tem('liberar'))  or (select private.tem('cotar'))
         or (select private.tem('relatorio')));

create policy viagens_criar on public.viagens for insert to authenticated
  with check (solicitante_id = (select auth.uid()) and (select private.tem('solicitar')));

create policy viagens_alterar on public.viagens for update to authenticated
  using ((solicitante_id = (select auth.uid()) and (select private.ativo()))
         or (select private.tem('aprovar')) or (select private.tem('liberar'))
         or (select private.tem('cotar')))
  with check ((solicitante_id = (select auth.uid()) and (select private.ativo()))
         or (select private.tem('aprovar')) or (select private.tem('liberar'))
         or (select private.tem('cotar')));

create policy viagens_master_apaga on public.viagens for delete to authenticated
  using ((select private.master()));

-- 7) Atualização em tempo real no site
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['perfis', 'viagens', 'viagens_fin'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- 8) Perfis dos logins que já existem
insert into public.perfis (id, nome, usuario, email, papel, perms, master)
select id,
       case when email = 'rebecagomes938@gmail.com' then 'Rebeca Gomes'
            else initcap(replace(split_part(email, '@', 1), '.', ' ')) end,
       split_part(email, '@', 1),
       email,
       case when email = 'rebecagomes938@gmail.com' then 'admin' else 'gerente' end,
       case when email = 'rebecagomes938@gmail.com' then '{}'::jsonb
            else '{"solicitar": true}'::jsonb end,
       email = 'rebecagomes938@gmail.com'
from auth.users
on conflict (id) do nothing;
