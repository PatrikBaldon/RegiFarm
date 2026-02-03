-- ============================================
-- Policy TEST - MOLTO PERMISSIVA
-- ============================================
-- 
-- Questa policy permette TUTTO solo per testare se il problema
-- è con auth.role() o auth.uid()
-- 
-- ATTENZIONE: Rimuovi questa policy dopo il test!
-- 
-- ============================================

-- Rimuovi policy esistenti
drop policy if exists "utenti autenticati possono caricare loghi" on storage.objects;
drop policy if exists "utenti autenticati possono aggiornare loghi" on storage.objects;
drop policy if exists "utenti autenticati possono cancellare loghi" on storage.objects;

-- Policy TEST: permette tutto nel bucket aziende_logos
-- (NON verifica autenticazione - SOLO PER TEST)
create policy "TEST - permette tutto su aziende_logos"
on storage.objects for all
using (bucket_id = 'aziende_logos')
with check (bucket_id = 'aziende_logos');

-- Verifica
select 
  'Policy TEST creata' as status,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'objects'
  and schemaname = 'storage'
  and policyname like '%TEST%';

-- ============================================
-- DOPO IL TEST
-- ============================================
-- 
-- Se questa policy funziona, il problema è con auth.role() o auth.uid()
-- Se non funziona, il problema è altrove (bucket, configurazione, ecc.)
-- 
-- Dopo il test, rimuovi questa policy e ripristina le policy normali:
-- 
-- DROP POLICY "TEST - permette tutto su aziende_logos" ON storage.objects;
-- 
-- Poi esegui di nuovo: supabase_storage_policies_aziende_logos_simple.sql

