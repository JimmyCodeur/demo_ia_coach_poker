import os
from typing import Dict, Any

class PokerAnalyzerService:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
    
    async def analyze_hand(self, hand_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyse une main de poker (pour l'instant version simplifiée)
        Plus tard on ajoutera l'intégration OpenAI
        """
        
        # Analyse basique pour tester
        hand_number = hand_data.get('hand_number', 0)
        hole_cards = hand_data.get('hole_cards', '')
        position = hand_data.get('hero_position', '')
        
        # Logique d'analyse simplifiée
        if 'AA' in hole_cards or 'KK' in hole_cards:
            result = 'BON'
            reasoning = f"Très forte main pré-flop ({hole_cards})"
            improvement = "Continuez à jouer agressivement"
            confidence = 0.95
        elif any(pair in hole_cards for pair in ['QQ', 'JJ', 'TT']):
            result = 'BON'
            reasoning = f"Bonne paire de poche ({hole_cards})"
            improvement = "Jouez agressivement mais attention aux overcards"
            confidence = 0.8
        elif len(hole_cards.split()) == 2 and hole_cards.split()[0][0] == hole_cards.split()[1][0]:
            # Paire quelconque
            result = 'NEUTRE'
            reasoning = f"Paire de poche moyenne ({hole_cards})"
            improvement = "Jouez prudemment selon votre position"
            confidence = 0.6
        else:
            result = 'NEUTRE'
            reasoning = f"Main standard ({hole_cards}) en {position}"
            improvement = "Adaptez votre jeu à votre position et aux actions"
            confidence = 0.5
        
        return {
            'result': result,
            'reasoning': reasoning,
            'improvement': improvement,
            'confidence': confidence,
            'street': 'preflop'
        }