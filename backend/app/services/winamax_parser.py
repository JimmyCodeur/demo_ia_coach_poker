# services/winamax_parser.py
import re
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

class WinamaxParser:
    def __init__(self):
        self.tournament_pattern = r'Winamax Poker - Tournament "([^"]+)" buyIn: ([0-9.,]+)€ \+ ([0-9.,]+)€'
        self.hand_pattern = r'HandId: #(\d+)-(\d+)-(\d+)'
        self.date_pattern = r'(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}) UTC'
        self.level_pattern = r'level: (\d+)'
        self.blinds_pattern = r'no limit \((\d+)/(\d+)/(\d+)\)'
        self.table_pattern = r"Table: '[^']+' (\d+)-max \(([^)]+)\)"
        
    def parse_tournament_file(self, content: str) -> Dict[str, Any]:
        """Parse les informations du tournoi depuis le fichier de log"""
        try:
            lines = content.strip().split('\n')
            
            # Chercher la première ligne avec les infos du tournoi
            first_line = lines[0] if lines else ""
            
            # Extraire le nom du tournoi
            tournament_match = re.search(self.tournament_pattern, first_line)
            if not tournament_match:
                raise ValueError("Impossible d'extraire le nom du tournoi")
            
            tournament_name = tournament_match.group(1)
            buy_in_base = float(tournament_match.group(2).replace(',', '.'))
            fee = float(tournament_match.group(3).replace(',', '.'))
            display_buy_in = buy_in_base + fee
            
            # Extraire la date depuis la première main
            date_match = re.search(self.date_pattern, first_line)
            if date_match:
                date_str = date_match.group(1)
                tournament_date = datetime.strptime(date_str, '%Y/%m/%d %H:%M:%S')
            else:
                tournament_date = datetime.now()
            
            # Extraire le type de tournoi
            tournament_type = self._extract_tournament_type(content)
            
            # Compter le nombre de mains
            hands_count = len(re.findall(r'Winamax Poker - Tournament', content))
            
            final_position = 0
            total_players = 0
            profit_loss = 0.0
            
            logger.info(f"Parsed tournament: {tournament_name}, type: {tournament_type}, hands: {hands_count}")
            
            return {
                'name': tournament_name,
                'date': tournament_date,
                'buy_in': display_buy_in,
                'fee': 0,
                'buy_in_base': buy_in_base,
                'fee_base': fee,
                'tournament_type': tournament_type,
                'total_players': total_players,
                'final_position': final_position,
                'profit_loss': profit_loss,
                'hands_count': hands_count
            }
            
        except Exception as e:
            logger.error(f"Error parsing tournament file: {e}")
            raise ValueError(f"Erreur lors du parsing du fichier: {e}")
    
    def _extract_tournament_type(self, content: str) -> str:
        """Extrait le type de tournoi depuis la première table"""
        try:
            table_match = re.search(self.table_pattern, content)
            if table_match:
                max_players = table_match.group(1)
                table_type = table_match.group(2)
                return f"{max_players}-max {table_type}"
            
            simple_match = re.search(r"Table: '[^']+' (\d+)-max \(([^)]+)\)", content)
            if simple_match:
                max_players = simple_match.group(1)
                table_type = simple_match.group(2)
                return f"{max_players}-max {table_type}"
            
            return "Unknown"
        except Exception as e:
            logger.warning(f"Could not extract tournament type: {e}")
            return "Unknown"
    
    def parse_summary_file(self, content: str) -> Dict[str, Any]:
        """Parse le fichier summary avec gestion des re-entries"""
        try:
            summary_info = {}
            
            summary_sections = re.split(r'(?=Winamax Poker - Tournament summary)', content)
            summary_sections = [section.strip() for section in summary_sections if section.strip()]
            
            logger.info(f"Found {len(summary_sections)} tournament entries")
            
            if not summary_sections:
                return summary_info
            
            total_entries = len(summary_sections)
            re_entries_count = max(0, total_entries - 1)
            
            late_registration_count = 0
            for section in summary_sections:
                if "Late Registration" in section:
                    late_registration_count += 1
            
            has_late_registration = late_registration_count > 0
            last_section = summary_sections[-1]
            
            # Extraire la position finale
            final_position_match = re.search(r'You finished in (\d+)(?:th|st|nd|rd) place', last_section)
            if final_position_match:
                summary_info['final_position'] = int(final_position_match.group(1))
            
            # Nombre de joueurs
            players_match = re.search(r'Registered players : (\d+)', last_section)
            if players_match:
                summary_info['total_players'] = int(players_match.group(1))
            
            # Buy-in
            buyin_match = re.search(r'Buy-In : ([0-9.,]+)€ \+ ([0-9.,]+)€ \+ ([0-9.,]+)€', last_section)
            if buyin_match:
                base_buyin = float(buyin_match.group(1).replace(',', '.'))
                bounty = float(buyin_match.group(2).replace(',', '.'))
                fee = float(buyin_match.group(3).replace(',', '.'))
                
                single_buy_in = base_buyin + bounty + fee
                summary_info['buy_in'] = round(single_buy_in, 2)
                
                total_cost = single_buy_in * total_entries
                summary_info['total_cost'] = round(total_cost, 2)
                summary_info['single_entry_cost'] = round(single_buy_in, 2)
                
                summary_info['buy_in_details'] = {
                    'base': base_buyin,
                    'bounty': bounty,
                    'fee': fee,
                    'total_entries': total_entries,
                    're_entries': re_entries_count,
                    'cost_per_entry': single_buy_in
                }
            
            # Calculer les gains
            total_winnings = 0.0
            total_bounties = 0.0
            
            for section in summary_sections:
                section_lines = section.split('\n')
                
                for line in section_lines:
                    line = line.strip()
                    
                    combined_match = re.search(r'You won ([0-9.,]+)€ \+ Bounty ([0-9.,]+)€', line)
                    if combined_match:
                        cash_win = float(combined_match.group(1).replace(',', '.'))
                        bounty_win = float(combined_match.group(2).replace(',', '.'))
                        total_winnings += cash_win
                        total_bounties += bounty_win
                        continue
                    
                    bounty_only_match = re.search(r'You won Bounty ([0-9.,]+)€', line)
                    if bounty_only_match:
                        bounty_win = float(bounty_only_match.group(1).replace(',', '.'))
                        total_bounties += bounty_win
                        continue
                    
                    cash_only_match = re.search(r'You won ([0-9.,]+)€(?! \+ Bounty)', line)
                    if cash_only_match and 'Bounty' not in line:
                        cash_win = float(cash_only_match.group(1).replace(',', '.'))
                        total_winnings += cash_win
                        continue
            
            summary_info['total_winnings'] = round(total_winnings, 2)
            summary_info['total_bounties'] = round(total_bounties, 2)
            summary_info['combined_winnings'] = round(total_winnings + total_bounties, 2)
            
            # Calculer le profit
            if 'total_cost' in summary_info:
                total_gains = total_winnings + total_bounties
                profit_loss = total_gains - summary_info['total_cost']
                summary_info['profit_loss'] = round(profit_loss, 2)
                
                summary_info['profit_calculation'] = {
                    'total_gains': total_gains,
                    'total_cost': summary_info['total_cost'],
                    'profit_loss': profit_loss,
                    'total_entries': total_entries,
                    're_entries': re_entries_count,
                    'cost_per_entry': single_buy_in
                }
            else:
                summary_info['profit_loss'] = round(total_winnings + total_bounties, 2)
            
            summary_info['entries_count'] = total_entries
            summary_info['re_entries_count'] = re_entries_count
            summary_info['late_registration_count'] = late_registration_count
            summary_info['has_late_registration'] = has_late_registration
            
            # Temps de jeu
            time_match = re.search(r'You played ([0-9]+)min ([0-9]+)s', last_section)
            if time_match:
                minutes = int(time_match.group(1))
                seconds = int(time_match.group(2))
                summary_info['play_time_minutes'] = minutes
                summary_info['play_time_seconds'] = seconds
                summary_info['total_play_time'] = f"{minutes}min {seconds}s"
            
            logger.info(f"Summary parsed - Position: {summary_info.get('final_position', 'N/A')}, "
                    f"Total entries: {total_entries}, Re-entries: {re_entries_count}")
            
            return summary_info
            
        except Exception as e:
            logger.error(f"Error parsing summary file: {e}")
            return {}
    
    def extract_hands(self, content: str) -> List[Dict[str, Any]]:
        """Extrait toutes les mains du fichier"""
        hands = []
        
        # Séparer les mains individuelles
        hand_blocks = re.split(r'(?=Winamax Poker - Tournament)', content)
        
        for i, block in enumerate(hand_blocks):
            if not block.strip():
                continue
                
            try:
                hand_data = self._parse_single_hand(block, i + 1)
                if hand_data:
                    hands.append(hand_data)
            except Exception as e:
                logger.warning(f"Erreur lors du parsing de la main {i + 1}: {e}")
                continue
        
        return hands
    
    def _parse_single_hand(self, hand_text: str, hand_number: int) -> Optional[Dict[str, Any]]:
        """Parse une main individuelle avec toutes les informations"""
        try:
            lines = hand_text.strip().split('\n')
            
            # === INFORMATIONS DE BASE ===
            first_line = lines[0] if lines else ""
            
            # Extraire l'ID de la main
            hand_id_match = re.search(self.hand_pattern, first_line)
            if not hand_id_match:
                return None
            hand_id = f"{hand_id_match.group(1)}-{hand_id_match.group(2)}-{hand_id_match.group(3)}"
            
            # Extraire le niveau
            level_match = re.search(self.level_pattern, first_line)
            level = int(level_match.group(1)) if level_match else 1
            
            # Extraire les blinds et ante
            blinds_match = re.search(self.blinds_pattern, first_line)
            if blinds_match:
                ante = int(blinds_match.group(1))
                small_blind = int(blinds_match.group(2))
                big_blind = int(blinds_match.group(3))
                blinds = f"{small_blind}/{big_blind}"
            else:
                ante = 0
                small_blind = 0
                big_blind = 0
                blinds = "0/0"
            
            # Extraire la date
            date_match = re.search(self.date_pattern, first_line)
            hand_date = datetime.strptime(date_match.group(1), '%Y/%m/%d %H:%M:%S') if date_match else datetime.now()
            
            # Extraire le nom de la table et infos
            table_info = self._extract_table_info(lines)
            
            # === JOUEURS ===
            players = self._extract_players_detailed(lines)
            
            # === HERO INFORMATION ===
            hero_info = self._extract_hero_info(lines)
            hero_name = hero_info['name']
            hero_cards = hero_info['cards']
            
            # === ACTIONS PAR STREET ===
            # Séparer le texte en sections
            sections = self._split_hand_sections(hand_text)
            
            # Extraire les actions pour chaque street
            ante_blinds_actions = self._extract_ante_blinds_actions(sections.get('ante_blinds', ''))
            preflop_actions = self._extract_street_actions(sections.get('preflop', ''))
            flop_actions = self._extract_street_actions(sections.get('flop', ''))
            turn_actions = self._extract_street_actions(sections.get('turn', ''))
            river_actions = self._extract_street_actions(sections.get('river', ''))
            
            # === BOARD ===
            board_info = self._extract_board_info(hand_text)
            
            # === SUMMARY ===
            summary_info = self._extract_summary_detailed(sections.get('summary', ''))
            
            # === CONSTRUCTION DE LA MAIN ===
            hand_data = {
                'hand_id': hand_id,
                'hand_number': hand_number,
                'level': level,
                'blinds': blinds,
                'ante': ante,
                'small_blind': small_blind,
                'big_blind': big_blind,
                'date': hand_date,
                'table_name': table_info['name'],
                'max_players': table_info['max_players'],
                'button_seat': table_info['button_seat'],
                'players': players,
                'hero_name': hero_name,
                'hero_position': self._get_hero_position(hero_name, players, table_info['button_seat']),
                'hole_cards': hero_cards,
                'ante_blinds_actions': ante_blinds_actions,
                'preflop_actions': preflop_actions,
                'flop': board_info.get('flop'),
                'flop_actions': flop_actions,
                'turn': board_info.get('turn'),
                'turn_actions': turn_actions,
                'river': board_info.get('river'),
                'river_actions': river_actions,
                'showdown': self._extract_showdown_actions(sections.get('showdown', '')),
                'summary': summary_info['lines'],
                'pot_size': summary_info['pot_size'],
                'rake': summary_info.get('rake', 0),
                'raw_text': hand_text
            }
            
            logger.debug(f"Parsed hand {hand_number}: {len(preflop_actions)} preflop actions, pot: {summary_info['pot_size']}")
            
            return hand_data
            
        except Exception as e:
            logger.error(f"Error parsing hand {hand_number}: {e}")
            return None
    
    def _extract_table_info(self, lines: List[str]) -> Dict[str, Any]:
        """Extrait les informations de la table"""
        table_info = {
            'name': '',
            'max_players': 6,
            'button_seat': 1
        }
        
        for line in lines:
            # Table name
            table_match = re.search(r"Table: '([^']+)' (\d+)-max", line)
            if table_match:
                table_info['name'] = table_match.group(1)
                table_info['max_players'] = int(table_match.group(2))
            
            # Button position
            button_match = re.search(r'Seat #(\d+) is the button', line)
            if button_match:
                table_info['button_seat'] = int(button_match.group(1))
        
        return table_info
    
    def _extract_players_detailed(self, lines: List[str]) -> List[Dict[str, Any]]:
        """Extrait les informations détaillées des joueurs"""
        players = []
        
        for line in lines:
            # Pattern pour les joueurs avec bounty
            seat_match = re.search(r'Seat (\d+): ([^\s]+) \((\d+)(?:, ([0-9.,]+)€ bounty)?\)', line)
            if seat_match:
                seat = int(seat_match.group(1))
                name = seat_match.group(2)
                stack = int(seat_match.group(3))
                bounty_str = seat_match.group(4)
                bounty = float(bounty_str.replace(',', '.')) if bounty_str else 0.0
                
                players.append({
                    'name': name,
                    'seat': seat,
                    'stack': stack,
                    'bounty': bounty
                })
        
        # Trier par siège
        players.sort(key=lambda x: x['seat'])
        return players
    
    def _extract_hero_info(self, lines: List[str]) -> Dict[str, str]:
        """Extrait les informations du héros"""
        hero_info = {'name': '', 'cards': ''}
        
        for line in lines:
            cards_match = re.search(r'Dealt to ([^\s]+) \[([^\]]+)\]', line)
            if cards_match:
                hero_info['name'] = cards_match.group(1)
                hero_info['cards'] = cards_match.group(2)
                break
        
        return hero_info
    
    def _split_hand_sections(self, hand_text: str) -> Dict[str, str]:
        """Divise la main en sections distinctes"""
        sections = {}
        
        # Ante/Blinds section
        ante_start = hand_text.find('*** ANTE/BLINDS ***')
        preflop_start = hand_text.find('*** PRE-FLOP ***')
        if ante_start != -1 and preflop_start != -1:
            sections['ante_blinds'] = hand_text[ante_start:preflop_start]
        
        # Preflop section
        flop_start = hand_text.find('*** FLOP ***')
        if preflop_start != -1:
            end_pos = flop_start if flop_start != -1 else hand_text.find('*** SUMMARY ***')
            if end_pos != -1:
                sections['preflop'] = hand_text[preflop_start:end_pos]
        
        # Flop section
        turn_start = hand_text.find('*** TURN ***')
        if flop_start != -1:
            end_pos = turn_start if turn_start != -1 else hand_text.find('*** SUMMARY ***')
            if end_pos != -1:
                sections['flop'] = hand_text[flop_start:end_pos]
        
        # Turn section
        river_start = hand_text.find('*** RIVER ***')
        if turn_start != -1:
            end_pos = river_start if river_start != -1 else hand_text.find('*** SUMMARY ***')
            if end_pos != -1:
                sections['turn'] = hand_text[turn_start:end_pos]
        
        # River section
        showdown_start = hand_text.find('*** SHOW DOWN ***')
        summary_start = hand_text.find('*** SUMMARY ***')
        if river_start != -1:
            end_pos = showdown_start if showdown_start != -1 else summary_start
            if end_pos != -1:
                sections['river'] = hand_text[river_start:end_pos]
        
        # Showdown section
        if showdown_start != -1 and summary_start != -1:
            sections['showdown'] = hand_text[showdown_start:summary_start]
        
        # Summary section
        if summary_start != -1:
            sections['summary'] = hand_text[summary_start:]
        
        return sections
    
    def _extract_ante_blinds_actions(self, section_text: str) -> List[str]:
        """Extrait les actions d'ante et blinds"""
        actions = []
        
        if not section_text:
            return actions
        
        lines = section_text.split('\n')
        for line in lines:
            line = line.strip()
            if any(keyword in line for keyword in ['posts ante', 'posts small blind', 'posts big blind']):
                actions.append(line)
        
        return actions
    
    def _extract_street_actions(self, section_text: str) -> List[str]:
        """Extrait les actions d'une street"""
        actions = []
        
        if not section_text:
            return actions
        
        lines = section_text.split('\n')
        for line in lines:
            line = line.strip()
            # Actions de joueurs (pas les lignes de board ou de section)
            if line and not line.startswith('***') and not line.startswith('['):
                # Vérifier si c'est une action valide
                if any(keyword in line.lower() for keyword in 
                       ['folds', 'calls', 'raises', 'bets', 'checks', 'collected', 'shows']):
                    actions.append(line)
        
        return actions
    
    def _extract_board_info(self, hand_text: str) -> Dict[str, Optional[str]]:
        """Extrait les informations du board"""
        board_info = {'flop': None, 'turn': None, 'river': None}
        
        # Flop
        flop_match = re.search(r'\*\*\* FLOP \*\*\* \[([^\]]+)\]', hand_text)
        if flop_match:
            board_info['flop'] = flop_match.group(1)
        
        # Turn
        turn_match = re.search(r'\*\*\* TURN \*\*\* \[([^\]]+)\]\[([^\]]+)\]', hand_text)
        if turn_match:
            board_info['turn'] = turn_match.group(2)
        
        # River
        river_match = re.search(r'\*\*\* RIVER \*\*\* \[([^\]]+)\]\[([^\]]+)\]', hand_text)
        if river_match:
            board_info['river'] = river_match.group(2)
        
        return board_info
    
    def _extract_showdown_actions(self, section_text: str) -> List[str]:
        """Extrait les actions du showdown"""
        actions = []
        
        if not section_text:
            return actions
        
        lines = section_text.split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('***'):
                actions.append(line)
        
        return actions
    
    def _extract_summary_detailed(self, section_text: str) -> Dict[str, Any]:
        """Extrait les informations détaillées du summary"""
        summary_info = {
            'lines': [],
            'pot_size': 0,
            'rake': 0
        }
        
        if not section_text:
            return summary_info
        
        lines = section_text.split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('***'):
                summary_info['lines'].append(line)
                
                # Extraire le pot
                pot_match = re.search(r'Total pot (\d+)', line)
                if pot_match:
                    summary_info['pot_size'] = int(pot_match.group(1))
                
                # Extraire le rake si présent
                rake_match = re.search(r'rake (\d+)', line)
                if rake_match:
                    summary_info['rake'] = int(rake_match.group(1))
        
        return summary_info
    
    def _get_hero_position(self, hero_name: str, players: List[Dict[str, Any]], button_seat: int) -> str:
        """Détermine la position du héros par rapport au bouton"""
        if not hero_name:
            return "Unknown"
        
        hero_seat = None
        for player in players:
            if player['name'] == hero_name:
                hero_seat = player['seat']
                break
        
        if hero_seat is None:
            return "Unknown"
        
        num_players = len(players)
        
        # Calculer la position relative au bouton
        if hero_seat == button_seat:
            return "BTN"
        
        # Calculer l'offset par rapport au bouton
        seats = [p['seat'] for p in players]
        seats.sort()
        
        try:
            button_index = seats.index(button_seat)
            hero_index = seats.index(hero_seat)
            
            # Position relative (combien de places après le bouton)
            offset = (hero_index - button_index) % num_players
            
            if num_players == 2:
                return "BTN" if offset == 0 else "BB"
            elif num_players == 3:
                positions = ["BTN", "SB", "BB"]
                return positions[offset]
            else:
                positions = ["BTN", "SB", "BB", "UTG", "MP", "MP2", "MP3", "CO"]
                if offset < len(positions):
                    return positions[offset]
                else:
                    return f"MP+{offset-3}"
                    
        except (ValueError, IndexError):
            return f"Seat {hero_seat}"