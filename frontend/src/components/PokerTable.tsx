// components/PokerTable.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Hand } from '../types';
import './PokerTable.css';

interface PokerTableProps {
  hand: Hand;
  currentHandIndex: number;
  totalHands: number;
  hands: Hand[];
  onPreviousHand: () => void;
  onNextHand: () => void;
  onSelectHand: (index: number) => void;
  onBack: () => void;
}

interface PlayerState {
  name: string;
  seat: number;
  stack: number;
  isHero: boolean;
  cards?: string;
  position: string;
  isActive: boolean;
  lastAction?: string;
  currentBet: number;
  isFolded: boolean;
  isAnimating?: boolean;
  animationType?: 'fold' | 'call' | 'raise' | 'bet' | 'check' | 'allin' | 'blind' | 'ante';
  revealedCards?: string;
}

interface GameState {
  phase: 'ante' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  communityCards: string[];
  pot: number;
  players: PlayerState[];
  allActions: Array<{ 
    phase: string; 
    action: string; 
    index: number;
    player?: string;
    amount?: number;
    actionType?: string;
  }>;
  currentActionIndex: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

const PokerTable: React.FC<PokerTableProps> = ({ 
  hand, 
  currentHandIndex, 
  totalHands, 
  hands,
  onPreviousHand, 
  onNextHand, 
  onSelectHand,
  onBack
}) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showInBB, setShowInBB] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1500);

  // === UTILITAIRES ===
  const extractBlinds = useCallback((blindsString: string) => {
    const match = blindsString.match(/(\d+)\/(\d+)/);
    if (match) {
      return { 
        smallBlind: parseInt(match[1]), 
        bigBlind: parseInt(match[2]),
        ante: hand.ante || 0
      };
    }
    return { smallBlind: 10, bigBlind: 20, ante: 0 };
  }, [hand.ante]);

  const formatAmount = useCallback((amount: number, bigBlind: number) => {
    if (showInBB && bigBlind > 0) {
      const bbAmount = amount / bigBlind;
      return bbAmount % 1 === 0 ? `${bbAmount}BB` : `${bbAmount.toFixed(1)}BB`;
    }
    return amount.toLocaleString();
  }, [showInBB]);

  const formatCard = useCallback((card: string) => {
    const suits = { 'h': '♥', 'H': '♥', 'd': '♦', 'D': '♦', 'c': '♣', 'C': '♣', 's': '♠', 'S': '♠' };
    if (card.length >= 2) {
      const rank = card.slice(0, -1);
      const suit = card.slice(-1);
      return rank + (suits[suit as keyof typeof suits] || suit);
    }
    return card;
  }, []);

  const getCardColor = useCallback((card: string) => {
    return (card.includes('♥') || card.includes('♦')) ? '#ef4444' : '#1f2937';
  }, []);

  // === PARSING AMÉLIORÉ DES ACTIONS ===
  const parseActionDetails = useCallback((action: string): {
    player: string;
    actionType: string;
    amount: number;
    isAllIn: boolean;
    revealedCards?: string;
  } => {
    const cleanAction = action.trim();
    
    // Actions à ignorer
    const ignorePatterns = [
      /^Board:/i,
      /^Total pot/i,
      /^\*\*\*/,
      /^FLOP:|^TURN:|^RIVER:/i
    ];
    
    for (const pattern of ignorePatterns) {
      if (pattern.test(cleanAction)) {
        return { player: '', actionType: 'ignore', amount: 0, isAllIn: false };
      }
    }
    
    // Détection des cartes révélées au showdown
    const showsMatch = cleanAction.match(/^([A-Za-z0-9_\-\.]+)[:\s]*.*shows?\s*\[([^\]]+)\]/i);
    if (showsMatch) {
      const playerName = showsMatch[1].trim().replace(':', '');
      const cards = showsMatch[2].trim();
      console.log(`🃏 Cards revealed for ${playerName}:`, cards);
      return { 
        player: playerName, 
        actionType: 'show', 
        amount: 0, 
        isAllIn: false,
        revealedCards: cards
      };
    }

    // Patterns pour extraire le joueur
    const playerPatterns = [
      /^([A-Za-z0-9_\-\.]+):\s*.+$/,
      /^([A-Za-z0-9_\-\.]+)\s+(folds|calls?|raises?|bets?|checks?)/i,
      /^([A-Za-z0-9_\-\.]+)\s+posts\s+(small|big)\s+blind/i,
      /^([A-Za-z0-9_\-\.]+)\s+posts\s+ante/i,
      /^([A-Za-z0-9_\-\.]+)\s+collected\s+\d+/i,
      /^Seat \d+:\s+([A-Za-z0-9_\-\.]+)\s+.*won\s+(\d+)/i
    ];
    
    let player = '';
    let specialAmount = 0;
    
    for (const pattern of playerPatterns) {
      const match = cleanAction.match(pattern);
      if (match && match[1]) {
        player = match[1].trim();
        if (pattern.source.includes('Seat.*won') && match[2]) {
          specialAmount = parseInt(match[2]);
        }
        break;
      }
    }
    
    if (!player) {
      return { player: '', actionType: 'ignore', amount: 0, isAllIn: false };
    }
    
    let actionType = 'unknown';
    let amount = specialAmount || 0;
    let isAllIn = false;
    
    const actionLower = cleanAction.toLowerCase();
    
    if (actionLower.includes('posts ante')) {
      actionType = 'ante';
      if (amount === 0) {
        const anteMatch = cleanAction.match(/posts ante (\d+)/i);
        amount = anteMatch ? parseInt(anteMatch[1]) : 0;
      }
    } else if (actionLower.includes('posts small blind')) {
      actionType = 'smallblind';
      if (amount === 0) {
        const sbMatch = cleanAction.match(/posts small blind (\d+)/i);
        amount = sbMatch ? parseInt(sbMatch[1]) : 0;
      }
    } else if (actionLower.includes('posts big blind')) {
      actionType = 'bigblind';
      if (amount === 0) {
        const bbMatch = cleanAction.match(/posts big blind (\d+)/i);
        amount = bbMatch ? parseInt(bbMatch[1]) : 0;
      }
    } else if (actionLower.includes('folds')) {
      actionType = 'fold';
    } else if (actionLower.includes('checks')) {
      actionType = 'check';
    } else if (actionLower.includes('calls')) {
      actionType = 'call';
      if (amount === 0) {
        const callMatch = cleanAction.match(/calls (\d+)/i);
        amount = callMatch ? parseInt(callMatch[1]) : 0;
      }
      isAllIn = actionLower.includes('all-in');
    } else if (actionLower.includes('bets')) {
      actionType = 'bet';
      if (amount === 0) {
        const betMatch = cleanAction.match(/bets (\d+)/i);
        amount = betMatch ? parseInt(betMatch[1]) : 0;
      }
      isAllIn = actionLower.includes('all-in');
    } else if (actionLower.includes('raises')) {
      actionType = 'raise';
      if (amount === 0) {
        const raiseMatch = cleanAction.match(/raises \d+ to (\d+)/i) || 
                          cleanAction.match(/raises to (\d+)/i) ||
                          cleanAction.match(/raises (\d+)/i);
        amount = raiseMatch ? parseInt(raiseMatch[1]) : 0;
      }
      isAllIn = actionLower.includes('all-in');
    } else if (actionLower.includes('collected') || actionLower.includes('won')) {
      actionType = 'win';
      if (amount === 0) {
        const winMatch = cleanAction.match(/(?:collected|won)\s+(\d+)/i) ||
                         cleanAction.match(/won\s+(\d+)/i);
        amount = winMatch ? parseInt(winMatch[1]) : 0;
      }
    }
    
    return { player, actionType, amount, isAllIn };
  }, []);

  // === TRAITEMENT DES ACTIONS ===
  const processAction = useCallback((state: GameState, actionObj: { 
    phase: string; 
    action: string; 
    index: number;
    player?: string;
    amount?: number;
    actionType?: string;
  }): GameState => {
    const newState = { ...state };
    const { action, phase } = actionObj;
    
    newState.players.forEach(p => { 
      p.isActive = false;
      p.isAnimating = false;
      p.animationType = undefined;
    });
    
    if (phase.includes('-deal')) {
      if (phase === 'flop-deal') {
        newState.phase = 'flop';
        newState.communityCards = hand.flop ? hand.flop.split(' ').filter(Boolean) : [];
        newState.players.forEach(p => { if (!p.isFolded) p.currentBet = 0; });
      } else if (phase === 'turn-deal') {
        newState.phase = 'turn';
        if (hand.turn?.trim()) {
          newState.communityCards.push(hand.turn.trim());
        }
        newState.players.forEach(p => { if (!p.isFolded) p.currentBet = 0; });
      } else if (phase === 'river-deal') {
        newState.phase = 'river';
        if (hand.river?.trim()) {
          newState.communityCards.push(hand.river.trim());
        }
        newState.players.forEach(p => { if (!p.isFolded) p.currentBet = 0; });
      }
      return newState;
    }
    
    const actionDetails = parseActionDetails(action);
    
    if (!actionDetails.player || actionDetails.actionType === 'ignore') {
      return newState;
    }
    
    const player = newState.players.find(p => {
      const playerNameLower = p.name.toLowerCase().trim();
      const searchNameLower = actionDetails.player.toLowerCase().trim();
      return playerNameLower === searchNameLower || 
             playerNameLower.includes(searchNameLower) || 
             searchNameLower.includes(playerNameLower);
    });
    
    if (!player) {
      if (!['ignore', 'unknown'].includes(actionDetails.actionType)) {
        console.warn(`Player not found: "${actionDetails.player}"`);
      }
      return newState;
    }
    
    player.isActive = true;
    player.isAnimating = true;
    
    const { actionType, amount, isAllIn, revealedCards } = actionDetails;
    
    switch (actionType) {
      case 'ante':
        break;
        
      case 'smallblind':
        if (amount > 0) {
          const betAmount = Math.max(0, amount - player.currentBet);
          player.currentBet = amount;
          player.stack = Math.max(0, player.stack - betAmount);
          newState.pot += betAmount;
          player.lastAction = `SB ${formatAmount(amount, newState.bigBlind)}`;
          player.animationType = 'blind';
        }
        break;
        
      case 'bigblind':
        if (amount > 0) {
          const betAmount = Math.max(0, amount - player.currentBet);
          player.currentBet = amount;
          player.stack = Math.max(0, player.stack - betAmount);
          newState.pot += betAmount;
          player.lastAction = `BB ${formatAmount(amount, newState.bigBlind)}`;
          player.animationType = 'blind';
        }
        break;
        
      case 'fold':
        player.isFolded = true;
        player.lastAction = 'Fold';
        player.animationType = 'fold';
        break;
        
      case 'check':
        player.lastAction = 'Check';
        player.animationType = 'check';
        break;
        
      case 'call':
        if (amount > 0) {
          const betAmount = Math.max(0, amount - player.currentBet);
          player.currentBet = amount;
          player.stack = Math.max(0, player.stack - betAmount);
          newState.pot += betAmount;
          
          if (isAllIn || player.stack === 0) {
            player.lastAction = `All-In ${formatAmount(amount, newState.bigBlind)}`;
            player.animationType = 'allin';
          } else {
            player.lastAction = `Call ${formatAmount(amount, newState.bigBlind)}`;
            player.animationType = 'call';
          }
        }
        break;
        
      case 'bet':
        if (amount > 0) {
          const betAmount = Math.max(0, amount - player.currentBet);
          player.currentBet = amount;
          player.stack = Math.max(0, player.stack - betAmount);
          newState.pot += betAmount;
          
          if (isAllIn || player.stack === 0) {
            player.lastAction = `All-In ${formatAmount(amount, newState.bigBlind)}`;
            player.animationType = 'allin';
          } else {
            player.lastAction = `Bet ${formatAmount(amount, newState.bigBlind)}`;
            player.animationType = 'bet';
          }
        }
        break;
        
      case 'raise':
        if (amount > 0) {
          const betAmount = Math.max(0, amount - player.currentBet);
          player.currentBet = amount;
          player.stack = Math.max(0, player.stack - betAmount);
          newState.pot += betAmount;
          
          if (isAllIn || player.stack === 0) {
            player.lastAction = `All-In ${formatAmount(amount, newState.bigBlind)}`;
            player.animationType = 'allin';
          } else {
            player.lastAction = `Raise ${formatAmount(amount, newState.bigBlind)}`;
            player.animationType = 'raise';
          }
        }
        break;
        
      case 'win':
        if (amount > 0) {
          player.stack += amount;
          player.lastAction = `Won ${formatAmount(amount, newState.bigBlind)}`;
          newState.pot = Math.max(0, newState.pot - amount);
          
          if (newState.pot <= 0) {
            newState.players.forEach(p => p.currentBet = 0);
          }
        }
        break;
        
      case 'show':
        if (revealedCards) {
          console.log(`🎯 Setting revealed cards for ${player.name}:`, revealedCards);
          player.revealedCards = revealedCards;
        }
        player.lastAction = 'Show';
        if (newState.phase !== 'showdown') {
          newState.phase = 'showdown';
        }
        break;
        
      default:
        if (actionType !== 'ignore' && actionType !== 'unknown') {
          player.lastAction = actionType;
        }
        break;
    }
    
    setTimeout(() => {
      setGameState(currentState => {
        if (!currentState) return currentState;
        const updatedState = { ...currentState };
        const updatedPlayer = updatedState.players.find(p => p.name === player.name);
        if (updatedPlayer) {
          updatedPlayer.isAnimating = false;
          updatedPlayer.animationType = undefined;
        }
        return updatedState;
      });
    }, 800);
    
    return newState;
  }, [hand, parseActionDetails, formatAmount]);

  // === INITIALISATION ===
  const initializeGameState = useCallback(() => {
    const { smallBlind, bigBlind, ante } = extractBlinds(hand.blinds);
    
    const players: PlayerState[] = hand.players.map((player) => ({
      name: player.name,
      seat: player.seat,
      stack: player.stack,
      isHero: player.name === hand.hero_name,
      cards: player.name === hand.hero_name ? hand.hole_cards : undefined,
      position: hand.hero_position || `Seat ${player.seat}`,
      isActive: false,
      currentBet: 0,
      isFolded: false,
      isAnimating: false,
      revealedCards: undefined
    }));

    const allActions: Array<{ 
      phase: string; 
      action: string; 
      index: number;
      player?: string;
      amount?: number;
      actionType?: string;
    }> = [];
    
    let initialPot = 0;
    if (hand.ante_blinds_actions && hand.ante_blinds_actions.length > 0) {
      hand.ante_blinds_actions.forEach((action) => {
        const details = parseActionDetails(action);
        if (details.actionType === 'ante') {
          const player = players.find(p => p.name.toLowerCase() === details.player.toLowerCase());
          if (player && details.amount > 0) {
            player.stack = Math.max(0, player.stack - details.amount);
            initialPot += details.amount;
          }
        } else {
          allActions.push({ 
            phase: 'ante', 
            action, 
            index: allActions.length,
            player: details.player,
            amount: details.amount,
            actionType: details.actionType
          });
        }
      });
    }
    
    hand.preflop_actions.forEach((action) => {
      const details = parseActionDetails(action);
      allActions.push({ 
        phase: 'preflop', 
        action, 
        index: allActions.length,
        player: details.player,
        amount: details.amount,
        actionType: details.actionType
      });
    });
    
    if (hand.flop?.trim()) {
      allActions.push({ phase: 'flop-deal', action: `FLOP: ${hand.flop}`, index: allActions.length });
      hand.flop_actions.forEach((action) => {
        const details = parseActionDetails(action);
        allActions.push({ 
          phase: 'flop', 
          action, 
          index: allActions.length,
          player: details.player,
          amount: details.amount,
          actionType: details.actionType
        });
      });
    }
    
    if (hand.turn?.trim()) {
      allActions.push({ phase: 'turn-deal', action: `TURN: ${hand.turn}`, index: allActions.length });
      hand.turn_actions.forEach((action) => {
        const details = parseActionDetails(action);
        allActions.push({ 
          phase: 'turn', 
          action, 
          index: allActions.length,
          player: details.player,
          amount: details.amount,
          actionType: details.actionType
        });
      });
    }
    
    if (hand.river?.trim()) {
      allActions.push({ phase: 'river-deal', action: `RIVER: ${hand.river}`, index: allActions.length });
      hand.river_actions.forEach((action) => {
        const details = parseActionDetails(action);
        allActions.push({ 
          phase: 'river', 
          action, 
          index: allActions.length,
          player: details.player,
          amount: details.amount,
          actionType: details.actionType
        });
      });
    }
    
    hand.showdown.forEach((action) => {
      const details = parseActionDetails(action);
      allActions.push({ 
        phase: 'showdown', 
        action, 
        index: allActions.length,
        player: details.player,
        amount: details.amount,
        actionType: details.actionType
      });
    });
    
    hand.summary.forEach((action) => {
      const details = parseActionDetails(action);
      allActions.push({ 
        phase: 'showdown', 
        action, 
        index: allActions.length,
        player: details.player,
        amount: details.amount,
        actionType: details.actionType
      });
    });
    
    console.log('🔄 Initializing new hand:', hand.hand_number);
    
    setGameState({
      phase: 'preflop',
      communityCards: [],
      pot: initialPot,
      players,
      allActions,
      currentActionIndex: -1,
      smallBlind,
      bigBlind,
      ante
    });
  }, [hand, extractBlinds, parseActionDetails]);

  useEffect(() => {
    initializeGameState();
  }, [initializeGameState]);

  // === CONTRÔLES ===
  const playNextAction = useCallback(() => {
    if (!gameState || gameState.currentActionIndex >= gameState.allActions.length - 1) return;
    
    const newState = { ...gameState };
    newState.currentActionIndex++;
    const currentAction = newState.allActions[newState.currentActionIndex];
    
    const updatedState = processAction(newState, currentAction);
    setGameState(updatedState);
  }, [gameState, processAction]);

  const playPreviousAction = useCallback(() => {
    if (!gameState || gameState.currentActionIndex <= -1) return;
    
    const targetAction = gameState.currentActionIndex - 1;
    initializeGameState();
    
    setTimeout(() => {
      if (targetAction >= 0) {
        setGameState(currentState => {
          if (!currentState) return currentState;
          
          let newState = { ...currentState };
          
          for (let i = 0; i <= targetAction; i++) {
            if (i < newState.allActions.length) {
              newState.currentActionIndex = i;
              const action = newState.allActions[i];
              newState = processAction(newState, action);
            }
          }
          
          return newState;
        });
      }
    }, 50);
  }, [gameState, initializeGameState, processAction]);

  const jumpToAction = useCallback((targetIndex: number) => {
    if (!gameState || targetIndex < -1 || targetIndex >= gameState.allActions.length) return;
    
    initializeGameState();
    
    setTimeout(() => {
      if (targetIndex >= 0) {
        setGameState(currentState => {
          if (!currentState) return currentState;
          
          let newState = { ...currentState };
          
          for (let i = 0; i <= targetIndex; i++) {
            if (i < newState.allActions.length) {
              newState.currentActionIndex = i;
              const action = newState.allActions[i];
              newState = processAction(newState, action);
            }
          }
          
          return newState;
        });
      }
    }, 50);
  }, [gameState, initializeGameState, processAction]);

  // Auto-play
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoPlay && gameState && gameState.currentActionIndex < gameState.allActions.length - 1) {
      interval = setInterval(() => {
        playNextAction();
      }, playSpeed);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoPlay, gameState, playNextAction, playSpeed]);

  if (!gameState) {
    return (
      <div className="poker-loading">
        <div className="loading-spinner"></div>
        <p>Chargement de la main...</p>
      </div>
    );
  }

  const getPlayerPosition = (index: number, total: number) => {
    const angle = (index * 360) / total;
    const radius = 42;
    const x = 50 + radius * Math.cos((angle - 90) * Math.PI / 180);
    const y = 50 + radius * 0.65 * Math.sin((angle - 90) * Math.PI / 180);
    return { x, y };
  };

  return (
    <div className="poker-arena">
      {/* Header minimaliste */}
      <div className="poker-header-minimal">
        <button onClick={onBack} className="btn-back-minimal">
          ← Retour
        </button>
        
        <div className="hand-info-minimal">
          <span className="hand-title-minimal">
            Main #{hand.hand_number} - {hand.hole_cards} - Niveau {hand.level}
          </span>
        </div>

        <div className="display-toggle">
          <button 
            onClick={() => setShowInBB(!showInBB)}
            className={`toggle-btn-minimal ${showInBB ? 'active' : ''}`}
          >
            {showInBB ? 'BB' : '€'}
          </button>
        </div>
      </div>

      {/* Interface principale */}
      <div className="poker-main">
        {/* Table de poker principale */}
        <div className="table-area">
          <div className={`poker-table-pro ${gameState.phase}`}>
            {/* Bouton dealer */}
            <div 
              className="dealer-button-pro"
              style={{
                left: `${(() => {
                  const dealerIndex = gameState.players.findIndex(p => p.seat === hand.button_seat);
                  if (dealerIndex === -1) return 50;
                  const pos = getPlayerPosition(dealerIndex, gameState.players.length);
                  return pos.x - 8; // Changé de +8 à -8 pour le placer à gauche
                })()}%`,
                top: `${(() => {
                  const dealerIndex = gameState.players.findIndex(p => p.seat === hand.button_seat);
                  if (dealerIndex === -1) return 50;
                  const pos = getPlayerPosition(dealerIndex, gameState.players.length);
                  return pos.y - 8;
                })()}%`
              }}
            >
              D
            </div>

            {/* Zone centrale - Pot et cartes communes */}
            <div className="table-center">
              <div className="pot-display">
                <div className="pot-amount-pro">
                  {formatAmount(gameState.pot, gameState.bigBlind)}
                </div>
              </div>
              
              {gameState.communityCards.length > 0 && (
                <div className="board">
                  {gameState.communityCards.map((card, index) => {
                    const formattedCard = formatCard(card);
                    return (
                      <div 
                        key={index} 
                        className="board-card"
                        style={{ 
                          color: getCardColor(formattedCard),
                          animationDelay: `${index * 0.15}s`
                        }}
                      >
                        {formattedCard}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="phase-indicator">
                {gameState.phase.toUpperCase()}
              </div>
            </div>

            {/* Joueurs avec nouveau style */}
            {gameState.players.map((player, index) => {
              const { x, y } = getPlayerPosition(index, gameState.players.length);
              
              let playerClasses = `player-sleek`;
              if (player.isHero) playerClasses += ' hero';
              if (player.isActive) playerClasses += ' active';
              if (player.isFolded) playerClasses += ' folded';
              if (player.isAnimating && player.animationType) {
                playerClasses += ` animate-${player.animationType}`;
              }
              
              return (
                <div
                  key={`${player.name}-${player.seat}`}
                  className={playerClasses}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`
                  }}
                >
                  {/* Info joueur compacte */}
                  <div className="player-info-sleek">
                    <div className="player-name-sleek">
                      {player.isHero && <span className="hero-indicator">★</span>}
                      {player.name}
                    </div>
                    <div className="player-stack-sleek">
                      {formatAmount(player.stack, gameState.bigBlind)}
                    </div>
                  </div>

                  {/* Cartes du joueur */}
                  {((player.cards && !player.isFolded) || player.revealedCards) && (
                    <div className="player-cards-sleek">
                      {(player.isHero ? 
                          (player.cards?.split(' ') || []) : 
                          (player.revealedCards?.split(' ') || [])
                        ).map((card, cardIndex) => {
                        const formattedCard = formatCard(card);
                        
                        return (
                          <div 
                            key={cardIndex}
                            className="card-sleek"
                            style={{ 
                              color: getCardColor(formattedCard),
                              animationDelay: `${cardIndex * 0.1}s`
                            }}
                          >
                            {formattedCard}
                          </div>
                        );
                      })}
                      
                      {!player.isHero && !player.revealedCards && !player.isFolded && (
                        <>
                          <div className="card-sleek hidden">?</div>
                          <div className="card-sleek hidden">?</div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Action du joueur */}
                  {player.lastAction && (
                    <div className="player-action-sleek">
                      {player.lastAction}
                    </div>
                  )}

                  {/* Mise actuelle */}
                  {player.currentBet > 0 && (
                    <div className="player-bet-sleek">
                      {formatAmount(player.currentBet, gameState.bigBlind)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau d'analyse IA compact */}
        <div className="ai-panel-compact">
          <div className="ai-header-compact">
            <span className="ai-title">🤖 Analyse IA</span>
            <span className="ai-status-compact">Bientôt</span>
          </div>
          
          <div className="ai-stats-compact">
            <div className="stat-compact">
              <span className="stat-label-compact">Main</span>
              <span className="stat-value-compact">{hand.hole_cards}</span>
            </div>
            <div className="stat-compact">
              <span className="stat-label-compact">Position</span>
              <span className="stat-value-compact">{hand.hero_position || 'N/A'}</span>
            </div>
            <div className="stat-compact">
              <span className="stat-label-compact">Actifs</span>
              <span className="stat-value-compact">{gameState.players.filter(p => !p.isFolded).length}</span>
            </div>
            <div className="stat-compact">
              <span className="stat-label-compact">Phase</span>
              <span className="stat-value-compact">{gameState.phase}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau de contrôle compact en bas */}
      <div className="control-panel-compact">
        {/* Navigation entre mains */}
        <div className="hand-navigation-compact">
          <button 
            onClick={onPreviousHand}
            disabled={currentHandIndex === 0}
            className="hand-nav-compact"
            title="Main précédente"
          >
            ⬅
          </button>
          
          <select
            value={currentHandIndex}
            onChange={(e) => onSelectHand(Number(e.target.value))}
            className="hand-select-compact"
          >
            {hands.map((handItem, index) => (
              <option key={index} value={index}>
                #{handItem.hand_number} - {handItem.hole_cards || '??'} - Lvl {handItem.level}
              </option>
            ))}
          </select>
          
          <button 
            onClick={onNextHand}
            disabled={currentHandIndex === totalHands - 1}
            className="hand-nav-compact"
            title="Main suivante"
          >
            ➡
          </button>
        </div>

        {/* Contrôles de lecture */}
        <div className="playback-controls-compact">
          <button 
            onClick={playPreviousAction}
            disabled={gameState.currentActionIndex <= -1}
            className="control-btn-compact"
            title="Action précédente"
          >
            ⏮
          </button>
          
          <button 
            onClick={() => setAutoPlay(!autoPlay)}
            className={`control-btn-compact ${autoPlay ? 'active' : ''}`}
            title={autoPlay ? 'Pause' : 'Lecture auto'}
          >
            {autoPlay ? '⏸' : '▶'}
          </button>
          
          <button 
            onClick={playNextAction}
            disabled={gameState.currentActionIndex >= gameState.allActions.length - 1}
            className="control-btn-compact"
            title="Action suivante"
          >
            ⏭
          </button>
        </div>

        {/* Slider d'action */}
        <div className="action-slider-compact">
          <input
            type="range"
            min="-1"
            max={gameState.allActions.length - 1}
            value={gameState.currentActionIndex}
            onChange={(e) => jumpToAction(parseInt(e.target.value))}
            className="slider-compact"
          />
          <div className="slider-info-compact">
            {gameState.currentActionIndex + 1} / {gameState.allActions.length}
          </div>
        </div>

        {/* Contrôle vitesse si autoplay */}
        {autoPlay && (
          <div className="speed-control-compact">
            <input
              type="range"
              min="500"
              max="3000"
              step="250"
              value={playSpeed}
              onChange={(e) => setPlaySpeed(parseInt(e.target.value))}
              className="speed-slider-compact"
            />
            <span className="speed-label-compact">{(playSpeed/1000).toFixed(1)}s</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PokerTable;