"""
Classificatore semplice per macrocategoria e categoria di fatture
basato su regole e frequenze storiche.
"""
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from collections import Counter
from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
from app.models.amministrazione.fornitore_tipo import FornitoreTipo


class ClassificatoreFatture:
    """
    Classificatore semplice basato su:
    1. Macrocategoria del fornitore (regola forte)
    2. Frequenze storiche per fornitore
    3. Frequenze storiche per macrocategoria
    4. Pattern comuni
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def predici(
        self,
        fornitore_id: Optional[int] = None,
        cliente_id: Optional[int] = None,
        importo_totale: Optional[float] = None,
        numero_fattura: Optional[str] = None,
        descrizione_linee: Optional[List[str]] = None,
        tipo: str = 'uscita',  # 'uscita' (ricevuta) o 'entrata' (emessa)
        attrezzatura_id: Optional[int] = None,
        terreno_id: Optional[int] = None
    ) -> Dict[str, any]:
        """
        Predice macrocategoria e categoria per una nuova fattura.
        
        Returns:
            {
                'macrocategoria': str,
                'categoria': str,
                'confidence': float,  # 0.0 - 1.0
                'reasoning': str
            }
        """
        scores_macro = {}
        scores_cat = {}
        reasoning = []
        
        # 0. REGOLA PRIORITARIA: Collegamenti diretti (attrezzatura/terreno)
        # Se c'è un'attrezzatura collegata, probabilmente è una spesa per attrezzatura
        if attrezzatura_id:
            scores_macro['attrezzatura'] = scores_macro.get('attrezzatura', 0) + 0.4  # Peso molto alto
            reasoning.append("Attrezzatura collegata alla fattura")
            
            # Se contiene "leasing" nelle descrizioni, usa categoria leasing_attrezzature
            if descrizione_linee:
                desc_text = ' '.join(descrizione_linee).lower()
                if 'leasing' in desc_text:
                    scores_cat['leasing_attrezzature'] = scores_cat.get('leasing_attrezzature', 0) + 0.5
                    reasoning.append("Leasing su attrezzatura rilevato")
        
        # Se c'è un terreno collegato, probabilmente è una spesa per terreno
        if terreno_id:
            scores_macro['terreno'] = scores_macro.get('terreno', 0) + 0.4  # Peso molto alto
            reasoning.append("Terreno collegato alla fattura")
        
        # 1. REGOLA FORTE: Macrocategoria del fornitore/cliente
        if fornitore_id:
            fornitore_tipo = (
                self.db.query(FornitoreTipo)
                .filter(FornitoreTipo.fornitore_id == fornitore_id)
                .order_by(FornitoreTipo.updated_at.desc().nullslast())
                .first()
            )
            if fornitore_tipo and fornitore_tipo.macrocategoria and fornitore_tipo.macrocategoria != 'nessuna':
                macro = fornitore_tipo.macrocategoria
                scores_macro[macro] = scores_macro.get(macro, 0) + 0.5  # Peso alto
                reasoning.append(f"Macrocategoria predefinita del fornitore: {macro}")
        
        # 2. FREQUENZE STORICHE: Categorie più usate per questo fornitore (fatture ricevute)
        if fornitore_id:
            fatture_fornitore = (
                self.db.query(
                    FatturaAmministrazione.macrocategoria,
                    FatturaAmministrazione.categoria,
                    func.count(FatturaAmministrazione.id).label('count')
                )
                .filter(
                    FatturaAmministrazione.fornitore_id == fornitore_id,
                    FatturaAmministrazione.tipo == 'uscita',  # Solo fatture ricevute
                    FatturaAmministrazione.macrocategoria.isnot(None),
                    FatturaAmministrazione.categoria.isnot(None),
                    FatturaAmministrazione.deleted_at.is_(None)
                )
                .group_by(
                    FatturaAmministrazione.macrocategoria,
                    FatturaAmministrazione.categoria
                )
                .order_by(func.count(FatturaAmministrazione.id).desc())
                .limit(10)
                .all()
            )
            
            if fatture_fornitore:
                total = sum(f.count for f in fatture_fornitore)
                for f in fatture_fornitore:
                    weight = f.count / total * 0.3  # Peso medio
                    if f.macrocategoria and f.macrocategoria != 'nessuna':
                        scores_macro[f.macrocategoria] = scores_macro.get(f.macrocategoria, 0) + weight
                    if f.categoria:
                        scores_cat[f.categoria] = scores_cat.get(f.categoria, 0) + weight
                reasoning.append(f"Basato su {total} fatture storiche del fornitore")
        
        # 3. FREQUENZE STORICHE: Categorie più usate per cliente (fatture emesse)
        # Nota: usa FatturaAmministrazione con tipo='entrata' (fatture emesse unificate)
        if cliente_id:
            fatture_cliente = (
                self.db.query(
                    FatturaAmministrazione.macrocategoria,
                    FatturaAmministrazione.categoria,
                    func.count(FatturaAmministrazione.id).label('count')
                )
                .filter(
                    FatturaAmministrazione.fornitore_id == cliente_id,  # In fatture emesse, il cliente è nel campo fornitore_id
                    FatturaAmministrazione.tipo == 'entrata',  # Solo fatture emesse
                    FatturaAmministrazione.macrocategoria.isnot(None),
                    FatturaAmministrazione.categoria.isnot(None),
                    FatturaAmministrazione.deleted_at.is_(None)
                )
                .group_by(
                    FatturaAmministrazione.macrocategoria,
                    FatturaAmministrazione.categoria
                )
                .order_by(func.count(FatturaAmministrazione.id).desc())
                .limit(10)
                .all()
            )
            
            if fatture_cliente:
                total = sum(f.count for f in fatture_cliente)
                for f in fatture_cliente:
                    weight = f.count / total * 0.3
                    if f.macrocategoria and f.macrocategoria != 'nessuna':
                        scores_macro[f.macrocategoria] = scores_macro.get(f.macrocategoria, 0) + weight
                    if f.categoria:
                        scores_cat[f.categoria] = scores_cat.get(f.categoria, 0) + weight
                reasoning.append(f"Basato su {total} fatture storiche del cliente")
        
        # 4. FREQUENZE GLOBALI: Categorie più usate per macrocategoria
        if scores_macro:
            # Prendi la macrocategoria con score più alto
            best_macro = max(scores_macro.items(), key=lambda x: x[1])[0]
            
            # Cerca categorie più frequenti per questa macrocategoria
            fatture_macro = (
                self.db.query(
                    FatturaAmministrazione.categoria,
                    func.count(FatturaAmministrazione.id).label('count')
                )
                .filter(
                    FatturaAmministrazione.macrocategoria == best_macro,
                    FatturaAmministrazione.categoria.isnot(None),
                    FatturaAmministrazione.deleted_at.is_(None)
                )
                .group_by(FatturaAmministrazione.categoria)
                .order_by(func.count(FatturaAmministrazione.categoria).desc())
                .limit(5)
                .all()
            )
            
            if fatture_macro:
                total = sum(f.count for f in fatture_macro)
                for f in fatture_macro:
                    weight = f.count / total * 0.2  # Peso basso (solo se non abbiamo dati specifici)
                    if not scores_cat:  # Solo se non abbiamo già categorie dal fornitore
                        scores_cat[f.categoria] = scores_cat.get(f.categoria, 0) + weight
        
        # 5. ANALISI TESTUALE SEMPLICE: Cerca pattern nelle descrizioni
        if descrizione_linee:
            desc_text = ' '.join(descrizione_linee).lower()
            
            # Logica speciale per leasing: distingue tra leasing attrezzature e finanziario
            if 'leasing' in desc_text:
                # Se c'è già attrezzatura_id o pattern di attrezzatura, è leasing attrezzature
                attrezzatura_patterns = ['attrezzatura', 'trattore', 'macchina', 'veicolo', 'mezzo', 'mietitrebbia', 'aratro', 'seminatrice']
                if attrezzatura_id or any(p in desc_text for p in attrezzatura_patterns):
                    scores_macro['attrezzatura'] = scores_macro.get('attrezzatura', 0) + 0.3
                    scores_cat['leasing_attrezzature'] = scores_cat.get('leasing_attrezzature', 0) + 0.4
                    reasoning.append("Leasing su attrezzatura rilevato dal testo")
                else:
                    # Leasing generico senza attrezzatura specifica = finanziario
                    scores_macro['finanziario'] = scores_macro.get('finanziario', 0) + 0.3
                    scores_cat['leasing_finanziario'] = scores_cat.get('leasing_finanziario', 0) + 0.4
                    reasoning.append("Leasing finanziario rilevato")
            
            # Logica speciale per lettiera (segatura, paglia per animali)
            lettiera_patterns = ['lettiera', 'segatura', 'paglia', 'strame', 'letto', 'giaciglio']
            if any(p in desc_text for p in lettiera_patterns):
                # Se contiene pattern di lettiera, è molto probabilmente materiale per lettiera animali
                scores_macro['sanitario'] = scores_macro.get('sanitario', 0) + 0.4
                scores_cat['lettiera'] = scores_cat.get('lettiera', 0) + 0.5
                reasoning.append("Lettiera animali rilevata (segatura/paglia)")
            
            # Pattern per macrocategorie
            pattern_macro = {
                'alimento': ['mangime', 'alimento', 'foraggio', 'fieno', 'grano', 'mais', 'soia'],
                'sanitario': ['farmaco', 'medicina', 'vaccino', 'antibiotico', 'vitamina', 'smaltimento', 'rifiuto', 'letame', 'deiezioni'],
                'utilities': ['energia', 'elettricità', 'luce', 'acqua', 'gas', 'bolletta'],
                'attrezzatura': ['attrezzatura', 'macchina', 'trattore', 'carburante', 'diesel', 'benzina'],
                'terreno': ['seme', 'concime', 'fertilizzante', 'lavorazione', 'aratura'],
                'personale': ['stipendio', 'stipendi', 'contributo', 'contributi', 'formazione', 'corso', 'consulente', 'lavoro', 'dipendente'],
                'servizi': ['commercialista', 'ragioniere', 'consulenza', 'trasporto', 'trasporti', 'noleggio', 'noleggi', 'servizio', 'pulizia', 'pulizie', 'manutenzione strutture', 'serbatoi', 'giardinaggio', 'avvocato', 'notaio'],
                'assicurazioni': ['assicurazione', 'polizza', 'rc', 'risarcimento', 'copertura', 'premio'],
                'finanziario': ['interesse', 'interessi', 'banca', 'mutuo', 'mutui', 'prestito', 'commissione', 'commissioni', 'spese bancarie', 'oneri finanziari', 'interessi passivi'],
                'amministrativo': ['tassa', 'tasse', 'imposta', 'imposte', 'cancelleria', 'telefonia', 'telefono', 'abbonamento', 'abbonamenti', 'ufficio', 'materiali ufficio', 'posta', 'bollo', 'bolli', 'versamento', 'versamenti', 'software', 'internet', 'visura', 'pratiche']
            }
            
            for macro, patterns in pattern_macro.items():
                matches = sum(1 for p in patterns if p in desc_text)
                if matches > 0:
                    weight = min(matches * 0.1, 0.3)  # Max 0.3
                    scores_macro[macro] = scores_macro.get(macro, 0) + weight
                    if matches > 0:
                        reasoning.append(f"Pattern testuale rilevato: {macro}")
        
        # 6. CALCOLA RISULTATI FINALI
        if scores_macro:
            best_macro = max(scores_macro.items(), key=lambda x: x[1])
            macro_value = best_macro[0] if best_macro[1] > 0.1 else None
            macro_confidence = min(best_macro[1], 1.0)
        else:
            macro_value = None
            macro_confidence = 0.0
        
        if scores_cat:
            best_cat = max(scores_cat.items(), key=lambda x: x[1])
            cat_value = best_cat[0] if best_cat[1] > 0.1 else None
            cat_confidence = min(best_cat[1], 1.0)
        else:
            cat_value = None
            cat_confidence = 0.0
        
        # Confidence complessiva (media pesata)
        overall_confidence = (macro_confidence * 0.6 + cat_confidence * 0.4) if (macro_value or cat_value) else 0.0
        
        # Se abbiamo macrocategoria ma non categoria, cerca categoria più comune per quella macro
        if macro_value and not cat_value:
            cat_comune = (
                self.db.query(
                    FatturaAmministrazione.categoria,
                    func.count(FatturaAmministrazione.id).label('count')
                )
                .filter(
                    FatturaAmministrazione.macrocategoria == macro_value,
                    FatturaAmministrazione.categoria.isnot(None),
                    FatturaAmministrazione.deleted_at.is_(None)
                )
                .group_by(FatturaAmministrazione.categoria)
                .order_by(func.count(FatturaAmministrazione.categoria).desc())
                .first()
            )
            if cat_comune:
                cat_value = cat_comune.categoria
                cat_confidence = 0.5  # Confidence media per categoria suggerita
                reasoning.append(f"Categoria più comune per macrocategoria {macro_value}")
        
        return {
            'macrocategoria': macro_value,
            'categoria': cat_value,
            'confidence': overall_confidence,
            'reasoning': '; '.join(reasoning) if reasoning else 'Nessun pattern rilevato',
            'scores': {
                'macrocategoria': scores_macro,
                'categoria': scores_cat
            }
        }
    
    def addi_feedback(
        self,
        fornitore_id: Optional[int],
        cliente_id: Optional[int],
        macrocategoria: str,
        categoria: str,
        corretta: bool = True
    ):
        """
        Aggiunge feedback per migliorare le predizioni future.
        In una versione più avanzata, questo potrebbe aggiornare i pesi.
        Per ora è solo un placeholder per future implementazioni.
        """
        # TODO: Implementare sistema di apprendimento incrementale
        pass

