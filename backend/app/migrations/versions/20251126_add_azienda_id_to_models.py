"""Add azienda_id to fornitori, componenti_alimentari, mangimi_confezionati, piani_alimentazione, ddt, magazzino_movimenti

Revision ID: add_azienda_id_models
Revises: 
Create Date: 2025-11-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'add_azienda_id_models'
down_revision = '4b97ebbb18d7'  # Collega alla merge migration esistente
branch_labels = None
depends_on = None


def column_exists(table_name, column_name, conn):
    """Check if a column exists in a table"""
    inspector = inspect(conn)
    try:
        if table_name not in inspector.get_table_names():
            return False
        columns = [col['name'] for col in inspector.get_columns(table_name)]
        return column_name in columns
    except:
        return False


def index_exists(table_name, index_name, conn):
    """Check if an index exists"""
    inspector = inspect(conn)
    try:
        if table_name not in inspector.get_table_names():
            return False
        indexes = inspector.get_indexes(table_name)
        return any(idx['name'] == index_name for idx in indexes)
    except:
        return False


def constraint_exists(table_name, constraint_name, conn):
    """Check if a foreign key constraint exists"""
    inspector = inspect(conn)
    try:
        fks = inspector.get_foreign_keys(table_name)
        return any(fk['name'] == constraint_name for fk in fks)
    except:
        return False


def table_exists(table_name, conn):
    """Check if a table exists"""
    inspector = inspect(conn)
    return table_name in inspector.get_table_names()


def upgrade():
    conn = op.get_bind()
    # Step 1: Aggiungi colonne come nullable (per poter aggiornare i dati esistenti)
    
    # Aggiungi azienda_id a fornitori
    if not column_exists('fornitori', 'azienda_id', conn):
        op.add_column('fornitori', sa.Column('azienda_id', sa.Integer(), nullable=True))
    if not index_exists('fornitori', 'ix_fornitori_azienda_id', conn):
        op.create_index('ix_fornitori_azienda_id', 'fornitori', ['azienda_id'], unique=False)
    
    # Aggiungi azienda_id a componenti_alimentari
    if not column_exists('componenti_alimentari', 'azienda_id', conn):
        op.add_column('componenti_alimentari', sa.Column('azienda_id', sa.Integer(), nullable=True))
    if not index_exists('componenti_alimentari', 'ix_componenti_alimentari_azienda_id', conn):
        op.create_index('ix_componenti_alimentari_azienda_id', 'componenti_alimentari', ['azienda_id'], unique=False)
    # Rimuovi vincolo unique su nome per permettere stessi nomi in aziende diverse
    try:
        op.drop_constraint('componenti_alimentari_nome_key', 'componenti_alimentari', type_='unique')
    except:
        pass  # Il vincolo potrebbe non esistere
    
    # Aggiungi azienda_id a mangimi_confezionati
    if not column_exists('mangimi_confezionati', 'azienda_id', conn):
        op.add_column('mangimi_confezionati', sa.Column('azienda_id', sa.Integer(), nullable=True))
    if not index_exists('mangimi_confezionati', 'ix_mangimi_confezionati_azienda_id', conn):
        op.create_index('ix_mangimi_confezionati_azienda_id', 'mangimi_confezionati', ['azienda_id'], unique=False)
    
    # Aggiungi azienda_id a piani_alimentazione
    if not column_exists('piani_alimentazione', 'azienda_id', conn):
        op.add_column('piani_alimentazione', sa.Column('azienda_id', sa.Integer(), nullable=True))
    if not index_exists('piani_alimentazione', 'ix_piani_alimentazione_azienda_id', conn):
        op.create_index('ix_piani_alimentazione_azienda_id', 'piani_alimentazione', ['azienda_id'], unique=False)
    
    # Aggiungi azienda_id a ddt
    if not column_exists('ddt', 'azienda_id', conn):
        op.add_column('ddt', sa.Column('azienda_id', sa.Integer(), nullable=True))
    if not index_exists('ddt', 'ix_ddt_azienda_id', conn):
        op.create_index('ix_ddt_azienda_id', 'ddt', ['azienda_id'], unique=False)
    
    # Aggiungi azienda_id a magazzino_movimenti
    if not column_exists('magazzino_movimenti', 'azienda_id', conn):
        op.add_column('magazzino_movimenti', sa.Column('azienda_id', sa.Integer(), nullable=True))
    if not index_exists('magazzino_movimenti', 'ix_magazzino_movimenti_azienda_id', conn):
        op.create_index('ix_magazzino_movimenti_azienda_id', 'magazzino_movimenti', ['azienda_id'], unique=False)
    
    # Step 2: Aggiorna i dati esistenti con la prima azienda disponibile
    try:
        op.execute("""
            DO $$
            DECLARE default_azienda_id INTEGER;
            BEGIN
                SELECT id INTO default_azienda_id FROM aziende WHERE deleted_at IS NULL ORDER BY id LIMIT 1;
                IF default_azienda_id IS NOT NULL THEN
                    -- Modelli alimentazione (solo se le colonne esistono)
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fornitori' AND column_name = 'azienda_id') THEN
                        UPDATE fornitori SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'componenti_alimentari' AND column_name = 'azienda_id') THEN
                        UPDATE componenti_alimentari SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mangimi_confezionati' AND column_name = 'azienda_id') THEN
                        UPDATE mangimi_confezionati SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'piani_alimentazione' AND column_name = 'azienda_id') THEN
                        UPDATE piani_alimentazione SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ddt' AND column_name = 'azienda_id') THEN
                        UPDATE ddt SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'magazzino_movimenti' AND column_name = 'azienda_id') THEN
                        UPDATE magazzino_movimenti SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registro_alimentazione' AND column_name = 'azienda_id') THEN
                        UPDATE registro_alimentazione SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    -- Modelli già esistenti che avevano nullable=True
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fatture_amministrazione' AND column_name = 'azienda_id') THEN
                        UPDATE fatture_amministrazione SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pn_categorie' AND column_name = 'azienda_id') THEN
                        UPDATE pn_categorie SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terreni' AND column_name = 'azienda_id') THEN
                        UPDATE terreni SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'farmaci' AND column_name = 'azienda_id') THEN
                        UPDATE farmaci SET azienda_id = default_azienda_id WHERE azienda_id IS NULL;
                    END IF;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Ignora errori, continua con la migration
                RAISE NOTICE 'Error updating azienda_id: %', SQLERRM;
            END $$;
        """)
    except Exception as e:
        # Se lo script SQL fallisce, continua comunque (i dati potrebbero già essere aggiornati)
        print(f"Warning: Could not update default azienda_id values: {e}")
        pass
    
    # Step 3: Rendi le colonne NOT NULL e aggiungi le foreign key (solo se le colonne esistono)
    if column_exists('fornitori', 'azienda_id', conn):
        try:
            op.alter_column('fornitori', 'azienda_id', nullable=False)
        except:
            pass  # Già NOT NULL
        if not constraint_exists('fornitori', 'fk_fornitori_azienda_id', conn):
            op.create_foreign_key('fk_fornitori_azienda_id', 'fornitori', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
    
    if column_exists('componenti_alimentari', 'azienda_id', conn):
        try:
            op.alter_column('componenti_alimentari', 'azienda_id', nullable=False)
        except:
            pass
        if not constraint_exists('componenti_alimentari', 'fk_componenti_alimentari_azienda_id', conn):
            op.create_foreign_key('fk_componenti_alimentari_azienda_id', 'componenti_alimentari', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
    
    if column_exists('mangimi_confezionati', 'azienda_id', conn):
        try:
            op.alter_column('mangimi_confezionati', 'azienda_id', nullable=False)
        except:
            pass
        if not constraint_exists('mangimi_confezionati', 'fk_mangimi_confezionati_azienda_id', conn):
            op.create_foreign_key('fk_mangimi_confezionati_azienda_id', 'mangimi_confezionati', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
    
    if column_exists('piani_alimentazione', 'azienda_id', conn):
        try:
            op.alter_column('piani_alimentazione', 'azienda_id', nullable=False)
        except:
            pass
        if not constraint_exists('piani_alimentazione', 'fk_piani_alimentazione_azienda_id', conn):
            op.create_foreign_key('fk_piani_alimentazione_azienda_id', 'piani_alimentazione', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
    
    if column_exists('ddt', 'azienda_id', conn):
        try:
            op.alter_column('ddt', 'azienda_id', nullable=False)
        except:
            pass
        if not constraint_exists('ddt', 'fk_ddt_azienda_id', conn):
            op.create_foreign_key('fk_ddt_azienda_id', 'ddt', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
    
    if column_exists('magazzino_movimenti', 'azienda_id', conn):
        try:
            op.alter_column('magazzino_movimenti', 'azienda_id', nullable=False)
        except:
            pass
        if not constraint_exists('magazzino_movimenti', 'fk_magazzino_movimenti_azienda_id', conn):
            op.create_foreign_key('fk_magazzino_movimenti_azienda_id', 'magazzino_movimenti', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
    
    # Step 4: Aggiorna modelli che avevano già azienda_id come nullable
    # registro_alimentazione
    if table_exists('registro_alimentazione', conn) and column_exists('registro_alimentazione', 'azienda_id', conn):
        try:
            op.alter_column('registro_alimentazione', 'azienda_id', nullable=False)
        except:
            pass  # Già NOT NULL
    
    # fatture_amministrazione - già ha FK, solo rendi NOT NULL
    if table_exists('fatture_amministrazione', conn) and column_exists('fatture_amministrazione', 'azienda_id', conn):
        try:
            op.alter_column('fatture_amministrazione', 'azienda_id', nullable=False)
        except:
            pass  # Già NOT NULL
    
    # pn_categorie - già ha FK, solo rendi NOT NULL
    if table_exists('pn_categorie', conn) and column_exists('pn_categorie', 'azienda_id', conn):
        try:
            op.alter_column('pn_categorie', 'azienda_id', nullable=False)
        except:
            pass  # Già NOT NULL
    
    # terreni - già ha FK, solo rendi NOT NULL
    if table_exists('terreni', conn) and column_exists('terreni', 'azienda_id', conn):
        try:
            op.alter_column('terreni', 'azienda_id', nullable=False)
        except:
            pass  # Già NOT NULL
    
    # farmaci - cambia FK da SET NULL a CASCADE e rendi NOT NULL
    if table_exists('farmaci', conn) and column_exists('farmaci', 'azienda_id', conn):
        try:
            op.drop_constraint('farmaci_azienda_id_fkey', 'farmaci', type_='foreignkey')
        except:
            pass  # Constraint potrebbe non esistere o avere nome diverso
        try:
            op.alter_column('farmaci', 'azienda_id', nullable=False)
        except:
            pass  # Già NOT NULL
        if not constraint_exists('farmaci', 'fk_farmaci_azienda_id', conn):
            try:
                op.create_foreign_key('fk_farmaci_azienda_id', 'farmaci', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
            except Exception as e:
                # Il constraint potrebbe già esistere con nome diverso o ci potrebbero essere problemi di dati
                print(f"Warning: Could not create fk_farmaci_azienda_id: {e}")
                pass


def downgrade():
    # Rimuovi da magazzino_movimenti
    op.drop_constraint('fk_magazzino_movimenti_azienda_id', 'magazzino_movimenti', type_='foreignkey')
    op.drop_index('ix_magazzino_movimenti_azienda_id', table_name='magazzino_movimenti')
    op.drop_column('magazzino_movimenti', 'azienda_id')
    
    # Rimuovi da ddt
    op.drop_constraint('fk_ddt_azienda_id', 'ddt', type_='foreignkey')
    op.drop_index('ix_ddt_azienda_id', table_name='ddt')
    op.drop_column('ddt', 'azienda_id')
    
    # Rimuovi da piani_alimentazione
    op.drop_constraint('fk_piani_alimentazione_azienda_id', 'piani_alimentazione', type_='foreignkey')
    op.drop_index('ix_piani_alimentazione_azienda_id', table_name='piani_alimentazione')
    op.drop_column('piani_alimentazione', 'azienda_id')
    
    # Rimuovi da mangimi_confezionati
    op.drop_constraint('fk_mangimi_confezionati_azienda_id', 'mangimi_confezionati', type_='foreignkey')
    op.drop_index('ix_mangimi_confezionati_azienda_id', table_name='mangimi_confezionati')
    op.drop_column('mangimi_confezionati', 'azienda_id')
    
    # Rimuovi da componenti_alimentari e ripristina unique
    op.drop_constraint('fk_componenti_alimentari_azienda_id', 'componenti_alimentari', type_='foreignkey')
    op.drop_index('ix_componenti_alimentari_azienda_id', table_name='componenti_alimentari')
    op.drop_column('componenti_alimentari', 'azienda_id')
    op.create_unique_constraint('componenti_alimentari_nome_key', 'componenti_alimentari', ['nome'])
    
    # Rimuovi da fornitori
    op.drop_constraint('fk_fornitori_azienda_id', 'fornitori', type_='foreignkey')
    op.drop_index('ix_fornitori_azienda_id', table_name='fornitori')
    op.drop_column('fornitori', 'azienda_id')

