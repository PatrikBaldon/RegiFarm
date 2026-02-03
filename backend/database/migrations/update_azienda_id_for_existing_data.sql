-- NOTA: Questo script NON è più necessario perché la logica di aggiornamento
-- dei dati esistenti è stata inclusa direttamente nella migration Alembic
-- (20251126_add_azienda_id_to_models.py)
-- 
-- La migration:
-- 1. Aggiunge le colonne come nullable
-- 2. Aggiorna tutti i record esistenti con la prima azienda disponibile
-- 3. Rende le colonne NOT NULL
-- 4. Aggiunge le foreign key

-- Se per qualche motivo la migration non ha funzionato correttamente,
-- puoi eseguire questo script manualmente:

DO $$
DECLARE
    default_azienda_id INTEGER;
BEGIN
    SELECT id INTO default_azienda_id 
    FROM aziende 
    WHERE deleted_at IS NULL 
    ORDER BY id 
    LIMIT 1;

    IF default_azienda_id IS NOT NULL THEN
        UPDATE fornitori SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
        UPDATE componenti_alimentari SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
        UPDATE mangimi_confezionati SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
        UPDATE piani_alimentazione SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
        UPDATE ddt SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
        UPDATE magazzino_movimenti SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
        RAISE NOTICE 'Record aggiornati con azienda_id = %', default_azienda_id;
    ELSE
        RAISE WARNING 'Nessuna azienda trovata';
    END IF;
END $$;

