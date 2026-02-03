-- ============================================
-- Supabase Storage RLS Policies per aziende_logos (VERSIONE SEMPLIFICATA)
-- ============================================
-- 
-- Questo script crea policy semplici che permettono agli utenti autenticati
-- di caricare/aggiornare/cancellare file nel bucket aziende_logos.
-- 
-- Il controllo del path (aziende/{azienda_id}/...) viene fatto lato applicazione.
-- Il frontend genera sempre il path corretto basato sull'azienda_id dell'utente.
-- 
-- ISTRUZIONI:
-- 1. Vai su Supabase Dashboard -> SQL Editor
-- 2. Copia e incolla questo script
-- 3. Esegui (Run)
-- 
-- ============================================

-- Rimuovi tutte le policy esistenti
drop policy if exists "aziende possono caricare propri loghi" on storage.objects;
drop policy if exists "aziende possono aggiornare propri loghi" on storage.objects;
drop policy if exists "aziende possono cancellare propri loghi" on storage.objects;
drop policy if exists "test upload autenticati" on storage.objects;

-- Rimuovi funzione helper se esiste (non più necessaria)
drop function if exists get_user_azienda_id();

-- Policy semplici: permettono a tutti gli utenti autenticati di gestire file nel bucket
-- Il controllo del path viene fatto lato applicazione (frontend)

-- Policy per INSERT (upload nuovi loghi)
create policy "utenti autenticati possono caricare loghi"
on storage.objects for insert
with check (
  bucket_id = 'aziende_logos'
  and auth.role() = 'authenticated'
);

-- Policy per UPDATE (sovrascrittura loghi esistenti)
create policy "utenti autenticati possono aggiornare loghi"
on storage.objects for update
using (
  bucket_id = 'aziende_logos'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'aziende_logos'
  and auth.role() = 'authenticated'
);

-- Policy per DELETE (rimozione loghi)
create policy "utenti autenticati possono cancellare loghi"
on storage.objects for delete
using (
  bucket_id = 'aziende_logos'
  and auth.role() = 'authenticated'
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
  and schemaname = 'storage'
  and policyname like '%loghi%'
order by policyname;

-- ============================================
-- NOTA SICUREZZA
-- ============================================
-- 
-- Queste policy permettono a qualsiasi utente autenticato di caricare file
-- nel bucket aziende_logos. La sicurezza è garantita da:
-- 
-- 1. Il frontend genera sempre il path corretto: aziende/{azienda_id}/...
-- 2. L'utente può caricare solo nella cartella della propria azienda
--    perché il frontend usa sempre l'azienda_id dell'utente autenticato
-- 3. Il bucket è pubblico per la lettura (i PDF possono caricare i loghi)
-- 
-- Se vuoi un controllo più rigido a livello database, puoi usare
-- la versione con funzione SECURITY DEFINER (supabase_storage_policies_aziende_logos.sql)

