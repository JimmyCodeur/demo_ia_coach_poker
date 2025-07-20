// src/App.tsx
import React, { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import TournamentReplay from './components/TournamentReplay';
import TournamentList from './components/TournamentList';
import { UploadResult, Tournament } from './types';

type AppView = 'upload' | 'tournaments' | 'replay';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('tournaments');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleUploadSuccess = (result: UploadResult) => {
    console.log('Upload result received:', result);
    setUploadResult(result);
    setCurrentView('replay');
  };

  const handleTournamentSelect = (tournament: Tournament) => {
    console.log('Tournament selected:', tournament);
    
    // Conversion vers UploadResult avec valeurs par défaut
    const uploadResult: UploadResult = {
      tournament_id: tournament.id,
      name: tournament.name,
      total_hands: tournament.total_hands,
      tournament_type: tournament.tournament_type || 'Unknown', // Valeur par défaut
      message: 'Tournoi chargé depuis la liste',
      status: 'loaded',
      existing: true
    };
    
    setUploadResult(uploadResult);
    setCurrentView('replay');
  };

  const handleBackToTournaments = () => {
    setCurrentView('tournaments');
    setUploadResult(null);
  };

  const handleNavigateToUpload = () => {
    setCurrentView('upload');
  };

  const renderNavigation = () => (
    <nav style={{
      display: 'flex',
      gap: '20px',
      alignItems: 'center',
      marginTop: '10px'
    }}>
      <button
        onClick={() => setCurrentView('tournaments')}
        style={{
          padding: '8px 16px',
          backgroundColor: currentView === 'tournaments' ? '#667eea' : 'transparent',
          color: currentView === 'tournaments' ? 'white' : '#a0aec0',
          border: '1px solid #4a5568',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s ease'
        }}
      >
        📊 Mes Tournois
      </button>
      
      <button
        onClick={handleNavigateToUpload}
        style={{
          padding: '8px 16px',
          backgroundColor: currentView === 'upload' ? '#48bb78' : 'transparent',
          color: currentView === 'upload' ? 'white' : '#a0aec0',
          border: '1px solid #4a5568',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s ease'
        }}
      >
        📁 Importer
      </button>
    </nav>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'upload':
        return (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '60vh'
          }}>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        );
      
      case 'tournaments':
        return (
          <TournamentList 
            onTournamentSelect={handleTournamentSelect}
            onNavigateToUpload={handleNavigateToUpload}
          />
        );
      
      case 'replay':
        return uploadResult ? (
          <TournamentReplay 
            tournamentId={uploadResult.tournament_id}
            tournamentName={uploadResult.name}
            totalHands={uploadResult.total_hands}
            onBack={handleBackToTournaments}
          />
        ) : (
          <div>Erreur: Aucun tournoi sélectionné</div>
        );
      
      default:
        return <div>Vue non trouvée</div>;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f1419' }}>
      <style>{`
        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
      `}</style>
      
      <header style={{ 
        backgroundColor: '#1a1f2e', 
        borderBottom: '2px solid #2d3748', 
        padding: '20px 0',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '32px', 
                color: '#ffffff',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                🃏 Poker Pro Analyzer
              </h1>
              <p style={{ margin: '8px 0 0 0', color: '#a0aec0' }}>
                Analysez et rejouez vos tournois de poker en détail
              </p>
            </div>
          </div>
          
          {currentView !== 'replay' && renderNavigation()}
        </div>
      </header>
      
      <main style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        padding: currentView === 'replay' ? '0' : '40px 20px' 
      }}>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;