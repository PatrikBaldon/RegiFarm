-- ============================================
-- Policy ULTRA PERMISSIVA - SOLO PER TEST
-- ============================================
-- 
-- Questa policy permette TUTTO senza alcun controllo
-- SOLO PER TESTARE SE IL PROBLEMA È CON LE POLICY
-- 
-- ATTENZIONE: Rimuovi questa policy dopo il test!
-- 
-- ============================================

-- Rimuovi tutte le policy esistenti
drop policy if exists "TEST - permette tutto su aziende_logos" on storage.objects;
drop policy if exists "utenti autenticati possono caricare loghi" on storage.objects;
drop policy if exists "utenti autenticati possono aggiornare loghi" on storage.objects;
drop policy if exists "utenti autenticati possono cancellare loghi" on storage.objects;

-- Policy ULTRA PERMISSIVA: permette tutto senza controlli
create policy "ULTRA TEST - permette tutto"
on storage.objects for all
using (true)
with check (true);

-- Verifica
select 
  'Policy ULTRA PERMISSIVA creata' as status,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'objects'
  and schemaname = 'storage'
  and policyname like '%ULTRA%';

-- ============================================
-- DOPO IL TEST
-- ============================================
-- 
-- Se questa policy funziona, il problema è con le condizioni nelle policy
-- Se non funziona, il problema è altrove (configurazione bucket, ecc.)
-- 
-- Dopo il test, rimuovi questa policy:
-- DROP POLICY "ULTRA TEST - permette tutto" ON storage.objects;

