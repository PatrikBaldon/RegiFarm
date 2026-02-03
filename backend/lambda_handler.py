"""
Lambda Handler per RegiFarm Pro API
Adatta FastAPI per funzionare su AWS Lambda usando Mangum
"""
import os
import sys
import json
import logging

# Configura logging per vedere cosa arriva
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Aggiungi il path corrente a sys.path per assicurare che i moduli siano trovati
# Questo è importante per Lambda che potrebbe non avere il path corretto
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Importa dopo aver aggiunto il path
from mangum import Mangum
from app.main import app

# Wrapper Mangum per FastAPI (versione 0.17.0 non supporta strip_base_path)
handler_mangum = Mangum(app, lifespan="off")

# Wrapper per aggiungere logging e rimuovere il prefisso del path
def handler(event, context):
    """Handler con logging e fix del path"""
    # Log dell'evento per vedere cosa arriva
    logger.info(f"Event received: {json.dumps(event, default=str)}")
    
    # Estrai path originale
    original_path = event.get('rawPath') or event.get('path') or event.get('requestContext', {}).get('http', {}).get('path', '')
    logger.info(f"Original path: {original_path}")
    
    # Rimuovi il prefisso /default/regifarm-api dal path se presente
    base_path = "/default/regifarm-api"
    if original_path.startswith(base_path):
        new_path = original_path[len(base_path):] or "/"
        # Aggiorna l'evento con il nuovo path
        if 'rawPath' in event:
            event['rawPath'] = new_path
        if 'path' in event:
            event['path'] = new_path
        if 'requestContext' in event and 'http' in event['requestContext']:
            event['requestContext']['http']['path'] = new_path
        logger.info(f"Modified path: {new_path}")
    
    # Chiama Mangum
    try:
        response = handler_mangum(event, context)
        logger.info(f"Response status: {response.get('statusCode', 'N/A')}")
        return response
    except Exception as e:
        logger.error(f"Error in handler: {str(e)}", exc_info=True)
        raise

# Se vuoi gestire il lifespan manualmente:
# handler = Mangum(app, lifespan="auto")

