"""convert_enum_to_string_amministrazione

Revision ID: 02f09f3d980b
Revises: d123456789ab
Create Date: 2025-10-31 00:40:04.002638

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '02f09f3d980b'
down_revision = 'd123456789ab'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    
    # Solo per PostgreSQL
    if connection.dialect.name == 'postgresql':
        # Converti colonna tipo in partite_animali da ENUM a VARCHAR
        op.execute("""
            ALTER TABLE partite_animali 
            ALTER COLUMN tipo TYPE VARCHAR(20) 
            USING tipo::text
        """)
        
        # Converti colonna tipo in fatture_amministrazione da ENUM a VARCHAR
        op.execute("""
            ALTER TABLE fatture_amministrazione 
            ALTER COLUMN tipo TYPE VARCHAR(20) 
            USING tipo::text
        """)
        
        # Converti colonna stato_pagamento in fatture_amministrazione da ENUM a VARCHAR
        op.execute("""
            ALTER TABLE fatture_amministrazione 
            ALTER COLUMN stato_pagamento TYPE VARCHAR(20) 
            USING stato_pagamento::text
        """)
    # Per altri database (SQLite, etc.) non serve fare nulla, sono già String


def downgrade() -> None:
    connection = op.get_bind()
    
    if connection.dialect.name == 'postgresql':
        # Crea gli enum se non esistono
        tipo_partita_enum = postgresql.ENUM('ingresso', 'uscita', name='tipopartita', create_type=False)
        tipo_partita_enum.create(connection, checkfirst=True)
        
        tipo_fattura_enum = postgresql.ENUM('entrata', 'uscita', name='tipofattura', create_type=False)
        tipo_fattura_enum.create(connection, checkfirst=True)
        
        stato_pagamento_enum = postgresql.ENUM('da_pagare', 'pagata', 'scaduta', 'parziale', name='statopagamento', create_type=False)
        stato_pagamento_enum.create(connection, checkfirst=True)
        
        # Reconverte le colonne a ENUM
        op.execute("""
            ALTER TABLE partite_animali 
            ALTER COLUMN tipo TYPE tipopartita 
            USING tipo::tipopartita
        """)
        
        op.execute("""
            ALTER TABLE fatture_amministrazione 
            ALTER COLUMN tipo TYPE tipofattura 
            USING tipo::tipofattura
        """)
        
        op.execute("""
            ALTER TABLE fatture_amministrazione 
            ALTER COLUMN stato_pagamento TYPE statopagamento 
            USING stato_pagamento::statopagamento
        """)

