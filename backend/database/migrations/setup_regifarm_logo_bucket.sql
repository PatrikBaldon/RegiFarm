-- ============================================
-- Setup bucket pubblico per logo RegiFarm
-- ============================================
-- 
-- Questo script crea un bucket pubblico in Supabase Storage per il logo RegiFarm.
-- Il logo sarà accessibile a tutte le aziende senza autenticazione.
-- 
-- ISTRUZIONI:
-- 1. Vai su Supabase Dashboard -> Storage
-- 2. Crea manualmente un bucket chiamato 'regifarm_assets'
-- 3. Imposta il bucket come PUBLIC (Settings -> Public bucket)
-- 4. Vai su SQL Editor e esegui questo script per creare le policy
-- 
-- Dopo aver eseguito questo script, carica il logo:
-- - Path nel bucket: RegiFarm_Logo.png
-- - Oppure usa la UI di Supabase Storage per caricare il file
-- 
-- ============================================

-- Rimuovi policy esistenti se presenti
drop policy if exists "Logo RegiFarm pubblico accessibile a tutti" on storage.objects;
drop policy if exists "Logo RegiFarm leggibile pubblicamente" on storage.objects;

-- Policy per permettere la lettura pubblica del logo
-- Nota: per sicurezza, solo gli admin possono modificare il logo
-- Per permettere upload via API con service role key, usa una policy separata

-- Policy per SELECT (lettura pubblica)
create policy "Logo RegiFarm leggibile pubblicamente"
on storage.objects for select
using (
  bucket_id = 'regifarm_assets'
  and name = 'RegiFarm_Logo.png'
);

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- Per caricare il logo inizialmente, usa uno di questi metodi:
--
-- 1. Via Supabase Dashboard:
--    - Vai su Storage -> regifarm_assets
--    - Clicca "Upload file"
--    - Carica RegiFarm_Logo.png
--
-- 2. Via API con Service Role Key (da backend):
--    ```python
--    from app.services.supabase_client import get_supabase_client
--    supabase = get_supabase_client()
--    with open('RegiFarm_Logo.png', 'rb') as f:
--        supabase.storage.from('regifarm_assets').upload(
--            'RegiFarm_Logo.png', 
--            f.read(),
--            {'content-type': 'image/png', 'upsert': 'true'}
--        )
--    ```
--
-- 3. Via curl (da terminale):
--    ```bash
--    curl -X POST \
--      "${SUPABASE_URL}/storage/v1/object/regifarm_assets/RegiFarm_Logo.png" \
--      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
--      -H "Content-Type: image/png" \
--      -H "x-upsert: true" \
--      --data-binary @RegiFarm_Logo.png
--    ```
--
-- URL pubblico del logo dopo il caricamento:
-- ${SUPABASE_URL}/storage/v1/object/public/regifarm_assets/RegiFarm_Logo.png
-- ============================================
