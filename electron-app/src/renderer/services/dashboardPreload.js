/**
 * Precarica i dati della dashboard Home durante la fase di loading post-login,
 * così che alla prima visualizzazione della Home i dati siano già in cache e visibili.
 */
import { setCache } from './prefetchCache';
import { statisticheService } from './statisticheService';
import { aziendeService } from '../modules/allevamento/services/aziendeService';
import { allevamentoService } from '../modules/allevamento/services/allevamentoService';
import { amministrazioneService } from '../modules/amministrazione/services/amministrazioneService';
import { alimentazioneService } from '../modules/alimentazione/services/alimentazioneService';
import { sanitarioService } from '../modules/sanitario/services/sanitarioService';
import { getCachedFornitori } from '../modules/amministrazione/prefetchers';
import {
  getCachedAlimentazioneCatalogo,
  getCachedAlimentazionePiani,
} from '../modules/alimentazione/prefetchers';
import { getCachedSanitarioFarmaci } from '../modules/sanitario/prefetchers';

const DASHBOARD_CACHE_KEY = 'dashboard/home@v1';
const DASHBOARD_CACHE_TTL = 1000 * 60 * 5; // 5 minuti

/**
 * Precarica i dati della dashboard e li salva in cache.
 * Chiamato durante il loading con la rotella dopo il login.
 * @param {number} aziendaId - ID azienda (es. profile.azienda.id)
 * @returns {Promise<boolean>} true se il preload è andato a buon fine
 */
export async function preloadDashboardData(aziendaId) {
  if (!aziendaId) return false;

  try {
    const aziendeList = await aziendeService.getAziende().catch(() => []);
    const statsData = { aziende: aziendeList?.length || 0 };

    if (!aziendeList?.length) {
      setCache(
        DASHBOARD_CACHE_KEY,
        { stats: statsData, aziende: [], sediMap: {} },
        { ttl: DASHBOARD_CACHE_TTL }
      );
      return true;
    }

    const cachedCatalogo = getCachedAlimentazioneCatalogo();
    const cachedPiani = getCachedAlimentazionePiani();
    const cachedFornitori = getCachedFornitori();
    const cachedFarmaci = getCachedSanitarioFarmaci();

    const [
      batchStatsResult,
      amministrazioneBatchResult,
      sediResults,
      fornitoriResult,
      farmaciResult,
      pianiResult,
      componentiResult,
      mangimiResult,
      terreniColtivatiResult,
    ] = await Promise.allSettled([
      statisticheService.getHomeStatsBatch(aziendaId).catch(() => ({})),
      statisticheService.getAmministrazioneBatch(aziendaId).catch(() => ({})),
      allevamentoService.getSediCount().catch(() => ({ count: 0 })),
      cachedFornitori
        ? Promise.resolve(cachedFornitori.fornitori || cachedFornitori || [])
        : amministrazioneService.getFornitori({ include_tipi: false }).catch(() => []),
      cachedFarmaci
        ? Promise.resolve(cachedFarmaci)
        : sanitarioService.getFarmaci().catch(() => []),
      cachedPiani
        ? Promise.resolve(cachedPiani.piani || [])
        : alimentazioneService.getPiani().catch(() => []),
      cachedCatalogo
        ? Promise.resolve(cachedCatalogo.componenti || [])
        : alimentazioneService.getComponenti().catch(() => []),
      cachedCatalogo
        ? Promise.resolve(cachedCatalogo.mangimi || [])
        : alimentazioneService.getMangimi().catch(() => []),
      statisticheService.getTerreniColtivati().catch(() => ({ numero_terreni_coltivati: 0, superficie_ettari: 0 })),
    ]);

    if (batchStatsResult.status === 'fulfilled') {
      const batch = batchStatsResult.value;
      statsData.animali_stato = batch.animali_stato || {};
      statsData.animali_presenti = batch.animali_presenti || 0;
      statsData.somministrazioni_mese = batch.somministrazioni_totali || 0;
      statsData.terreni = batch.terreni?.numero || 0;
      statsData.superficie_ettari = batch.terreni?.superficie_ha || 0;
      statsData.attrezzature = batch.attrezzature || 0;
      statsData.revisioni_in_scadenza = batch.revisioni?.in_scadenza || 0;
      statsData.revisioni_scadute = batch.revisioni?.scadute || 0;
      statsData.fatture_scadute = batch.fatture_scadute || 0;
    }

    if (amministrazioneBatchResult.status === 'fulfilled') {
      const ammBatch = amministrazioneBatchResult.value;
      const fatturePerTipo = ammBatch.fatture_per_tipo || {};
      statsData.fatture_emesse = fatturePerTipo.entrata || fatturePerTipo.ENTRATA || fatturePerTipo['entrata'] || 0;
      statsData.fatture_ricevute = fatturePerTipo.uscita || fatturePerTipo.USCITA || fatturePerTipo['uscita'] || 0;
    }

    if (sediResults.status === 'fulfilled') {
      statsData.sedi = sediResults.value?.count || 0;
    }

    if (fornitoriResult.status === 'fulfilled') {
      statsData.fornitori = fornitoriResult.value?.length || 0;
    }

    if (farmaciResult.status === 'fulfilled') {
      statsData.farmaci = farmaciResult.value?.length || 0;
    }

    statsData.piani_alimentazione = pianiResult.status === 'fulfilled' ? (pianiResult.value?.length || 0) : 0;
    statsData.componenti_alimentari = componentiResult.status === 'fulfilled' ? (componentiResult.value?.length || 0) : 0;
    statsData.mangimi_confezionati = mangimiResult.status === 'fulfilled' ? (mangimiResult.value?.length || 0) : 0;

    if (terreniColtivatiResult.status === 'fulfilled') {
      const terreniColtivati = terreniColtivatiResult.value;
      statsData.terreni_coltivati = terreniColtivati?.numero_terreni_coltivati || 0;
      if (terreniColtivati?.superficie_ettari !== undefined && terreniColtivati.superficie_ettari > 0) {
        statsData.superficie_ettari = terreniColtivati.superficie_ettari;
      }
    }

    setCache(
      DASHBOARD_CACHE_KEY,
      {
        stats: statsData,
        aziende: aziendeList,
        sediMap: {},
      },
      { ttl: DASHBOARD_CACHE_TTL }
    );
    return true;
  } catch (err) {
    console.warn('[dashboardPreload] Errore preload dashboard:', err);
    return false;
  }
}
