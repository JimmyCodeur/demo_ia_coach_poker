# main.py
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import uvicorn
import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

from .storage import storage
from .models import Tournament, TournamentSummary
from .services.winamax_parser import WinamaxParser

app = FastAPI(
    title="Poker Tournament Replay API",
    description="API pour parser et rejouer les tournois de poker Winamax",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parser_service = WinamaxParser()
DEFAULT_USER_ID = "default_user"

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {"message": "Poker Tournament Replay API is running!", "status": "ok"}

@app.post("/api/tournaments/upload")
async def upload_tournament(file: UploadFile = File(...)):
    """Upload et parse un fichier de tournoi Winamax"""
    logger.info(f"Upload request received - filename: {file.filename}")
    
    if not file.filename or not file.filename.endswith('.txt'):
        logger.error(f"Invalid file type: {file.filename}")
        raise HTTPException(status_code=400, detail="Seuls les fichiers .txt sont acceptés")
    
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        logger.info(f"File read successfully - size: {len(content_str)} characters")
        
        # Parser les informations du tournoi
        tournament_data = parser_service.parse_tournament_file(content_str)
        logger.info(f"Tournament data parsed: {tournament_data}")
        
        # ✅ VÉRIFICATION: Contrôler si le tournoi existe déjà
        existing_tournament = storage.get_existing_tournament(
            name=tournament_data['name'],
            date=tournament_data['date'],
            user_id=DEFAULT_USER_ID
        )
        
        if existing_tournament:
            logger.warning(f"Tournament already exists: {tournament_data['name']} on {tournament_data['date']}")
            
            # Compter les mains existantes
            existing_hands = storage.get_hands_by_tournament(existing_tournament.id)
            
            return {
                "tournament_id": existing_tournament.id,
                "name": existing_tournament.name,
                "total_hands": len(existing_hands),
                "tournament_type": existing_tournament.tournament_type,
                "message": "Ce tournoi est déjà présent dans votre collection",
                "status": "exists",
                "existing": True
            }
        
        # Si le tournoi n'existe pas, le créer
        tournament = storage.create_tournament(
            user_id=DEFAULT_USER_ID,
            name=tournament_data['name'],
            date=tournament_data['date'],
            buy_in=tournament_data['buy_in'],
            fee=tournament_data['fee'],
            total_players=tournament_data.get('total_players', 0),
            final_position=tournament_data.get('final_position', 0),
            profit_loss=tournament_data['profit_loss'],
            tournament_type=tournament_data.get('tournament_type', 'Unknown')
        )
        logger.info(f"Tournament created with ID: {tournament.id}")
        
        # Parser et sauvegarder toutes les mains
        hands_data = parser_service.extract_hands(content_str)
        logger.info(f"Extracted {len(hands_data)} hands")
        
        for i, hand_data in enumerate(hands_data):
            try:
                storage.create_hand(tournament.id, hand_data)
            except Exception as e:
                logger.error(f"Error creating hand {i}: {e}")
        
        result = {
            "tournament_id": tournament.id,
            "name": tournament.name,
            "total_hands": len(hands_data),
            "tournament_type": tournament_data.get('tournament_type', 'Unknown'),
            "message": "Tournoi uploadé et parsé avec succès",
            "status": "created",
            "existing": False
        }
        logger.info(f"Upload successful: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error during upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du parsing: {str(e)}")

@app.post("/api/tournaments/{tournament_id}/update-summary")
async def update_tournament_summary(tournament_id: str, file: UploadFile = File(...)):
    """Met à jour un tournoi avec les données du fichier summary"""
    logger.info(f"Update summary called for tournament: {tournament_id}, file: {file.filename}")
    
    if not file.filename or not file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Seuls les fichiers .txt sont acceptés")
    
    try:
        # Vérifier que le tournoi existe
        tournament = storage.get_tournament_by_id(tournament_id)
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournoi non trouvé")
        
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Parser le fichier summary
        summary_data = parser_service.parse_summary_file(content_str)
        logger.info(f"Summary data parsed: {summary_data}")
        
        # Mettre à jour le tournoi avec les nouvelles données
        if summary_data:
            updated_tournament = storage.update_tournament(
                tournament_id=tournament_id,
                final_position=summary_data.get('final_position', tournament.final_position),
                total_players=summary_data.get('total_players', tournament.total_players),
                profit_loss=summary_data.get('profit_loss', tournament.profit_loss),
                buy_in=summary_data.get('buy_in', tournament.buy_in),
                fee=0,
                late_registration_count=summary_data.get('late_registration_count', 0),
                re_entries_count=summary_data.get('re_entries_count', 0),
                total_entries=summary_data.get('entries_count', 1),
                total_cost=summary_data.get('total_cost', tournament.buy_in),
                total_winnings=summary_data.get('combined_winnings', 0.0)  # ✅ Nouveau
            )
            
            logger.info(f"Tournament {tournament_id} updated successfully")
        
        return {
            "message": "Statistiques du tournoi mises à jour avec succès",
            "summary_data": summary_data
        }
        
    except Exception as e:
        logger.error(f"Error updating tournament summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")

@app.get("/api/tournaments")
async def get_tournaments():
    logger.info("Get tournaments called")
    try:
        tournaments = storage.get_tournaments_by_user(DEFAULT_USER_ID)
        logger.info(f"Found {len(tournaments)} tournaments")
        
        tournament_summaries = []
        for tournament in tournaments:
            try:
                hands = storage.get_hands_by_tournament(tournament.id)
                
                hero_name = "Unknown"
                if hands and len(hands) > 0:
                    hero_name = hands[0].hero_name or "Unknown"
                
                tournament_summary = {
                    "id": tournament.id,
                    "name": tournament.name,
                    "date": tournament.date.isoformat(),
                    "buy_in": tournament.buy_in,
                    "fee": tournament.fee,
                    "total_hands": len(hands),
                    "hero_name": hero_name,
                    "final_position": tournament.final_position,
                    "profit_loss": tournament.profit_loss,
                    "tournament_type": tournament.tournament_type,
                    "late_registration_count": tournament.late_registration_count,
                    "re_entries_count": tournament.re_entries_count,
                    "total_entries": tournament.total_entries,
                    "total_cost": tournament.total_cost,
                    "total_winnings": tournament.total_winnings  # ✅ Nouveau
                }
                
                tournament_summaries.append(tournament_summary)
                
            except Exception as e:
                logger.error(f"Error processing tournament {tournament.id}: {e}")
                continue
        
        return tournament_summaries
        
    except Exception as e:
        logger.error(f"Error in get_tournaments: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du chargement des tournois: {str(e)}")

@app.get("/api/tournaments/{tournament_id}")
async def get_tournament(tournament_id: str):
    logger.info(f"Get tournament called for ID: {tournament_id}")
    try:
        tournament = storage.get_tournament_by_id(tournament_id)
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournoi non trouvé")
        
        hands = storage.get_hands_by_tournament(tournament_id)
        
        hero_name = "Unknown"
        if hands and len(hands) > 0:
            hero_name = hands[0].hero_name or "Unknown"
        
        return {
            "tournament": tournament.to_dict(),
            "total_hands": len(hands),
            "hero_name": hero_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_tournament: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du chargement du tournoi: {str(e)}")

@app.get("/api/tournaments/{tournament_id}/hands")
async def get_tournament_hands(tournament_id: str, page: int = 1, limit: int = 20):
    logger.info(f"Get tournament hands called for ID: {tournament_id}, page: {page}, limit: {limit}")
    try:
        tournament = storage.get_tournament_by_id(tournament_id)
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournoi non trouvé")
        
        hands = storage.get_hands_by_tournament(tournament_id)
        
        start = (page - 1) * limit
        end = start + limit
        paginated_hands = hands[start:end]
        
        return {
            "hands": [hand.to_dict() for hand in paginated_hands],
            "total": len(hands),
            "page": page,
            "limit": limit,
            "total_pages": (len(hands) + limit - 1) // limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_tournament_hands: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du chargement des mains: {str(e)}")

@app.delete("/api/tournaments/{tournament_id}")
async def delete_tournament(tournament_id: str):
    """Supprime un tournoi et toutes ses mains associées"""
    logger.info(f"Delete tournament called for ID: {tournament_id}")
    
    try:
        # Vérifier que le tournoi existe
        tournament = storage.get_tournament_by_id(tournament_id)
        if not tournament:
            logger.warning(f"Tournament not found for deletion: {tournament_id}")
            raise HTTPException(status_code=404, detail="Tournoi non trouvé")
        
        # Optionnel: vérifier que le tournoi appartient à l'utilisateur
        if tournament.user_id != DEFAULT_USER_ID:
            logger.warning(f"Unauthorized delete attempt for tournament: {tournament_id}")
            raise HTTPException(status_code=403, detail="Non autorisé à supprimer ce tournoi")
        
        # Supprimer toutes les mains associées d'abord
        hands = storage.get_hands_by_tournament(tournament_id)
        hands_count = len(hands)
        
        logger.info(f"Deleting {hands_count} hands for tournament {tournament_id}")
        
        # Supprimer les mains une par une (si votre storage a une méthode delete_hand)
        # ou en batch (si votre storage a une méthode delete_hands_by_tournament)
        try:
            # Essayer d'abord avec une méthode batch si elle existe
            if hasattr(storage, 'delete_hands_by_tournament'):
                storage.delete_hands_by_tournament(tournament_id)
            elif hasattr(storage, 'delete_hand'):
                # Sinon supprimer une par une
                for hand in hands:
                    storage.delete_hand(hand.id)
            else:
                logger.warning("No delete method found for hands, attempting direct deletion")
                
        except Exception as e:
            logger.error(f"Error deleting hands for tournament {tournament_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression des mains: {str(e)}")
        
        # Supprimer le tournoi
        try:
            if hasattr(storage, 'delete_tournament'):
                storage.delete_tournament(tournament_id)
            else:
                logger.error("No delete_tournament method found in storage")
                raise HTTPException(status_code=500, detail="Méthode de suppression non implémentée")
                
        except Exception as e:
            logger.error(f"Error deleting tournament {tournament_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression du tournoi: {str(e)}")
        
        logger.info(f"Tournament {tournament_id} and {hands_count} hands deleted successfully")
        
        return {
            "message": f"Tournoi '{tournament.name}' supprimé avec succès",
            "success": True,
            "deleted_tournament_id": tournament_id,
            "deleted_hands_count": hands_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in delete_tournament: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur inattendue lors de la suppression: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)