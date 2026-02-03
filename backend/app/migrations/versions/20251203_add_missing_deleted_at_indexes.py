"""Add missing indexes on deleted_at and composite indexes for common query patterns

Revision ID: add_missing_deleted_indexes
Revises: opt_idx_sedi
Create Date: 2025-12-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_missing_deleted_idx'
down_revision = 'opt_idx_sedi'  # Dopo optimize_sedi_indexes
branch_labels = None
depends_on = None


def upgrade():
    # ============ INDICI SU deleted_at PER TABELLE PRINCIPALI ============
    # Questi indici sono critici per le performance delle query che filtrano per deleted_at IS NULL
    # Usiamo IF NOT EXISTS per evitare errori se gli indici esistono già
    
    from sqlalchemy import text
    
    conn = op.get_bind()
    
    # Allevamento
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stabilimenti_deleted_at ON stabilimenti (deleted_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_box_deleted_at ON box (deleted_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_animali_deleted_at ON animali (deleted_at)"))
    
    # Alimentazione
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_componenti_alimentari_deleted_at ON componenti_alimentari (deleted_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_mangimi_confezionati_deleted_at ON mangimi_confezionati (deleted_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_registro_alimentazione_deleted_at ON registro_alimentazione (deleted_at)"))
    
    # Sanitario
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_somministrazioni_deleted_at ON somministrazioni (deleted_at)"))
    
    # Terreni
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_lavorazioni_terreno_deleted_at ON lavorazioni_terreno (deleted_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_raccolti_terreno_deleted_at ON raccolti_terreno (deleted_at)"))
    
    # ============ INDICI COMPOSITI PER QUERY COMUNI ============
    # Questi indici ottimizzano le query più frequenti che filtrano per azienda_id + deleted_at
    
    # Stabilimenti: query per sede + deleted
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stabilimenti_sede_deleted ON stabilimenti (sede_id, deleted_at)"))
    
    # Box: query per stabilimento + deleted
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_box_stabilimento_deleted ON box (stabilimento_id, deleted_at)"))
    
    # Animali: query per azienda + deleted (molto comune)
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_animali_azienda_deleted ON animali (azienda_id, deleted_at)"))
    
    # Animali: query per stato + deleted (usato spesso)
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_animali_stato_deleted ON animali (stato, deleted_at)"))
    
    # Componenti alimentari: query per azienda + deleted
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_componenti_alimentari_azienda_deleted ON componenti_alimentari (azienda_id, deleted_at)"))
    
    # Mangimi confezionati: query per azienda + deleted
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_mangimi_confezionati_azienda_deleted ON mangimi_confezionati (azienda_id, deleted_at)"))
    
    # Piani alimentazione: query per azienda + deleted
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_piani_alimentazione_azienda_deleted ON piani_alimentazione (azienda_id, deleted_at)"))
    
    # Somministrazioni: query per azienda + deleted
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_somministrazioni_azienda_deleted ON somministrazioni (azienda_id, deleted_at)"))
    
    # Terreni: query per azienda + deleted
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_terreni_azienda_deleted ON terreni (azienda_id, deleted_at)"))


def downgrade():
    # Rimuovi indici compositi
    try:
        op.drop_index('ix_terreni_azienda_deleted', table_name='terreni')
    except Exception:
        pass
    try:
        op.drop_index('ix_somministrazioni_azienda_deleted', table_name='somministrazioni')
    except Exception:
        pass
    try:
        op.drop_index('ix_piani_alimentazione_azienda_deleted', table_name='piani_alimentazione')
    except Exception:
        pass
    try:
        op.drop_index('ix_mangimi_confezionati_azienda_deleted', table_name='mangimi_confezionati')
    except Exception:
        pass
    try:
        op.drop_index('ix_componenti_alimentari_azienda_deleted', table_name='componenti_alimentari')
    except Exception:
        pass
    try:
        op.drop_index('ix_animali_stato_deleted', table_name='animali')
    except Exception:
        pass
    try:
        op.drop_index('ix_animali_azienda_deleted', table_name='animali')
    except Exception:
        pass
    try:
        op.drop_index('ix_box_stabilimento_deleted', table_name='box')
    except Exception:
        pass
    try:
        op.drop_index('ix_stabilimenti_sede_deleted', table_name='stabilimenti')
    except Exception:
        pass
    
    # Rimuovi indici su deleted_at
    try:
        op.drop_index('ix_raccolti_terreno_deleted_at', table_name='raccolti_terreno')
    except Exception:
        pass
    try:
        op.drop_index('ix_lavorazioni_terreno_deleted_at', table_name='lavorazioni_terreno')
    except Exception:
        pass
    try:
        op.drop_index('ix_somministrazioni_deleted_at', table_name='somministrazioni')
    except Exception:
        pass
    try:
        op.drop_index('ix_registro_alimentazione_deleted_at', table_name='registro_alimentazione')
    except Exception:
        pass
    try:
        op.drop_index('ix_mangimi_confezionati_deleted_at', table_name='mangimi_confezionati')
    except Exception:
        pass
    try:
        op.drop_index('ix_componenti_alimentari_deleted_at', table_name='componenti_alimentari')
    except Exception:
        pass
    try:
        op.drop_index('ix_animali_deleted_at', table_name='animali')
    except Exception:
        pass
    try:
        op.drop_index('ix_box_deleted_at', table_name='box')
    except Exception:
        pass
    try:
        op.drop_index('ix_stabilimenti_deleted_at', table_name='stabilimenti')
    except Exception:
        pass

