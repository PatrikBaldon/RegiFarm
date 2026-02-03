-- ============================================
-- Supabase RLS Policies per aziende_utenti
-- ============================================
-- 
-- Questo script crea le policy di sicurezza per la tabella aziende_utenti
-- che permettono agli utenti autenticati di leggere il proprio record
-- e alle policy Storage di accedere ai dati necessari per verificare l'azienda_id.
-- 
-- ISTRUZIONI:
-- 1. Vai su Supabase Dashboard -> SQL Editor
-- 2. Copia e incolla questo script
-- 3. Esegui (Run)
-- 
-- ============================================

-- Abilita RLS sulla tabella (se non già abilitato)
alter table aziende_utenti enable row level security;

-- Rimuovi policy esistenti se presenti (per permettere re-esecuzione)
drop policy if exists "utenti possono leggere proprio record" on aziende_utenti;

-- Policy per SELECT: gli utenti autenticati possono leggere il proprio record
-- Questa policy permette anche alle policy Storage di accedere ai dati
-- perché vengono eseguite con auth.uid() che corrisponde a auth_user_id
create policy "utenti possono leggere proprio record"
on aziende_utenti
for select
using (
  auth.role() = 'authenticated'
  and auth_user_id = auth.uid()
);

-- Verifica che le policy siano state create
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
from pg_policies
where tablename = 'aziende_utenti'
  and schemaname = 'public'
order by policyname;

