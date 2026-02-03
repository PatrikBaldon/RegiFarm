-- ============================================
-- Diagnostica completa Storage RLS
-- ============================================
-- 
-- Questo script verifica tutte le policy e la configurazione del bucket
-- per diagnosticare problemi con l'upload
-- 
-- ============================================

-- 1. Verifica tutte le policy sul bucket aziende_logos
select 
  'Tutte le policy su storage.objects' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  qual,
  with_check
from pg_policies
where tablename = 'objects'
  and schemaname = 'storage'
order by policyname;

-- 2. Verifica configurazione bucket
select 
  'Configurazione bucket' as check_type,
  name,
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where name = 'aziende_logos';

-- 3. Verifica se ci sono policy su altri bucket che potrebbero interferire
select 
  'Policy su altri bucket' as check_type,
  count(*) as count
from pg_policies
where tablename = 'objects'
  and schemaname = 'storage'
  and policyname not like '%loghi%'
  and policyname not like '%aziende%';

-- 4. Verifica funzioni helper
select 
  'Funzioni helper' as check_type,
  proname as function_name,
  prosrc as function_body
from pg_proc
where proname like '%azienda%' or proname like '%logo%';

-- 5. Test: verifica se auth.uid() funziona
-- (Esegui questa query mentre sei autenticato nel frontend)
select 
  'Test auth.uid()' as check_type,
  auth.uid() as current_user_id,
  auth.role() as current_role,
  case 
    when auth.uid() is not null then 'OK - Utente autenticato'
    else 'ERRORE - Nessun utente autenticato'
  end as status;

-- 6. Verifica policy RLS su aziende_utenti
select 
  'Policy RLS su aziende_utenti' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
from pg_policies
where tablename = 'aziende_utenti'
  and schemaname = 'public';

