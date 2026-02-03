-- ============================================
-- APPLICA POLICY ULTRA PERMISSIVA
-- ============================================
-- 
-- Questo script rimuove TUTTE le policy esistenti
-- e crea una policy ultra permissiva che permette tutto
-- SOLO PER TESTARE
-- 
-- ============================================

-- Rimuovi TUTTE le policy esistenti su storage.objects
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

-- Rimuovi anche funzioni helper se esistono
DROP FUNCTION IF EXISTS get_user_azienda_id();

-- Crea policy ULTRA PERMISSIVA: permette TUTTO senza controlli
CREATE POLICY "ULTRA TEST - permette tutto"
ON storage.objects FOR ALL
USING (true)
WITH CHECK (true);

-- Verifica che sia stata creata
SELECT 
    'Policy ULTRA PERMISSIVA creata' AS status,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%ULTRA%';

-- Mostra tutte le policy rimanenti (dovrebbe essere solo una)
SELECT 
    'Tutte le policy su storage.objects' AS info,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;

