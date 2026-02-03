-- ============================================
-- Verifica Policy Attive
-- ============================================
-- 
-- Esegui questa query per vedere tutte le policy attive
-- 
-- ============================================

-- Verifica tutte le policy su storage.objects per aziende_logos
select 
  policyname,
  cmd,
  permissive,
  qual,
  with_check
from pg_policies
where tablename = 'objects'
  and schemaname = 'storage'
  and (
    qual like '%aziende_logos%' 
    or with_check like '%aziende_logos%'
    or policyname like '%loghi%'
    or policyname like '%aziende%'
    or policyname like '%TEST%'
  )
order by policyname;

-- Se vedi "TEST - permette tutto su aziende_logos", quella è la policy permissiva
-- Se non la vedi, esegui di nuovo: supabase_storage_policy_test_permissive.sql

