// types.ts
export interface Player {
  name: string;
  seat: number;
  stack: number;
  bounty: number;
}

export interface Hand {
  id: string;
  tournament_id: string;
  hand_id: string;
  hand_number: number;
  level: number;
  blinds: string;
  ante: number;
  small_blind?: number;
  big_blind?: number;
  date: string;
  table_name: string;
  max_players: number;
  button_seat: number;
  players: Player[];
  hero_name: string;
  hero_position: string;
  hole_cards: string;
  ante_blinds_actions: string[];
  preflop_actions: string[];
  flop: string | null;
  flop_actions: string[];
  turn: string | null;
  turn_actions: string[];
  river: string | null;
  river_actions: string[];
  showdown: string[];
  summary: string[];
  pot_size: number;
  rake: number;
  raw_text: string;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  buy_in: number;
  fee: number;
  total_hands: number;
  hero_name: string;
  final_position: number;
  profit_loss: number;
  tournament_type: string;
  late_registration_count: number;
  re_entries_count: number;
  total_entries: number;
  total_cost: number;
  total_winnings: number;
}

export interface UploadResult {
  tournament_id: string;
  name: string;
  total_hands: number;
  tournament_type: string;
  message?: string;
  status?: string;
  existing?: boolean;
}

// Types pour les composants
export interface TournamentSummary {
  id: string;
  name: string;
  date: string;
  buy_in: number;
  fee: number;
  total_hands: number;
  hero_name: string;
  final_position: number;
  profit_loss: number;
  tournament_type: string;
  late_registration_count: number;
  re_entries_count: number;
  total_entries: number;
  total_cost: number;
  total_winnings: number;
}

// Types pour les analyses
export interface ActionDetails {
  player: string;
  action_type: string;
  amount: number;
  is_all_in: boolean;
  phase: string;
  raw_text: string;
}

export interface PlayerStats {
  player_name: string;
  hands_played: number;
  vpip: number;
  pfr: number;
  aggression_factor: number;
  three_bet_percentage: number;
  fold_to_three_bet: number;
  cbet_flop: number;
  fold_to_cbet: number;
}

export interface HandAnalysis {
  hand_id: string;
  hero_analysis: Record<string, any>;
  opponent_analysis: Record<string, any>;
  hand_strength: string;
  decision_quality: Record<string, string>;
  suggestions: string[];
  overall_rating: string;
}