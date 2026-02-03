# Setup Policy RLS per Supabase Storage - aziende_logos

## Problema
Le policy RLS complesse non funzionano perché `auth.uid()` non è disponibile nel contesto delle policy Storage.

## Soluzione Semplice (CONSIGLIATA)

### Passo 1: Reset Completo
Esegui su Supabase SQL Editor:
```
supabase_storage_reset_complete.sql
```

### Passo 2: Crea Policy Semplici
Esegui su Supabase SQL Editor:
```
supabase_storage_policies_aziende_logos_simple.sql
```

Queste policy permettono a **tutti gli utenti autenticati** di caricare/aggiornare/cancellare file nel bucket `aziende_logos`.

### Sicurezza
La sicurezza è garantita da:
1. **Solo utenti autenticati** possono caricare (policy RLS)
2. **Il frontend genera sempre il path corretto**: `aziende/{azienda_id}/...`
3. **L'utente può caricare solo nella cartella della propria azienda** perché il frontend usa sempre l'`azienda_id` dell'utente autenticato

## Soluzione Avanzata (OPZIONALE)

Se vuoi un controllo più rigido a livello database:

### Passo 1: Assicurati che la policy RLS su aziende_utenti sia attiva
Esegui:
```
supabase_rls_policies_aziende_utenti.sql
```

### Passo 2: Crea funzione SECURITY DEFINER e policy complesse
Esegui:
```
supabase_storage_policies_aziende_logos.sql
```

Questa versione verifica anche che il path corrisponda all'`azienda_id` dell'utente.

## Verifica

Dopo aver eseguito gli script, prova a caricare un logo dal frontend:
1. Vai su Profilo
2. Carica un logo
3. Se funziona, vedrai il logo caricato correttamente

## Troubleshooting

### Errore: "new row violates row-level security policy"
- Verifica che le policy siano state create: esegui la query di verifica nello script
- Verifica che l'utente sia autenticato (deve avere un token JWT valido)
- Prova la soluzione semplice prima della soluzione avanzata

### Errore: "Bucket not found"
- Verifica che il bucket `aziende_logos` esista in Supabase Dashboard → Storage
- Verifica che il bucket sia pubblico (Settings → Public bucket)

### Errore: "Unauthorized"
- Verifica che l'utente sia autenticato nel frontend
- Verifica che il token JWT sia valido

