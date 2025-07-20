# models.py
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import List, Optional, Dict, Any

@dataclass
class User:
    id: str
    email: str
    hashed_password: str
    created_at: datetime
    is_active: bool = True
    
    def to_dict(self):
        return {
            **asdict(self),
            'created_at': self.created_at.isoformat()
        }

@dataclass
class Player:
    name: str
    seat: int
    stack: int
    bounty: float = 0.0
    
    def to_dict(self):
        return asdict(self)

@dataclass
class Tournament:
    id: str
    user_id: str
    name: str
    date: datetime
    buy_in: float
    fee: float
    total_players: int
    final_position: int
    profit_loss: float
    created_at: datetime
    tournament_type: str = "Unknown"
    late_registration_count: int = 0  # Garde pour compatibilité
    re_entries_count: int = 0  # Nombre de re-entries
    total_entries: int = 1  # Nombre total d'entrées (1 + re_entries)
    total_cost: float = 0.0  # Coût total réel
    total_winnings: float = 0.0  # Gains totaux (cash + bounty)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'date': self.date.isoformat(),
            'buy_in': self.buy_in,
            'fee': self.fee,
            'total_players': self.total_players,
            'final_position': self.final_position,
            'profit_loss': self.profit_loss,
            'created_at': self.created_at.isoformat(),
            'tournament_type': self.tournament_type,
            'late_registration_count': self.late_registration_count,
            're_entries_count': self.re_entries_count,
            'total_entries': self.total_entries,
            'total_cost': self.total_cost,
            'total_winnings': self.total_winnings
        }

@dataclass
class Hand:
    id: str
    tournament_id: str
    hand_id: str
    hand_number: int
    level: int
    blinds: str
    ante: int
    date: datetime
    table_name: str
    max_players: int
    button_seat: int
    players: List[Player]
    hero_name: str
    hero_position: str
    hole_cards: str
    pot_size: int
    rake: int
    raw_text: str
    # Champs pour les actions séparées par street
    ante_blinds_actions: List[str] = field(default_factory=list)
    preflop_actions: List[str] = field(default_factory=list)
    flop: Optional[str] = None
    flop_actions: List[str] = field(default_factory=list)
    turn: Optional[str] = None
    turn_actions: List[str] = field(default_factory=list)
    river: Optional[str] = None
    river_actions: List[str] = field(default_factory=list)
    showdown: List[str] = field(default_factory=list)
    summary: List[str] = field(default_factory=list)
    # Champs additionnels pour plus de précision
    small_blind: int = 0
    big_blind: int = 0
    
    def to_dict(self):
        return {
            'id': self.id,
            'tournament_id': self.tournament_id,
            'hand_id': self.hand_id,
            'hand_number': self.hand_number,
            'level': self.level,
            'blinds': self.blinds,
            'ante': self.ante,
            'small_blind': self.small_blind,
            'big_blind': self.big_blind,
            'date': self.date.isoformat(),
            'table_name': self.table_name,
            'max_players': self.max_players,
            'button_seat': self.button_seat,
            'players': [player.to_dict() for player in self.players],
            'hero_name': self.hero_name,
            'hero_position': self.hero_position,
            'hole_cards': self.hole_cards,
            'ante_blinds_actions': self.ante_blinds_actions,
            'preflop_actions': self.preflop_actions,
            'flop': self.flop,
            'flop_actions': self.flop_actions,
            'turn': self.turn,
            'turn_actions': self.turn_actions,
            'river': self.river,
            'river_actions': self.river_actions,
            'showdown': self.showdown,
            'summary': self.summary,
            'pot_size': self.pot_size,
            'rake': self.rake,
            'raw_text': self.raw_text
        }

@dataclass
class TournamentSummary:
    id: str
    name: str
    date: datetime
    buy_in: float
    fee: float
    total_hands: int
    hero_name: str
    final_position: int
    profit_loss: float
    tournament_type: str = "Unknown"
    re_entries_count: int = 0
    total_entries: int = 1
    total_cost: float = 0.0
    total_winnings: float = 0.0
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'date': self.date.isoformat(),
            'buy_in': self.buy_in,
            'fee': self.fee,
            'total_hands': self.total_hands,
            'hero_name': self.hero_name,
            'final_position': self.final_position,
            'profit_loss': self.profit_loss,
            'tournament_type': self.tournament_type,
            're_entries_count': self.re_entries_count,
            'total_entries': self.total_entries,
            'total_cost': self.total_cost,
            'total_winnings': self.total_winnings
        }

@dataclass
class ActionDetails:
    """Classe pour représenter les détails d'une action"""
    player: str
    action_type: str  # fold, call, raise, bet, check, ante, smallblind, bigblind, etc.
    amount: int = 0
    is_all_in: bool = False
    phase: str = ""
    raw_text: str = ""
    
    def to_dict(self):
        return asdict(self)

@dataclass
class GamePhase:
    """Classe pour représenter une phase du jeu"""
    name: str  # ante, preflop, flop, turn, river, showdown
    actions: List[ActionDetails] = field(default_factory=list)
    board_cards: List[str] = field(default_factory=list)
    pot_size: int = 0
    
    def to_dict(self):
        return {
            'name': self.name,
            'actions': [action.to_dict() for action in self.actions],
            'board_cards': self.board_cards,
            'pot_size': self.pot_size
        }

@dataclass
class HandAnalysis:
    """Classe pour l'analyse d'une main"""
    hand_id: str
    hero_analysis: Dict[str, Any] = field(default_factory=dict)
    opponent_analysis: Dict[str, Any] = field(default_factory=dict)
    hand_strength: str = ""
    decision_quality: Dict[str, str] = field(default_factory=dict)  # phase -> good/bad/neutral
    suggestions: List[str] = field(default_factory=list)
    overall_rating: str = ""  # A, B, C, D, F
    
    def to_dict(self):
        return asdict(self)

@dataclass
class PlayerStats:
    """Classe pour les statistiques d'un joueur"""
    player_name: str
    hands_played: int = 0
    vpip: float = 0.0  # Voluntarily Put money In Pot
    pfr: float = 0.0   # Pre-Flop Raise
    aggression_factor: float = 0.0
    three_bet_percentage: float = 0.0
    fold_to_three_bet: float = 0.0
    cbet_flop: float = 0.0  # Continuation bet flop
    fold_to_cbet: float = 0.0
    
    def to_dict(self):
        return asdict(self)