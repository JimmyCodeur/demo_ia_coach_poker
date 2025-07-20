# storage.py
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from .models import User, Tournament, Hand, Player, TournamentSummary, ActionDetails, HandAnalysis, PlayerStats
import uuid
import logging

logger = logging.getLogger(__name__)

class FileStorage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        
        # Fichiers de stockage
        self.users_file = os.path.join(data_dir, "users.json")
        self.tournaments_file = os.path.join(data_dir, "tournaments.json")
        self.hands_file = os.path.join(data_dir, "hands.json")
        self.analyses_file = os.path.join(data_dir, "analyses.json")
        self.stats_file = os.path.join(data_dir, "player_stats.json")
        
        # Initialiser les fichiers s'ils n'existent pas
        for file_path in [self.users_file, self.tournaments_file, self.hands_file, 
                         self.analyses_file, self.stats_file]:
            if not os.path.exists(file_path):
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump([], f)
    
    def _load_json(self, file_path: str) -> List[Dict]:
        """Charge un fichier JSON"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if not content.strip():
                    return []
                return json.loads(content)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.warning(f"Error loading {file_path}: {e}")
            return []
    
    def _save_json(self, file_path: str, data: List[Dict]):
        """Sauvegarde un fichier JSON"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving {file_path}: {e}")
            raise
    
    # ===== GESTION DES UTILISATEURS =====
    def create_user(self, email: str, hashed_password: str) -> User:
        """Crée un nouvel utilisateur"""
        users = self._load_json(self.users_file)
        
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            hashed_password=hashed_password,
            created_at=datetime.now(),
            is_active=True
        )
        
        users.append(user.to_dict())
        self._save_json(self.users_file, users)
        return user
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Récupère un utilisateur par email"""
        users = self._load_json(self.users_file)
        
        for user_data in users:
            if user_data.get('email') == email:
                user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
                return User(**user_data)
        
        return None
    
    # ===== GESTION DES TOURNOIS =====
    def create_tournament(self, user_id: str, name: str, date: datetime, 
                        buy_in: float, fee: float, total_players: int, 
                        final_position: int, profit_loss: float, 
                        tournament_type: str = "Unknown", 
                        late_registration_count: int = 0,
                        re_entries_count: int = 0,
                        total_entries: int = 1,
                        total_cost: float = 0.0,
                        total_winnings: float = 0.0) -> Tournament:
        """Crée un nouveau tournoi"""
        tournaments = self._load_json(self.tournaments_file)
        
        # Si total_cost n'est pas fourni, calculer selon la logique : buy_in × total_entries
        if total_cost == 0.0:
            total_cost = buy_in * total_entries
        
        tournament = Tournament(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            date=date,
            buy_in=buy_in,
            fee=fee,
            total_players=total_players,
            final_position=final_position,
            profit_loss=profit_loss,
            tournament_type=tournament_type,
            late_registration_count=late_registration_count,
            re_entries_count=re_entries_count,
            total_entries=total_entries,
            total_cost=total_cost,
            total_winnings=total_winnings,
            created_at=datetime.now()
        )
        
        tournaments.append(tournament.to_dict())
        self._save_json(self.tournaments_file, tournaments)
        
        logger.info(f"Tournament created: {tournament.name} (ID: {tournament.id})")
        return tournament
    
    def tournament_exists(self, name: str, date: datetime, user_id: str) -> bool:
        """Vérifie si un tournoi avec le même nom et la même date existe déjà"""
        try:
            tournaments = self._load_json(self.tournaments_file)
            
            for t_data in tournaments:
                if (t_data.get('user_id') == user_id and 
                    t_data.get('name') == name and 
                    t_data.get('date') == date.isoformat()):
                    logger.info(f"Tournament already exists: {name} on {date}")
                    return True
            
            return False
        except Exception as e:
            logger.error(f"Error checking tournament existence: {e}")
            return False
    
    def get_existing_tournament(self, name: str, date: datetime, user_id: str) -> Optional[Tournament]:
        """Récupère un tournoi existant avec le même nom et la même date"""
        try:
            tournaments = self._load_json(self.tournaments_file)
            
            for t_data in tournaments:
                if (t_data.get('user_id') == user_id and 
                    t_data.get('name') == name and 
                    t_data.get('date') == date.isoformat()):
                    
                    # Ajouter les champs manquants avec des valeurs par défaut
                    self._ensure_tournament_fields(t_data)
                    
                    # Convertir les dates
                    t_data['date'] = datetime.fromisoformat(t_data['date'])
                    t_data['created_at'] = datetime.fromisoformat(t_data['created_at'])
                    
                    return Tournament(**t_data)
            
            return None
        except Exception as e:
            logger.error(f"Error getting existing tournament: {e}")
            return None
    
    def _ensure_tournament_fields(self, t_data: Dict[str, Any]) -> None:
        """Assure que tous les champs requis sont présents dans les données du tournoi"""
        defaults = {
            'fee': 0.0,
            'buy_in': 0.0,
            'tournament_type': "Unknown",
            'late_registration_count': 0,
            're_entries_count': 0,
            'total_entries': 1,
            'total_cost': 0.0,
            'total_winnings': 0.0
        }
        
        for key, default_value in defaults.items():
            if key not in t_data:
                t_data[key] = default_value
        
        # Calculer total_cost si pas défini
        if t_data.get('total_cost', 0.0) == 0.0:
            buy_in = t_data.get('buy_in', 0.0)
            total_entries = t_data.get('total_entries', 1)
            t_data['total_cost'] = buy_in * total_entries
    
    def get_tournaments_by_user(self, user_id: str) -> List[Tournament]:
        """Récupère tous les tournois d'un utilisateur"""
        tournaments = self._load_json(self.tournaments_file)
        user_tournaments = []
        
        for t_data in tournaments:
            if t_data.get('user_id') == user_id:
                try:
                    self._ensure_tournament_fields(t_data)
                    
                    # Convertir les dates
                    t_data['date'] = datetime.fromisoformat(t_data['date'])
                    t_data['created_at'] = datetime.fromisoformat(t_data['created_at'])
                    
                    user_tournaments.append(Tournament(**t_data))
                except Exception as e:
                    logger.error(f"Error loading tournament {t_data.get('id', 'unknown')}: {e}")
                    continue
        
        # Trier par date (plus récent en premier)
        user_tournaments.sort(key=lambda x: x.date, reverse=True)
        return user_tournaments
    
    def get_tournament_by_id(self, tournament_id: str) -> Optional[Tournament]:
        """Récupère un tournoi par son ID"""
        tournaments = self._load_json(self.tournaments_file)
        
        for t_data in tournaments:
            if t_data.get('id') == tournament_id:
                try:
                    self._ensure_tournament_fields(t_data)
                    
                    # Convertir les dates
                    t_data['date'] = datetime.fromisoformat(t_data['date'])
                    t_data['created_at'] = datetime.fromisoformat(t_data['created_at'])
                    
                    return Tournament(**t_data)
                except Exception as e:
                    logger.error(f"Error loading tournament {tournament_id}: {e}")
                    return None
        
        return None
    
    def update_tournament(self, tournament_id: str, **kwargs) -> Optional[Tournament]:
        """Met à jour un tournoi avec les nouvelles données"""
        try:
            tournaments = self._load_json(self.tournaments_file)
            
            for i, t_data in enumerate(tournaments):
                if t_data.get('id') == tournament_id:
                    # Mettre à jour les champs fournis
                    for key, value in kwargs.items():
                        if value is not None:
                            # Arrondir les montants pour éviter les problèmes de précision
                            if key in ['profit_loss', 'buy_in', 'total_cost', 'total_winnings'] and isinstance(value, (int, float)):
                                t_data[key] = round(float(value), 2)
                            else:
                                t_data[key] = value
                    
                    # Convertir les dates en string pour le JSON
                    if 'date' in t_data and isinstance(t_data['date'], datetime):
                        t_data['date'] = t_data['date'].isoformat()
                    if 'created_at' in t_data and isinstance(t_data['created_at'], datetime):
                        t_data['created_at'] = t_data['created_at'].isoformat()
                    
                    tournaments[i] = t_data
                    self._save_json(self.tournaments_file, tournaments)
                    
                    logger.info(f"Tournament {tournament_id} updated successfully")
                    return self.get_tournament_by_id(tournament_id)
            
            logger.warning(f"Tournament {tournament_id} not found for update")
            return None
            
        except Exception as e:
            logger.error(f"Error updating tournament {tournament_id}: {e}")
            raise
    
    def delete_tournament(self, tournament_id: str) -> bool:
        """Supprime un tournoi par son ID"""
        try:
            tournaments = self._load_json(self.tournaments_file)
            original_count = len(tournaments)
            
            # Filtrer pour garder tous les tournois sauf celui à supprimer
            tournaments = [t for t in tournaments if t.get('id') != tournament_id]
            
            if len(tournaments) < original_count:
                self._save_json(self.tournaments_file, tournaments)
                logger.info(f"Tournament {tournament_id} deleted successfully")
                return True
            else:
                logger.warning(f"Tournament {tournament_id} not found for deletion")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting tournament {tournament_id}: {e}")
            raise
    
    # ===== GESTION DES MAINS =====
    def create_hand(self, tournament_id: str, hand_data: Dict[str, Any]) -> Hand:
        """Crée une nouvelle main"""
        hands = self._load_json(self.hands_file)
        
        # Convertir les players
        players_list = []
        for p in hand_data.get('players', []):
            if isinstance(p, Player):
                players_list.append(p)
            elif isinstance(p, dict):
                players_list.append(Player(
                    name=p.get('name', ''),
                    seat=p.get('seat', 0),
                    stack=p.get('stack', 0),
                    bounty=p.get('bounty', 0.0)
                ))
        
        # Assurer les valeurs par défaut pour les listes
        hand_data.setdefault('ante_blinds_actions', [])
        hand_data.setdefault('preflop_actions', [])
        hand_data.setdefault('flop_actions', [])
        hand_data.setdefault('turn_actions', [])
        hand_data.setdefault('river_actions', [])
        hand_data.setdefault('showdown', [])
        hand_data.setdefault('summary', [])
        
        hand = Hand(
            id=str(uuid.uuid4()),
            tournament_id=tournament_id,
            hand_id=hand_data.get('hand_id', ''),
            hand_number=hand_data.get('hand_number', 0),
            level=hand_data.get('level', 1),
            blinds=hand_data.get('blinds', ''),
            ante=hand_data.get('ante', 0),
            small_blind=hand_data.get('small_blind', 0),
            big_blind=hand_data.get('big_blind', 0),
            date=hand_data.get('date', datetime.now()),
            table_name=hand_data.get('table_name', ''),
            max_players=hand_data.get('max_players', 6),
            button_seat=hand_data.get('button_seat', 1),
            players=players_list,
            hero_name=hand_data.get('hero_name', ''),
            hero_position=hand_data.get('hero_position', ''),
            hole_cards=hand_data.get('hole_cards', ''),
            ante_blinds_actions=hand_data['ante_blinds_actions'],
            preflop_actions=hand_data['preflop_actions'],
            flop=hand_data.get('flop'),
            flop_actions=hand_data['flop_actions'],
            turn=hand_data.get('turn'),
            turn_actions=hand_data['turn_actions'],
            river=hand_data.get('river'),
            river_actions=hand_data['river_actions'],
            showdown=hand_data['showdown'],
            summary=hand_data['summary'],
            pot_size=hand_data.get('pot_size', 0),
            rake=hand_data.get('rake', 0),
            raw_text=hand_data.get('raw_text', '')
        )
        
        hands.append(hand.to_dict())
        self._save_json(self.hands_file, hands)
        
        logger.debug(f"Hand created: {hand.hand_number} for tournament {tournament_id}")
        return hand
    
    def get_hands_by_tournament(self, tournament_id: str) -> List[Hand]:
        """Récupère toutes les mains d'un tournoi"""
        try:
            hands = self._load_json(self.hands_file)
            tournament_hands = []
            
            for h_data in hands:
                if h_data.get('tournament_id') == tournament_id:
                    try:
                        # Reconstituer les objets Player
                        players_list = []
                        for player_data in h_data.get('players', []):
                            if isinstance(player_data, dict):
                                players_list.append(Player(
                                    name=player_data.get('name', ''),
                                    seat=player_data.get('seat', 0),
                                    stack=player_data.get('stack', 0),
                                    bounty=player_data.get('bounty', 0.0)
                                ))
                        
                        h_data['players'] = players_list
                        
                        # Assurer les valeurs par défaut
                        h_data.setdefault('ante_blinds_actions', [])
                        h_data.setdefault('preflop_actions', [])
                        h_data.setdefault('flop_actions', [])
                        h_data.setdefault('turn_actions', [])
                        h_data.setdefault('river_actions', [])
                        h_data.setdefault('showdown', [])
                        h_data.setdefault('summary', [])
                        h_data.setdefault('small_blind', 0)
                        h_data.setdefault('big_blind', 0)
                        
                        # Vérifier et convertir la date
                        date_str = h_data.get('date')
                        if isinstance(date_str, str):
                            try:
                                h_data['date'] = datetime.fromisoformat(date_str)
                            except ValueError:
                                h_data['date'] = datetime.now()
                        elif not isinstance(date_str, datetime):
                            h_data['date'] = datetime.now()
                        
                        tournament_hands.append(Hand(**h_data))
                        
                    except Exception as e:
                        logger.error(f"Error loading hand {h_data.get('id', 'unknown')}: {e}")
                        continue
            
            # Trier par numéro de main
            tournament_hands.sort(key=lambda x: x.hand_number)
            return tournament_hands
                    
        except Exception as e:
            logger.error(f"Error in get_hands_by_tournament: {e}")
            return []
    
    def get_hand_by_id(self, hand_id: str) -> Optional[Hand]:
        """Récupère une main par son ID"""
        try:
            hands = self._load_json(self.hands_file)
            
            for h_data in hands:
                if h_data.get('id') == hand_id:
                    # Reconstituer les objets Player
                    players_list = []
                    for player_data in h_data.get('players', []):
                        if isinstance(player_data, dict):
                            players_list.append(Player(
                                name=player_data.get('name', ''),
                                seat=player_data.get('seat', 0),
                                stack=player_data.get('stack', 0),
                                bounty=player_data.get('bounty', 0.0)
                            ))
                    
                    h_data['players'] = players_list
                    
                    # Assurer les valeurs par défaut
                    h_data.setdefault('ante_blinds_actions', [])
                    h_data.setdefault('preflop_actions', [])
                    h_data.setdefault('flop_actions', [])
                    h_data.setdefault('turn_actions', [])
                    h_data.setdefault('river_actions', [])
                    h_data.setdefault('showdown', [])
                    h_data.setdefault('summary', [])
                    h_data.setdefault('small_blind', 0)
                    h_data.setdefault('big_blind', 0)
                    
                    # Convertir la date
                    date_str = h_data.get('date')
                    if isinstance(date_str, str):
                        try:
                            h_data['date'] = datetime.fromisoformat(date_str)
                        except ValueError:
                            h_data['date'] = datetime.now()
                    elif not isinstance(date_str, datetime):
                        h_data['date'] = datetime.now()
                    
                    return Hand(**h_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting hand {hand_id}: {e}")
            return None
    
    def update_hand(self, hand_id: str, **kwargs) -> Optional[Hand]:
        """Met à jour une main"""
        try:
            hands = self._load_json(self.hands_file)
            
            for i, h_data in enumerate(hands):
                if h_data.get('id') == hand_id:
                    # Mettre à jour les champs fournis
                    for key, value in kwargs.items():
                        if value is not None:
                            h_data[key] = value
                    
                    # Convertir la date en string pour le JSON si nécessaire
                    if 'date' in h_data and isinstance(h_data['date'], datetime):
                        h_data['date'] = h_data['date'].isoformat()
                    
                    hands[i] = h_data
                    self._save_json(self.hands_file, hands)
                    
                    logger.info(f"Hand {hand_id} updated successfully")
                    return self.get_hand_by_id(hand_id)
            
            logger.warning(f"Hand {hand_id} not found for update")
            return None
            
        except Exception as e:
            logger.error(f"Error updating hand {hand_id}: {e}")
            raise
    
    def delete_hand(self, hand_id: str) -> bool:
        """Supprime une main par son ID"""
        try:
            hands = self._load_json(self.hands_file)
            original_count = len(hands)
            
            # Filtrer pour garder toutes les mains sauf celle à supprimer
            hands = [h for h in hands if h.get('id') != hand_id]
            
            if len(hands) < original_count:
                self._save_json(self.hands_file, hands)
                logger.info(f"Hand {hand_id} deleted successfully")
                return True
            else:
                logger.warning(f"Hand {hand_id} not found for deletion")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting hand {hand_id}: {e}")
            raise
    
    def delete_hands_by_tournament(self, tournament_id: str) -> int:
        """Supprime toutes les mains d'un tournoi et retourne le nombre de mains supprimées"""
        try:
            hands = self._load_json(self.hands_file)
            original_count = len(hands)
            
            # Filtrer pour garder toutes les mains sauf celles du tournoi à supprimer
            hands = [h for h in hands if h.get('tournament_id') != tournament_id]
            
            deleted_count = original_count - len(hands)
            
            if deleted_count > 0:
                self._save_json(self.hands_file, hands)
                logger.info(f"Deleted {deleted_count} hands for tournament {tournament_id}")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error deleting hands for tournament {tournament_id}: {e}")
            raise
    
    def get_hands_by_hero(self, hero_name: str, tournament_id: str = None) -> List[Hand]:
        """Récupère toutes les mains d'un héros spécifique"""
        try:
            hands = self._load_json(self.hands_file)
            hero_hands = []
            
            for h_data in hands:
                if h_data.get('hero_name') == hero_name:
                    if tournament_id is None or h_data.get('tournament_id') == tournament_id:
                        try:
                            # Reconstituer la main (même logique que get_hands_by_tournament)
                            players_list = []
                            for player_data in h_data.get('players', []):
                                if isinstance(player_data, dict):
                                    players_list.append(Player(
                                        name=player_data.get('name', ''),
                                        seat=player_data.get('seat', 0),
                                        stack=player_data.get('stack', 0),
                                        bounty=player_data.get('bounty', 0.0)
                                    ))
                            
                            h_data['players'] = players_list
                            
                            # Assurer les valeurs par défaut
                            h_data.setdefault('ante_blinds_actions', [])
                            h_data.setdefault('preflop_actions', [])
                            h_data.setdefault('flop_actions', [])
                            h_data.setdefault('turn_actions', [])
                            h_data.setdefault('river_actions', [])
                            h_data.setdefault('showdown', [])
                            h_data.setdefault('summary', [])
                            h_data.setdefault('small_blind', 0)
                            h_data.setdefault('big_blind', 0)
                            
                            # Convertir la date
                            date_str = h_data.get('date')
                            if isinstance(date_str, str):
                                try:
                                    h_data['date'] = datetime.fromisoformat(date_str)
                                except ValueError:
                                    h_data['date'] = datetime.now()
                            elif not isinstance(date_str, datetime):
                                h_data['date'] = datetime.now()
                            
                            hero_hands.append(Hand(**h_data))
                            
                        except Exception as e:
                            logger.error(f"Error loading hand {h_data.get('id', 'unknown')}: {e}")
                            continue
            
            # Trier par date et numéro de main
            hero_hands.sort(key=lambda x: (x.date, x.hand_number))
            return hero_hands
            
        except Exception as e:
            logger.error(f"Error getting hands for hero {hero_name}: {e}")
            return []
    
    # ===== GESTION DES ANALYSES =====
    def create_hand_analysis(self, hand_analysis: HandAnalysis) -> HandAnalysis:
        """Crée une nouvelle analyse de main"""
        analyses = self._load_json(self.analyses_file)
        
        analysis_dict = hand_analysis.to_dict()
        analysis_dict['id'] = str(uuid.uuid4())
        analysis_dict['created_at'] = datetime.now().isoformat()
        
        analyses.append(analysis_dict)
        self._save_json(self.analyses_file, analyses)
        
        logger.info(f"Hand analysis created for hand {hand_analysis.hand_id}")
        return hand_analysis
    
    def get_hand_analysis(self, hand_id: str) -> Optional[HandAnalysis]:
        """Récupère l'analyse d'une main"""
        try:
            analyses = self._load_json(self.analyses_file)
            
            for analysis_data in analyses:
                if analysis_data.get('hand_id') == hand_id:
                    # Retirer les champs ajoutés automatiquement
                    analysis_data.pop('id', None)
                    analysis_data.pop('created_at', None)
                    return HandAnalysis(**analysis_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting analysis for hand {hand_id}: {e}")
            return None
    
    def update_hand_analysis(self, hand_id: str, hand_analysis: HandAnalysis) -> Optional[HandAnalysis]:
        """Met à jour l'analyse d'une main"""
        try:
            analyses = self._load_json(self.analyses_file)
            
            for i, analysis_data in enumerate(analyses):
                if analysis_data.get('hand_id') == hand_id:
                    # Préserver les métadonnées
                    analysis_id = analysis_data.get('id')
                    created_at = analysis_data.get('created_at')
                    
                    # Mettre à jour avec les nouvelles données
                    new_data = hand_analysis.to_dict()
                    new_data['id'] = analysis_id
                    new_data['created_at'] = created_at
                    new_data['updated_at'] = datetime.now().isoformat()
                    
                    analyses[i] = new_data
                    self._save_json(self.analyses_file, analyses)
                    
                    logger.info(f"Hand analysis updated for hand {hand_id}")
                    return hand_analysis
            
            # Si l'analyse n'existe pas, la créer
            return self.create_hand_analysis(hand_analysis)
            
        except Exception as e:
            logger.error(f"Error updating analysis for hand {hand_id}: {e}")
            raise
    
    def delete_hand_analysis(self, hand_id: str) -> bool:
        """Supprime l'analyse d'une main"""
        try:
            analyses = self._load_json(self.analyses_file)
            original_count = len(analyses)
            
            analyses = [a for a in analyses if a.get('hand_id') != hand_id]
            
            if len(analyses) < original_count:
                self._save_json(self.analyses_file, analyses)
                logger.info(f"Hand analysis deleted for hand {hand_id}")
                return True
            else:
                logger.warning(f"Hand analysis not found for hand {hand_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting analysis for hand {hand_id}: {e}")
            raise
    
    # ===== GESTION DES STATISTIQUES =====
    def save_player_stats(self, tournament_id: str, player_stats: List[PlayerStats]) -> None:
        """Sauvegarde les statistiques des joueurs pour un tournoi"""
        try:
            all_stats = self._load_json(self.stats_file)
            
            # Supprimer les anciennes stats pour ce tournoi
            all_stats = [stats for stats in all_stats if stats.get('tournament_id') != tournament_id]
            
            # Ajouter les nouvelles stats
            for stats in player_stats:
                stats_dict = stats.to_dict()
                stats_dict['tournament_id'] = tournament_id
                stats_dict['created_at'] = datetime.now().isoformat()
                all_stats.append(stats_dict)
            
            self._save_json(self.stats_file, all_stats)
            logger.info(f"Player stats saved for tournament {tournament_id}")
            
        except Exception as e:
            logger.error(f"Error saving player stats for tournament {tournament_id}: {e}")
            raise
    
    def get_player_stats(self, tournament_id: str = None, player_name: str = None) -> List[PlayerStats]:
        """Récupère les statistiques des joueurs"""
        try:
            all_stats = self._load_json(self.stats_file)
            filtered_stats = []
            
            for stats_data in all_stats:
                # Filtrer par tournoi si spécifié
                if tournament_id and stats_data.get('tournament_id') != tournament_id:
                    continue
                
                # Filtrer par joueur si spécifié
                if player_name and stats_data.get('player_name') != player_name:
                    continue
                
                # Retirer les champs ajoutés automatiquement
                stats_data.pop('tournament_id', None)
                stats_data.pop('created_at', None)
                
                filtered_stats.append(PlayerStats(**stats_data))
            
            return filtered_stats
            
        except Exception as e:
            logger.error(f"Error getting player stats: {e}")
            return []
    
    # ===== MÉTHODES UTILITAIRES =====
    def delete_tournament_and_hands(self, tournament_id: str) -> Dict[str, int]:
        """
        Supprime un tournoi et toutes ses données associées de manière atomique.
        Retourne un dictionnaire avec le nombre d'éléments supprimés.
        """
        try:
            # Supprimer d'abord les analyses des mains
            hands = self.get_hands_by_tournament(tournament_id)
            deleted_analyses = 0
            for hand in hands:
                if self.delete_hand_analysis(hand.id):
                    deleted_analyses += 1
            
            # Supprimer les statistiques du tournoi
            try:
                all_stats = self._load_json(self.stats_file)
                original_stats_count = len(all_stats)
                all_stats = [stats for stats in all_stats if stats.get('tournament_id') != tournament_id]
                deleted_stats = original_stats_count - len(all_stats)
                if deleted_stats > 0:
                    self._save_json(self.stats_file, all_stats)
            except Exception as e:
                logger.warning(f"Error deleting stats for tournament {tournament_id}: {e}")
                deleted_stats = 0
            
            # Supprimer les mains
            deleted_hands = self.delete_hands_by_tournament(tournament_id)
            
            # Supprimer le tournoi
            tournament_deleted = self.delete_tournament(tournament_id)
            
            result = {
                "tournament_deleted": 1 if tournament_deleted else 0,
                "hands_deleted": deleted_hands,
                "analyses_deleted": deleted_analyses,
                "stats_deleted": deleted_stats
            }
            
            logger.info(f"Tournament cleanup completed: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error in delete_tournament_and_hands for {tournament_id}: {e}")
            raise
    
    def get_tournament_summary(self, tournament_id: str) -> Optional[TournamentSummary]:
        """Génère un résumé complet d'un tournoi"""
        try:
            tournament = self.get_tournament_by_id(tournament_id)
            if not tournament:
                return None
            
            hands = self.get_hands_by_tournament(tournament_id)
            
            # Déterminer le nom du héros depuis les mains
            hero_name = "Unknown"
            if hands:
                hero_name = hands[0].hero_name
            
            return TournamentSummary(
                id=tournament.id,
                name=tournament.name,
                date=tournament.date,
                buy_in=tournament.buy_in,
                fee=tournament.fee,
                total_hands=len(hands),
                hero_name=hero_name,
                final_position=tournament.final_position,
                profit_loss=tournament.profit_loss,
                tournament_type=tournament.tournament_type,
                re_entries_count=tournament.re_entries_count,
                total_entries=tournament.total_entries,
                total_cost=tournament.total_cost,
                total_winnings=tournament.total_winnings
            )
            
        except Exception as e:
            logger.error(f"Error generating tournament summary for {tournament_id}: {e}")
            return None
    
    def get_hero_overall_stats(self, hero_name: str, user_id: str) -> Dict[str, Any]:
        """Calcule les statistiques globales d'un héros"""
        try:
            # Récupérer tous les tournois de l'utilisateur
            tournaments = self.get_tournaments_by_user(user_id)
            
            # Filtrer les tournois où le héros a joué
            hero_tournaments = []
            total_hands = 0
            total_profit = 0.0
            total_cost = 0.0
            
            for tournament in tournaments:
                hands = self.get_hands_by_tournament(tournament.id)
                if hands and any(hand.hero_name == hero_name for hand in hands):
                    hero_tournaments.append(tournament)
                    total_hands += len(hands)
                    total_profit += tournament.profit_loss
                    total_cost += tournament.total_cost
            
            # Calculer les statistiques
            tournament_count = len(hero_tournaments)
            avg_profit_per_tournament = total_profit / tournament_count if tournament_count > 0 else 0
            roi = (total_profit / total_cost * 100) if total_cost > 0 else 0
            
            # Position moyenne
            positions = [t.final_position for t in hero_tournaments if t.final_position > 0]
            avg_position = sum(positions) / len(positions) if positions else 0
            
            # ITM (In The Money) rate - approximation basée sur les profits positifs
            itm_tournaments = sum(1 for t in hero_tournaments if t.profit_loss > 0)
            itm_rate = (itm_tournaments / tournament_count * 100) if tournament_count > 0 else 0
            
            return {
                'hero_name': hero_name,
                'tournaments_played': tournament_count,
                'total_hands': total_hands,
                'total_profit': round(total_profit, 2),
                'total_cost': round(total_cost, 2),
                'avg_profit_per_tournament': round(avg_profit_per_tournament, 2),
                'roi_percentage': round(roi, 2),
                'avg_position': round(avg_position, 1) if avg_position > 0 else 0,
                'itm_rate': round(itm_rate, 1),
                'best_result': max(hero_tournaments, key=lambda x: x.profit_loss).profit_loss if hero_tournaments else 0,
                'worst_result': min(hero_tournaments, key=lambda x: x.profit_loss).profit_loss if hero_tournaments else 0
            }
            
        except Exception as e:
            logger.error(f"Error calculating overall stats for {hero_name}: {e}")
            return {}
    
    def backup_data(self, backup_path: str = None) -> str:
        """Crée une sauvegarde de toutes les données"""
        if backup_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(self.data_dir, f"backup_{timestamp}")
        
        try:
            os.makedirs(backup_path, exist_ok=True)
            
            files_to_backup = [
                self.tournaments_file,
                self.hands_file,
                self.analyses_file,
                self.stats_file,
                self.users_file
            ]
            
            for file_path in files_to_backup:
                if os.path.exists(file_path):
                    filename = os.path.basename(file_path)
                    backup_file_path = os.path.join(backup_path, filename)
                    
                    # Copier le fichier
                    data = self._load_json(file_path)
                    with open(backup_file_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Data backup created at: {backup_path}")
            return backup_path
            
        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            raise
    
    def restore_data(self, backup_path: str) -> bool:
        """Restaure les données depuis une sauvegarde"""
        try:
            backup_files = {
                'tournaments.json': self.tournaments_file,
                'hands.json': self.hands_file,
                'analyses.json': self.analyses_file,
                'player_stats.json': self.stats_file,
                'users.json': self.users_file
            }
            
            for backup_filename, target_file in backup_files.items():
                backup_file_path = os.path.join(backup_path, backup_filename)
                
                if os.path.exists(backup_file_path):
                    # Vérifier que le fichier de sauvegarde est valide
                    data = self._load_json(backup_file_path)
                    
                    # Restaurer le fichier
                    self._save_json(target_file, data)
                    logger.info(f"Restored {backup_filename}")
            
            logger.info(f"Data restoration completed from: {backup_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error restoring data from {backup_path}: {e}")
            return False
    
    def clear_all_data(self):
        """Fonction utilitaire pour nettoyer toutes les données"""
        try:
            files_to_clear = [
                self.tournaments_file,
                self.hands_file,
                self.analyses_file,
                self.stats_file
            ]
            
            for file_path in files_to_clear:
                if os.path.exists(file_path):
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump([], f)
            
            logger.info("All data cleared successfully")
            
        except Exception as e:
            logger.error(f"Error clearing data: {e}")
            raise
    
    def get_storage_info(self) -> Dict[str, Any]:
        """Retourne des informations sur le stockage"""
        try:
            info = {
                'data_directory': self.data_dir,
                'tournaments_count': len(self._load_json(self.tournaments_file)),
                'hands_count': len(self._load_json(self.hands_file)),
                'analyses_count': len(self._load_json(self.analyses_file)),
                'stats_count': len(self._load_json(self.stats_file)),
                'users_count': len(self._load_json(self.users_file))
            }
            
            # Calculer la taille des fichiers
            total_size = 0
            file_sizes = {}
            
            for file_path in [self.tournaments_file, self.hands_file, self.analyses_file, 
                            self.stats_file, self.users_file]:
                if os.path.exists(file_path):
                    size = os.path.getsize(file_path)
                    file_sizes[os.path.basename(file_path)] = size
                    total_size += size
            
            info['file_sizes'] = file_sizes
            info['total_size_bytes'] = total_size
            info['total_size_mb'] = round(total_size / (1024 * 1024), 2)
            
            return info
            
        except Exception as e:
            logger.error(f"Error getting storage info: {e}")
            return {}

# Instance globale
storage = FileStorage()