// components/TournamentReplay.tsx
import React, { useState, useEffect } from 'react';
import { Hand } from '../types';
import { tournamentAPI } from '../services/api';
import PokerTable from './PokerTable';

interface TournamentReplayProps {
  tournamentId: string;
  tournamentName: string;
  totalHands: number;
  onBack: () => void;
}

const TournamentReplay: React.FC<TournamentReplayProps> = ({ 
  tournamentId, 
  tournamentName, 
  totalHands, 
  onBack
}) => {
  const [hands, setHands] = useState<Hand[]>([]);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHands = async () => {
      try {
        const response = await tournamentAPI.getHands(tournamentId, 1, 1000);
        setHands(response.hands);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
      } finally {
        setLoading(false);
      }
    };
    loadHands();
  }, [tournamentId]);

  const goToNextHand = () => {
    if (currentHandIndex < hands.length - 1) {
      setCurrentHandIndex(currentHandIndex + 1);
    }
  };

  const goToPreviousHand = () => {
    if (currentHandIndex > 0) {
      setCurrentHandIndex(currentHandIndex - 1);
    }
  };

  const goToHand = (index: number) => {
    if (index >= 0 && index < hands.length) {
      setCurrentHandIndex(index);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f1419',
        color: '#e2e8f0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '20px',
            animation: 'cardSpin 2s linear infinite'
          }}>🎴</div>
          <div style={{ fontSize: '18px' }}>Chargement des mains...</div>
        </div>
        <style>{`
          @keyframes cardSpin {
            from { transform: rotateY(0deg); }
            to { transform: rotateY(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (hands.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f1419',
        color: '#e2e8f0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2>Aucune main trouvée</h2>
          <p>Le fichier n'a pas pu être analysé correctement.</p>
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginTop: '20px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#5a67d8';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#667eea';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            ← Retour aux tournois
          </button>
        </div>
      </div>
    );
  }

  const currentHand = hands[currentHandIndex];

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#0f1419',
      padding: '0'
    }}>
      <PokerTable 
        hand={currentHand} 
        currentHandIndex={currentHandIndex}
        totalHands={hands.length}
        hands={hands}
        onPreviousHand={goToPreviousHand}
        onNextHand={goToNextHand}
        onSelectHand={goToHand}
        onBack={onBack}
      />
    </div>
  );
};

export default TournamentReplay;