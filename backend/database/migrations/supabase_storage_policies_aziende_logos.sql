-- ============================================
-- Supabase Storage RLS Policies per aziende_logos
-- ============================================
-- 
-- Questo script crea le policy di sicurezza per il bucket aziende_logos
-- che permettono solo agli utenti autenticati di gestire i loghi della propria azienda.
-- 
-- ISTRUZIONI:
-- 1. Vai su Supabase Dashboard -> SQL Editor
-- 2. Copia e incolla questo script
-- 3. Esegui (Run)
-- 
-- ============================================

-- Funzione helper SECURITY DEFINER per ottenere azienda_id dell'utente
-- Questa funzione bypassa RLS perché è SECURITY DEFINER
create or replace function get_user_azienda_id()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    result_azienda_id integer;
begin
    select azienda_id into result_azienda_id
    from aziende_utenti
    where auth_user_id = auth.uid()
    limit 1;
    
    return result_azienda_id;
end;
$$;

-- Rimuovi policy esistenti se presenti (per permettere re-esecuzione)
drop policy if exists "aziende possono caricare propri loghi" on storage.objects;
drop policy if exists "aziende possono aggiornare propri loghi" on storage.objects;
drop policy if exists "aziende possono cancellare propri loghi" on storage.objects;
drop policy if exists "test upload autenticati" on storage.objects;

-- Policy per INSERT (upload nuovi loghi)
-- Usa la funzione helper per ottenere azienda_id (bypassa RLS)
create policy "aziende possono caricare propri loghi"
on storage.objects for insert
with check (
  bucket_id = 'aziende_logos'
  and auth.role() = 'authenticated'
  and get_user_azienda_id() is not null
  and (regexp_match(name, '^aziende/(\d+)/'))[1] = get_user_azienda_id()::text
);

-- Policy per UPDATE (sovrascrittura loghi esistenti)
create policy "aziende possono aggiornare propri loghi"
on storage.objects for update
using (
  bucket_id = 'aziende_logos'
  and auth.role() = 'authenticated'
  and get_user_azienda_id() is not null
  and name like concat('aziende/', get_user_azienda_id()::text, '/%')
)
with check (
  bucket_id = 'aziende_logos'
  and auth.role() = 'authenticated'
  and get_user_azienda_id() is not null
  and name like concat('aziende/', get_user_azienda_id()::text, '/%')
);

-- Policy per DELETE (rimozione loghi)
create policy "aziende possono cancellare propri loghi"
on storage.objects for delete
using (
  bucket_id = 'aziende_logos'
  and auth.role() = 'authenticated'
  and get_user_azienda_id() is not null
  and name like concat('aziende/', get_user_azienda_id()::text, '/%')
);

-- Verifica che le policy siano state create
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'objects'
  and policyname like '%aziende%'
order by policyname;

-- ============================================
-- QUERY DI TEST (eseguire nel SQL Editor con utente autenticato)
-- ============================================
-- 
-- Per testare se auth.uid() trova il record corretto:
-- 
-- SELECT 
--   auth.uid() as current_auth_uid,
--   au.id as utente_id,
--   au.auth_user_id,
--   au.azienda_id,
--   au.email,
--   CASE 
--     WHEN au.auth_user_id = auth.uid() THEN 'MATCH'
--     ELSE 'NO MATCH'
--   END as match_status
-- FROM aziende_utenti au
-- WHERE au.auth_user_id = auth.uid()
-- LIMIT 1;
-- 
-- Per testare se il path viene riconosciuto correttamente:
-- 
-- SELECT 
--   'aziende/1/logo_test.png' as test_path,
--   au.azienda_id,
--   CASE 
--     WHEN 'aziende/1/logo_test.png' LIKE concat('aziende/', au.azienda_id::text, '/%') THEN 'MATCH'
--     ELSE 'NO MATCH'
--   END as path_match
-- FROM aziende_utenti au
-- WHERE au.auth_user_id = auth.uid()
-- LIMIT 1;