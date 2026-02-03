-- Script SQL per migrare i movimenti automatici delle fatture importate
-- dal conto Banca al conto "Debiti verso fornitori"
-- Eseguire direttamente in Supabase SQL Editor

BEGIN;

DO $$
DECLARE
    azienda_record RECORD;
    conto_banca_id INTEGER;
    conto_debiti_id INTEGER;
    movimento_record RECORD;
    movimenti_migrati INTEGER;
    movimenti_totali INTEGER := 0;
    delta_saldo_banca NUMERIC := 0;
    delta_saldo_debiti NUMERIC := 0;
BEGIN
    -- Itera su tutte le aziende attive
    FOR azienda_record IN 
        SELECT id, nome 
        FROM aziende 
        WHERE deleted_at IS NULL
        ORDER BY id
    LOOP
        movimenti_migrati := 0;
        delta_saldo_banca := 0;
        delta_saldo_debiti := 0;
        
        RAISE NOTICE 'Processando azienda %: %', azienda_record.id, azienda_record.nome;
        
        -- Trova il conto "Banca principale" per questa azienda
        SELECT id INTO conto_banca_id
        FROM pn_conti
        WHERE azienda_id = azienda_record.id
          AND LOWER(TRIM(nome)) LIKE '%banca%'
          AND tipo = 'banca'::pn_conto_tipo
        ORDER BY 
            CASE WHEN LOWER(TRIM(nome)) = 'banca principale' THEN 1 ELSE 2 END
        LIMIT 1;
        
        -- Trova il conto "Debiti verso fornitori" per questa azienda
        SELECT id INTO conto_debiti_id
        FROM pn_conti
        WHERE azienda_id = azienda_record.id
          AND LOWER(TRIM(nome)) = 'debiti verso fornitori'
        LIMIT 1;
        
        -- Se non trova i conti necessari, salta questa azienda
        IF conto_banca_id IS NULL THEN
            RAISE NOTICE '  ⚠️  Conto Banca non trovato, salto azienda';
            CONTINUE;
        END IF;
        
        IF conto_debiti_id IS NULL THEN
            RAISE NOTICE '  ⚠️  Conto "Debiti verso fornitori" non trovato, salto azienda';
            CONTINUE;
        END IF;
        
        RAISE NOTICE '  Conto Banca: %', conto_banca_id;
        RAISE NOTICE '  Conto Debiti: %', conto_debiti_id;
        
        -- Itera su tutti i movimenti automatici da fatture (tipo USCITA) sul conto Banca
        FOR movimento_record IN
            SELECT 
                m.id,
                m.importo,
                m.fattura_amministrazione_id,
                m.descrizione,
                m.data
            FROM pn_movimenti m
            WHERE m.azienda_id = azienda_record.id
              AND m.conto_id = conto_banca_id
              AND m.origine = 'automatico'::pn_movimento_origine
              AND m.tipo_operazione = 'uscita'::pn_movimento_tipo_operazione
              AND m.fattura_amministrazione_id IS NOT NULL
              AND m.deleted_at IS NULL
            ORDER BY m.data, m.id
        LOOP
            -- Aggiorna il conto_id del movimento
            UPDATE pn_movimenti
            SET 
                conto_id = conto_debiti_id,
                updated_at = NOW()
            WHERE id = movimento_record.id;
            
            -- Calcola i delta per i saldi
            -- Per il conto Banca: rimuove l'uscita (quindi aumenta il saldo)
            delta_saldo_banca := delta_saldo_banca + movimento_record.importo;
            -- Per il conto Debiti: aggiunge l'uscita (quindi diminuisce il saldo)
            delta_saldo_debiti := delta_saldo_debiti - movimento_record.importo;
            
            movimenti_migrati := movimenti_migrati + 1;
            
            RAISE NOTICE '  ✓ Migrato movimento %: % (€%)', 
                movimento_record.id, 
                movimento_record.descrizione,
                movimento_record.importo;
        END LOOP;
        
        -- Aggiorna i saldi dei conti
        IF movimenti_migrati > 0 THEN
            -- Aggiorna saldo conto Banca (rimuove le uscite, quindi aumenta)
            UPDATE pn_conti
            SET 
                saldo_attuale = saldo_attuale + delta_saldo_banca,
                updated_at = NOW()
            WHERE id = conto_banca_id;
            
            -- Aggiorna saldo conto Debiti (aggiunge le uscite, quindi diminuisce)
            UPDATE pn_conti
            SET 
                saldo_attuale = saldo_attuale + delta_saldo_debiti,
                updated_at = NOW()
            WHERE id = conto_debiti_id;
            
            movimenti_totali := movimenti_totali + movimenti_migrati;
            
            RAISE NOTICE '  ✅ Azienda %: migrati % movimenti', 
                azienda_record.id, 
                movimenti_migrati;
            RAISE NOTICE '     Delta Banca: +€%', delta_saldo_banca;
            RAISE NOTICE '     Delta Debiti: €%', delta_saldo_debiti;
        ELSE
            RAISE NOTICE '  - Nessun movimento da migrare';
        END IF;
        
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRAZIONE COMPLETATA';
    RAISE NOTICE 'Totale movimenti migrati: %', movimenti_totali;
    RAISE NOTICE '========================================';
END $$;

-- Verifica risultati
SELECT 
    a.id as azienda_id,
    a.nome as azienda_nome,
    COUNT(DISTINCT CASE 
        WHEN m.origine = 'automatico'::pn_movimento_origine 
         AND m.tipo_operazione = 'uscita'::pn_movimento_tipo_operazione
         AND m.fattura_amministrazione_id IS NOT NULL
         AND c.nome ILIKE '%debiti%fornitori%'
        THEN m.id 
    END) as movimenti_automatici_su_debiti,
    COUNT(DISTINCT CASE 
        WHEN m.origine = 'automatico'::pn_movimento_origine 
         AND m.tipo_operazione = 'uscita'::pn_movimento_tipo_operazione
         AND m.fattura_amministrazione_id IS NOT NULL
         AND c.tipo = 'banca'::pn_conto_tipo
        THEN m.id 
    END) as movimenti_automatici_su_banca,
    SUM(CASE 
        WHEN m.origine = 'automatico'::pn_movimento_origine 
         AND m.tipo_operazione = 'uscita'::pn_movimento_tipo_operazione
         AND m.fattura_amministrazione_id IS NOT NULL
         AND c.nome ILIKE '%debiti%fornitori%'
         AND m.deleted_at IS NULL
        THEN m.importo 
        ELSE 0 
    END) as totale_importo_su_debiti
FROM aziende a
LEFT JOIN pn_movimenti m ON m.azienda_id = a.id AND m.deleted_at IS NULL
LEFT JOIN pn_conti c ON c.id = m.conto_id
WHERE a.deleted_at IS NULL
GROUP BY a.id, a.nome
HAVING COUNT(DISTINCT CASE 
    WHEN m.origine = 'automatico'::pn_movimento_origine 
     AND m.tipo_operazione = 'uscita'::pn_movimento_tipo_operazione
     AND m.fattura_amministrazione_id IS NOT NULL
    THEN m.id 
END) > 0
ORDER BY a.id;

COMMIT;