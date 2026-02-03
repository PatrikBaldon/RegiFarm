import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './Profilo.css';
import { useAzienda } from '../../../context/AziendaContext';
import { aziendeService } from '../../allevamento/services/aziendeService';
import { alimentazioneService } from '../../alimentazione/services/alimentazioneService';
import { amministrazioneService } from '../../amministrazione/services/amministrazioneService';
import SearchableSelect from '../../../components/SearchableSelect';
import AssicurazioniAzienda from '../../allevamento/components/hierarchy/AssicurazioniAzienda';
import '../../allevamento/components/hierarchy/AssicurazioniAzienda.css';
import { supabase, isSupabaseConfigured } from '../../../services/supabaseClient';
import { useAuth } from '../../../context/AuthContext';

const LOGO_BUCKET = 'aziende_logos';
const SUPABASE_URL = process.env.SUPABASE_URL;

// Funzione helper per upload diretto via HTTP con token JWT
const uploadLogoDirectHTTP = async (accessToken, path, file) => {
  if (!SUPABASE_URL) {
    return { error: new Error('SUPABASE_URL non configurato') };
  }

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${LOGO_BUCKET}/${path}`;
  
  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      return { 
        error: {
          message: errorData.message || errorData.error || `HTTP ${response.status}`,
          statusCode: response.status,
          fullError: errorData,
        }
      };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    return { error: err };
  }
};
const MAX_LOGO_SIZE = 500 * 1024; // 500 KB
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const emptyFormState = {
  nome: '',
  codice_fiscale: '',
  partita_iva: '',
  indirizzo: '',
  indirizzo_cap: '',
  indirizzo_comune: '',
  indirizzo_provincia: '',
  indirizzo_nazione: 'IT',
  telefono: '',
  email: '',
  pec: '',
  codice_sdi: '',
  rea_ufficio: '',
  rea_numero: '',
  rea_capitale_sociale: '',
  referente_nome: '',
  referente_email: '',
  referente_telefono: '',
  sito_web: '',
  iban: '',
  veterinario_id: null,
  logo_storage_path: '',
  logo_public_url: '',
};

const sanitizePayload = (data) => {
  const sanitized = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === '' || value === undefined) {
      sanitized[key] = null;
    } else {
      sanitized[key] = value;
    }
  });
  return sanitized;
};

const Profilo = () => {
  const { azienda, loading, error, refresh } = useAzienda();
  const { signOut } = useAuth();
  const [formData, setFormData] = useState(emptyFormState);
  const [saving, setSaving] = useState(false);
  const [veterinari, setVeterinari] = useState([]);
  const [veterinariLoading, setVeterinariLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(null);

  const isEditing = useMemo(() => Boolean(azienda?.id), [azienda]);
  const canUploadLogo = useMemo(
    () => Boolean(isEditing && azienda?.id && isSupabaseConfigured && supabase),
    [azienda?.id, isEditing]
  );

  useEffect(() => {
    if (azienda) {
      setFormData({
        ...emptyFormState,
        ...azienda,
      });
    } else {
      setFormData(emptyFormState);
    }
  }, [azienda]);

  const loadVeterinari = useCallback(async () => {
    try {
      setVeterinariLoading(true);
      const fornitori = await amministrazioneService.getFornitori();
      const tipiFornitori = await amministrazioneService.getFornitoriTipi();
      const veterinariIds = (tipiFornitori || [])
        .filter((tipo) => tipo.categoria === 'veterinario')
        .map((tipo) => tipo.fornitore_id);
      const listaVeterinari = (fornitori || []).filter((fornitore) => veterinariIds.includes(fornitore.id));
      setVeterinari(listaVeterinari);
    } catch (err) {

      setVeterinari([]);
    } finally {
      setVeterinariLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVeterinari();
  }, [loadVeterinari]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleVeterinarioChange = (event) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      veterinario_id: value ? parseInt(value, 10) : null,
    }));
  };

  const uploadLogoFile = useCallback(
    async (file) => {
      if (!canUploadLogo) {
        setLogoError('Configura Supabase e salva il profilo per caricare il logo.');
        return;
      }
      if (!file) return;
      if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
        setLogoError('Formato non supportato. Usa PNG, JPG, WEBP o SVG.');
        return;
      }
      if (file.size > MAX_LOGO_SIZE) {
        setLogoError('Il file supera il limite di 500 KB.');
        return;
      }
      if (!azienda?.id) {
        setLogoError('Salva prima il profilo aziendale per caricare il logo.');
        return;
      }
      if (!supabase) {
        setLogoError('Supabase non configurato.');
        return;
      }

      setLogoUploading(true);
      setLogoError(null);
      try {
        // Verifica che la sessione sia attiva e gestisci scadenza token
        let sessionData = await supabase.auth.getSession();
        const now = Date.now();
        const expiresAt = sessionData.data?.session?.expires_at 
          ? sessionData.data.session.expires_at * 1000 
          : null;
        const isTokenExpired = expiresAt && expiresAt < now;
        
        // Se il token è scaduto, prova a fare refresh
        if (isTokenExpired || !sessionData.data?.session?.access_token) {

          const refreshResult = await supabase.auth.refreshSession();
          
          if (refreshResult.data?.session && refreshResult.data.session.access_token) {
            sessionData = refreshResult;

          } else {
            // Se il refresh fallisce, il token è definitivamente scaduto

            setLogoError('La sessione è scaduta. Effettua nuovamente il login.');
            await signOut();
            // Mostra un alert per informare l'utente
            setTimeout(() => {
              alert('La sessione è scaduta. Verrai reindirizzato al login.');
              window.location.reload(); // Ricarica la pagina per mostrare la schermata di login
            }, 100);
            return;
          }
        }

        const token = sessionData.data?.session?.access_token;
        const tokenPreview = token ? `${token.substring(0, 20)}...${token.substring(token.length - 20)}` : 'N/A';
        const expiresIn = expiresAt ? Math.floor((expiresAt - now) / 1000) : 'N/A';
        
        // Decodifica token JWT per vedere il contenuto
        let tokenPayload = null;
        if (token) {
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              tokenPayload = {
                sub: payload.sub,
                role: payload.role,
                email: payload.email,
                exp: payload.exp,
                iat: payload.iat,
              };
            }
          } catch (e) {

          }
        }

        if (!sessionData.data?.session) {
          setLogoError('Sessione non valida. Effettua il login e riprova.');
          await signOut();
          setTimeout(() => {
            alert('Sessione non valida. Verrai reindirizzato al login.');
            window.location.reload();
          }, 100);
          return;
        }
        
        if (!token) {
          setLogoError('Token di accesso non disponibile. Effettua il login e riprova.');
          await signOut();
          setTimeout(() => {
            alert('Token non disponibile. Verrai reindirizzato al login.');
            window.location.reload();
          }, 100);
          return;
        }

        const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
        const sanitizedExt = extension.replace(/[^a-z0-9]/gi, '') || 'png';
        const path = `aziende/${azienda.id}/logo_${Date.now()}.${sanitizedExt}`;

        // Elimina il logo esistente se presente (verifica sia nel formData che nell'azienda)
        const existingLogoPath = formData.logo_storage_path || azienda?.logo_storage_path;
        if (existingLogoPath) {
          try {
            await supabase.storage.from(LOGO_BUCKET).remove([existingLogoPath]);

          } catch (removeError) {
            // Non bloccare il caricamento se l'eliminazione fallisce (potrebbe non esistere)
          }
        }

        // Usa SEMPRE l'upload diretto HTTP con il token esplicito
        // perché il client Supabase potrebbe non passare correttamente il token

        const directUploadResult = await uploadLogoDirectHTTP(token, path, file);
        
        if (directUploadResult.error) {

          throw directUploadResult.error;
        }
        


        // Ottieni URL pubblico (funziona sempre, anche dopo upload diretto)
        const { data: publicUrlData, error: publicUrlError } = supabase.storage
          .from(LOGO_BUCKET)
          .getPublicUrl(path);
        if (publicUrlError) {
          throw publicUrlError;
        }

        const publicUrl = publicUrlData?.publicUrl;
        await aziendeService.updateAzienda(azienda.id, {
          logo_storage_path: path,
          logo_public_url: publicUrl,
        });
        setFormData((prev) => ({
          ...prev,
          logo_storage_path: path,
          logo_public_url: publicUrl,
        }));
        await refresh();
      } catch (err) {

        setLogoError(err?.message || 'Errore durante il caricamento del logo.');
      } finally {
        setLogoUploading(false);
      }
    },
    [azienda?.id, azienda?.logo_storage_path, canUploadLogo, formData.logo_storage_path, refresh, signOut]
  );

  const handleLogoFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        event.target.value = '';
        return;
      }

      // Controlla se esiste già un logo (verifica sia nel formData che nell'azienda)
      const hasExistingLogo = Boolean(
        formData.logo_public_url || 
        formData.logo_storage_path || 
        azienda?.logo_public_url || 
        azienda?.logo_storage_path
      );
      
      if (hasExistingLogo) {
        // Chiedi conferma all'utente se vuole sovrascrivere il logo esistente
        const confirmMessage = 'Esiste già un logo caricato. Vuoi sostituirlo con il nuovo file? Il logo esistente verrà eliminato.';
        const userWantsToReplace = window.confirm(confirmMessage);
        
        if (!userWantsToReplace) {
          // L'utente non vuole sostituire, annulla l'operazione
          event.target.value = '';
          return;
        }
      }

      // Procedi con il caricamento (il vecchio logo verrà eliminato in uploadLogoFile)
      uploadLogoFile(file);
      event.target.value = '';
    },
    [uploadLogoFile, formData.logo_public_url, formData.logo_storage_path, azienda?.logo_public_url, azienda?.logo_storage_path]
  );

  const handleLogoRemove = useCallback(async () => {
    if (!canUploadLogo || !azienda?.id) {
      setLogoError('Configura Supabase e salva il profilo per gestire il logo.');
      return;
    }
    if (!formData.logo_storage_path && !formData.logo_public_url) {
      return;
    }
    if (!supabase) {
      setLogoError('Supabase non configurato.');
      return;
    }

    setLogoUploading(true);
    setLogoError(null);
    try {
      if (formData.logo_storage_path) {
        await supabase.storage.from(LOGO_BUCKET).remove([formData.logo_storage_path]);
      }
      await aziendeService.updateAzienda(azienda.id, {
        logo_storage_path: null,
        logo_public_url: null,
      });
      setFormData((prev) => ({
        ...prev,
        logo_storage_path: '',
        logo_public_url: '',
      }));
      await refresh();
    } catch (err) {

      setLogoError(err?.message || 'Errore durante la rimozione del logo.');
    } finally {
      setLogoUploading(false);
    }
  }, [azienda?.id, canUploadLogo, formData.logo_storage_path, formData.logo_public_url, refresh]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const payload = sanitizePayload(formData);
      if (payload.veterinario_id !== null && payload.veterinario_id !== undefined) {
        payload.veterinario_id = Number(payload.veterinario_id);
      }
      if (isEditing) {
        await aziendeService.updateAzienda(azienda.id, payload);
      } else {
        await aziendeService.createAzienda(payload);
      }
      await refresh();
      alert('Profilo azienda salvato con successo.');
    } catch (err) {

      alert(`Errore nel salvataggio del profilo azienda: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (azienda) {
      setFormData({
        ...emptyFormState,
        ...azienda,
      });
    } else {
      setFormData(emptyFormState);
    }
  };

  return (
    <div className="profilo-module">
      <header className="profilo-header">
        <div>
          <h2>Profilo Aziendale</h2>
          <p>
            Gestisci qui tutti i dati anagrafici e fiscali della tua azienda. Il resto
            dell&apos;applicazione userà automaticamente queste informazioni.
          </p>
        </div>
      </header>

      {error && (
        <div className="profilo-alert profilo-alert-error">
          Errore nel caricamento dell&apos;azienda. Riprova o contatta il supporto.
        </div>
      )}

      {!loading && !azienda && (
        <div className="profilo-alert profilo-alert-info">
          Non è ancora configurata alcuna azienda. Compila il modulo qui sotto per creare il profilo.
        </div>
      )}

      {loading ? (
        <div className="profilo-loading">Caricamento dati azienda...</div>
      ) : (
        <form className="profilo-form" onSubmit={handleSubmit}>
          <section className="profilo-card">
            <h3>Dati Anagrafici</h3>
            <div className="profilo-grid">
              <div className="profilo-field">
                <label>Denominazione *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={handleChange('nome')}
                  required
                />
              </div>
              <div className="profilo-field">
                <label>Codice Fiscale *</label>
                <input
                  type="text"
                  value={formData.codice_fiscale}
                  onChange={handleChange('codice_fiscale')}
                  required
                />
              </div>
              <div className="profilo-field">
                <label>Partita IVA</label>
                <input
                  type="text"
                  value={formData.partita_iva || ''}
                  onChange={handleChange('partita_iva')}
                />
              </div>
              <div className="profilo-field profilocard-span-2">
                <label>Indirizzo</label>
                <input
                  type="text"
                  value={formData.indirizzo || ''}
                  onChange={handleChange('indirizzo')}
                />
              </div>
              <div className="profilo-field">
                <label>CAP</label>
                <input
                  type="text"
                  value={formData.indirizzo_cap || ''}
                  onChange={handleChange('indirizzo_cap')}
                />
              </div>
              <div className="profilo-field">
                <label>Comune</label>
                <input
                  type="text"
                  value={formData.indirizzo_comune || ''}
                  onChange={handleChange('indirizzo_comune')}
                />
              </div>
              <div className="profilo-field">
                <label>Provincia</label>
                <input
                  type="text"
                  value={formData.indirizzo_provincia || ''}
                  onChange={handleChange('indirizzo_provincia')}
                />
              </div>
              <div className="profilo-field">
                <label>Nazione</label>
                <input
                  type="text"
                  value={formData.indirizzo_nazione || ''}
                  onChange={handleChange('indirizzo_nazione')}
                  maxLength={5}
                />
              </div>
            </div>
          </section>

          <section className="profilo-card">
            <h3>Logo aziendale</h3>
            <p className="profilo-logo-hint">
              Il logo verrà utilizzato nell&apos;intestazione dei PDF. Formati supportati: PNG, JPG, WEBP o SVG.
              Dimensione massima 500 KB.
            </p>
            <div className="profilo-logo-upload">
              <div className="profilo-logo-preview-wrapper">
                {formData.logo_public_url ? (
                  <img
                    src={formData.logo_public_url}
                    alt="Logo aziendale"
                    className="profilo-logo-preview"
                  />
                ) : (
                  <div className="profilo-logo-placeholder">
                    <span>Nessun logo caricato</span>
                  </div>
                )}
              </div>
              <div className="profilo-logo-actions">
                <input
                  id="logoUploadInput"
                  type="file"
                  accept={ALLOWED_LOGO_TYPES.join(',')}
                  onChange={handleLogoFileChange}
                  disabled={!canUploadLogo || logoUploading}
                />
                {!isSupabaseConfigured && (
                  <p className="profilo-logo-error">
                    Configura SUPABASE_URL e SUPABASE_ANON_KEY per poter caricare il logo.
                  </p>
                )}
                {!azienda?.id && (
                  <p className="profilo-logo-note">
                    Salva prima il profilo aziendale per attivare il caricamento del logo.
                  </p>
                )}
                {logoError && <p className="profilo-logo-error">{logoError}</p>}
                <div className="profilo-logo-buttons">
                  {formData.logo_public_url && (
                    <button
                      type="button"
                      className="profilo-logo-remove"
                      onClick={handleLogoRemove}
                      disabled={logoUploading}
                    >
                      Rimuovi logo
                    </button>
                  )}
                  {logoUploading && <p className="profilo-logo-note">Caricamento in corso...</p>}
                </div>
              </div>
            </div>
          </section>

          <section className="profilo-card">
            <h3>Contatti</h3>
            <div className="profilo-grid">
              <div className="profilo-field">
                <label>Telefono</label>
                <input
                  type="text"
                  value={formData.telefono || ''}
                  onChange={handleChange('telefono')}
                />
              </div>
              <div className="profilo-field">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={handleChange('email')}
                />
              </div>
              <div className="profilo-field">
                <label>Sito web</label>
                <input
                  type="text"
                  value={formData.sito_web || ''}
                  onChange={handleChange('sito_web')}
                />
              </div>
            </div>
          </section>

          <section className="profilo-card">
            <h3>Dati Fiscali</h3>
            <div className="profilo-grid">
              <div className="profilo-field">
                <label>Codice SDI</label>
                <input
                  type="text"
                  value={formData.codice_sdi || ''}
                  onChange={handleChange('codice_sdi')}
                  maxLength={10}
                  placeholder="Codice Sistema di Interscambio"
                />
              </div>
              <div className="profilo-field">
                <label>PEC Fatturazione</label>
                <input
                  type="email"
                  value={formData.pec || ''}
                  onChange={handleChange('pec')}
                  placeholder="indirizzo@pec.it"
                />
              </div>
              <div className="profilo-field">
                <label>REA - Ufficio</label>
                <input
                  type="text"
                  value={formData.rea_ufficio || ''}
                  onChange={handleChange('rea_ufficio')}
                  placeholder="Es: Milano, Roma, Torino"
                />
                <small style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'block' }}>
                  Camera di Commercio competente per territorio
                </small>
              </div>
              <div className="profilo-field">
                <label>REA - Numero</label>
                <input
                  type="text"
                  value={formData.rea_numero || ''}
                  onChange={handleChange('rea_numero')}
                  placeholder="Numero iscrizione REA"
                />
                <small style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'block' }}>
                  Numero di iscrizione al Registro delle Imprese
                </small>
              </div>
              <div className="profilo-field">
                <label>REA - Capitale Sociale</label>
                <input
                  type="text"
                  value={formData.rea_capitale_sociale || ''}
                  onChange={handleChange('rea_capitale_sociale')}
                  placeholder="Es: € 10.000,00"
                />
                <small style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'block' }}>
                  Capitale sociale dichiarato all'iscrizione
                </small>
              </div>
              <div className="profilo-field profilocard-span-2">
                <label>IBAN</label>
                <input
                  type="text"
                  value={formData.iban || ''}
                  onChange={handleChange('iban')}
                />
              </div>
            </div>
          </section>

          <section className="profilo-card">
            <h3>Referente Aziendale</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              Persona di contatto principale dell'azienda (titolare, amministratore o responsabile)
            </p>
            <div className="profilo-grid">
              <div className="profilo-field">
                <label>Nome e Cognome</label>
                <input
                  type="text"
                  value={formData.referente_nome || ''}
                  onChange={handleChange('referente_nome')}
                />
              </div>
              <div className="profilo-field">
                <label>Email referente</label>
                <input
                  type="email"
                  value={formData.referente_email || ''}
                  onChange={handleChange('referente_email')}
                />
              </div>
              <div className="profilo-field">
                <label>Telefono referente</label>
                <input
                  type="text"
                  value={formData.referente_telefono || ''}
                  onChange={handleChange('referente_telefono')}
                />
              </div>
              <div className="profilo-field profilocard-span-2">
                <label>Fornitore veterinario</label>
                <SearchableSelect
                  options={veterinari}
                  value={formData.veterinario_id || ''}
                  onChange={handleVeterinarioChange}
                  placeholder={veterinariLoading ? 'Caricamento...' : 'Seleziona veterinario...'}
                  displayField="nome"
                  valueField="id"
                  disabled={veterinariLoading}
                />
              </div>
            </div>
          </section>

          {isEditing && azienda?.id && (
            <section className="profilo-card">
              <AssicurazioniAzienda aziendaId={azienda.id} />
            </section>
          )}

          <div className="profilo-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              disabled={saving}
            >
              Annulla modifiche
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvataggio...' : isEditing ? 'Aggiorna Profilo' : 'Crea Profilo'}
            </button>
          </div>
        </form>
      )}

      <section className="profilo-help">
        <h3>E adesso?</h3>
        <p>
          Dopo aver salvato il profilo, passa al modulo <strong>Allevamento</strong> per
          configurare sedi, stabilimenti e box. Tutti i moduli utilizzeranno i dati
          aziendali impostati qui.
        </p>
      </section>
    </div>
  );
};

export default Profilo;

