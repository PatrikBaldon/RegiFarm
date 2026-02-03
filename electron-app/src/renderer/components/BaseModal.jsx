import React from 'react';
import './BaseModal.css';

/**
 * BaseModal - Componente modale riutilizzabile per tutta l'app
 * 
 * Caratteristiche:
 * - Header fisso con titolo/identificativo a sinistra e azioni a destra
 * - Body scrollabile (solo la parte centrale)
 * - Footer fisso con pulsanti salva/annulla
 * - Stile essenziale senza icone
 * - Layout compatto
 * - Mantiene la struttura fissa anche durante le modifiche
 * 
 * Esempio di utilizzo:
 * 
 * import BaseModal from '../components/BaseModal';
 * import SmartSelect from '../components/SmartSelect';
 * 
 * <BaseModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Nuova Fattura"
 *   identifier={selectedFattura?.numero ? `Fattura ${selectedFattura.numero}` : null}
 *   headerActions={
 *     !isEditing && selectedFattura && (
 *       <>
 *         <button onClick={() => setIsEditing(true)}>Modifica</button>
 *         <button onClick={handleDelete}>Elimina</button>
 *       </>
 *     )
 *   }
 *   footerActions={
 *     isEditing ? (
 *       <>
 *         <button onClick={handleCancel}>Annulla</button>
 *         <button onClick={handleSave}>Salva</button>
 *       </>
 *     ) : (
 *       <button onClick={() => setShowModal(false)}>Chiudi</button>
 *     )
 *   }
 *   size="xlarge"
 * >
 *   <form>
 *     <div className="form-group">
 *       <label>Fornitore</label>
 *       <SmartSelect
 *         options={fornitori}
 *         value={formData.fornitore_id}
 *         onChange={(e) => setFormData({...formData, fornitore_id: e.target.value})}
 *         displayField="nome"
 *         valueField="id"
 *         placeholder="Seleziona fornitore..."
 *       />
 *     </div>
 *   </form>
 * </BaseModal>
 * 
 * Nota: Usa SmartSelect invece di SimpleSelect/SearchableSelect direttamente.
 * SmartSelect sceglie automaticamente:
 * - SimpleSelect se options.length <= 25
 * - SearchableSelect se options.length > 25
 */
const BaseModal = ({
  isOpen,
  onClose,
  title,
  identifier, // Nome o identificativo da mostrare a sinistra nell'header (non più usato)
  headerActions, // Elementi React da mostrare a destra nell'header (es: pulsanti modifica/elimina)
  tabs, // Tabs da mostrare nell'header (opzionale)
  headerLeft, // Contenuto personalizzato da mostrare a sinistra nell'header (opzionale)
  children, // Contenuto della modale (verrà scrollato)
  footerActions, // Pulsanti del footer (es: Salva, Annulla)
  size = 'large', // 'small', 'medium', 'large', 'xlarge'
  className = '',
}) => {
  if (!isOpen) return null;

  return (
    <div className="base-modal-overlay" onClick={onClose}>
      <div 
        className={`base-modal-content base-modal-${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fisso - rimane sempre visibile anche durante scroll/modifiche */}
        <div className="base-modal-header">
          <div className="base-modal-header-left">
            {headerLeft || tabs}
          </div>
          {headerActions && (
            <div className="base-modal-header-actions">
              {headerActions}
            </div>
          )}
        </div>

        {/* Body scrollabile - solo questa parte scrolla, header e footer rimangono fissi */}
        <div className="base-modal-body">
          {children}
        </div>

        {/* Footer fisso - rimane sempre visibile anche durante scroll/modifiche */}
        {footerActions && (
          <div className="base-modal-footer">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseModal;

