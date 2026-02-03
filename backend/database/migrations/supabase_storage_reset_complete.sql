-- ============================================
-- RESET COMPLETO: Rimuovi tutte le policy e funzioni Storage
-- ============================================
-- 
-- Questo script rimuove TUTTE le policy e funzioni esistenti
-- per permettere di ricominciare da zero.
-- 
-- ISTRUZIONI:
-- 1. Esegui PRIMA questo script per pulire tutto
-- 2. Poi esegui supabase_storage_policies_aziende_logos_simple.sql
-- 
-- ============================================

-- Rimuovi tutte le policy esistenti sul bucket aziende_logos
drop policy if exists "aziende possono caricare propri loghi" on storage.objects;
drop policy if exists "aziende possono aggiornare propri loghi" on storage.objects;
drop policy if exists "aziende possono cancellare propri loghi" on storage.objects;
drop policy if exists "utenti autenticati possono caricare loghi" on storage.objects;
drop policy if exists "utenti autenticati possono aggiornare loghi" on storage.objects;
drop policy if exists "utenti autenticati possono cancellare loghi" on storage.objects;
drop policy if exists "test upload autenticati" on storage.objects;

-- Rimuovi funzione helper se esiste
drop function if exists get_user_azienda_id();

-- Verifica che tutto sia stato rimosso
select 
  'Policy rimosse' as status,
  count(*) as count
from pg_policies
where tablename = 'objects'
  and schemaname = 'storage'
  and policyname like '%aziende%' or policyname like '%loghi%';

select 
  'Funzioni rimosse' as status,
  count(*) as count
from pg_proc
where proname = 'get_user_azienda_id';

-- ============================================
-- PROSSIMI PASSI
-- ============================================
-- 
-- Dopo aver eseguito questo script, esegui:
-- supabase_storage_policies_aziende_logos_simple.sql
-- 
-- Questo creerà policy semplici che permettono agli utenti autenticati
-- di caricare file nel bucket aziende_logos.

