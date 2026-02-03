-- ============================================
-- DISABILITA RLS SUL BUCKET PER TEST
-- ============================================
-- 
-- ATTENZIONE: Questo script disabilita RLS sul bucket aziende_logos
-- per permettere di testare se il problema è con le policy RLS.
-- 
-- Dopo il test, riabilita RLS e usa le policy corrette.
-- 
-- ============================================

-- Verifica stato attuale
select 
  'Stato attuale bucket' as info,
  name,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where name = 'aziende_logos';

-- NOTA: Non possiamo disabilitare RLS direttamente sul bucket tramite SQL
-- Le policy RLS sono sempre attive su storage.objects
-- 
-- L'unico modo per "bypassare" RLS è:
-- 1. Usare la SERVICE_ROLE_KEY (non anon key) - bypassa tutte le policy
-- 2. Creare policy che permettono tutto (già fatto)
-- 3. Verificare che l'utente sia autenticato correttamente

-- Verifica se ci sono policy che bloccano
select 
  'Policy che potrebbero bloccare' as info,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'objects'
  and schemaname = 'storage'
  and (
    qual like '%aziende_logos%' 
    or with_check like '%aziende_logos%'
  )
order by policyname;

-- Verifica se auth.uid() è disponibile (esegui mentre sei autenticato)
select 
  'Test autenticazione' as info,
  auth.uid() as user_id,
  auth.role() as role,
  case 
    when auth.uid() is null then 'ERRORE: Nessun utente autenticato'
    when auth.role() != 'authenticated' then 'ERRORE: Ruolo non authenticated'
    else 'OK: Utente autenticato'
  end as status;

