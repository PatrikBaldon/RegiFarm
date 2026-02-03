# Semplificazione Prima Nota – Piano (aggiornato)

## Regola su eliminazione conti

**Conti aggiuntivi:** eventuali conti già esistenti che non rientrano nell’insieme essenziale (Cassa/Banca creati dall’utente + conti sistema: Vendite, IVA vendite, Crediti vs clienti, Acquisti, IVA acquisti, Debiti vs fornitori, Soccida monetizzata - Acconti) **devono essere eliminati**.

**Vincolo di sicurezza:** **non eliminare mai** un conto che ha dati collegati (movimenti, collegamenti da preferenze, ecc.). Eliminare **solo** i conti aggiuntivi che risultano **senza movimenti** (e senza altri dati significativi). I conti con dati presenti vanno lasciati così com’è (eventualmente escluderli dalla UI semplificata o marcarli come “storici” senza rimuoverli dal DB).

In sintesi:
- **Eliminare:** conti non essenziali **e** senza movimenti/dati.
- **Non eliminare:** conti con almeno un movimento o altro dato collegato (anche se non rientrano nell’insieme essenziale).

---

*Il resto del piano (conti essenziali, automazione fatture, partita chiusa, saldo a chiusura soccida, semplificazione UI) resta invariato come già definito.*
