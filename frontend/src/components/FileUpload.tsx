// components/FileUpload.tsx
import React, { useState } from 'react';
import { UploadResult } from '../types';

interface FileUploadProps {
  onUploadSuccess: (result: UploadResult) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [handsFile, setHandsFile] = useState<File | null>(null);
  const [summaryFile, setSummaryFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'selecting' | 'uploading' | 'processing'>('selecting');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<'hands' | 'summary' | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const uploadTournament = async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('http://localhost:8000/api/tournaments/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Erreur réseau' }));
      throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
    }

    return response.json();
  };

  const updateTournamentSummary = async (tournamentId: string, file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`http://localhost:8000/api/tournaments/${tournamentId}/update-summary`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Erreur réseau' }));
      throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
    }
  };

  const handleFileSelect = (file: File, type: 'hands' | 'summary') => {
    setError(null);
    setUploadResult(null);
    
    if (type === 'hands') {
      if (file.name.includes('_summary.txt')) {
        setError('Ce fichier semble être un fichier summary. Veuillez le placer dans la zone "Fichier Summary".');
        return;
      }
      setHandsFile(file);
    } else {
      if (!file.name.includes('_summary.txt')) {
        setError('Ce fichier ne semble pas être un fichier summary. Veuillez sélectionner le fichier se terminant par "_summary.txt".');
        return;
      }
      setSummaryFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent, type: 'hands' | 'summary') => {
    e.preventDefault();
    setDragOver(type);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, type: 'hands' | 'summary') => {
    e.preventDefault();
    setDragOver(null);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0], type);
    }
  };

  const handleUpload = async () => {
    if (!handsFile || !summaryFile) {
      setError('Veuillez sélectionner les deux fichiers avant de continuer.');
      return;
    }

    setUploading(true);
    setUploadStep('uploading');
    setError(null);

    try {
      setUploadStep('processing');
      const handsResult = await uploadTournament(handsFile);
      
      // Assurer que tournament_type est défini
      const safeResult: UploadResult = {
        ...handsResult,
        tournament_type: handsResult.tournament_type || 'Unknown'
      };
      
      // Vérifier si le tournoi existe déjà
      if (safeResult.existing) {
        setUploadResult({
          ...safeResult,
          existing: true
        });
        
        // Attendre 4 secondes puis rediriger
        setTimeout(() => {
          onUploadSuccess(safeResult);
        }, 4000);
        
        return; // Sortir ici, ne pas traiter le fichier summary
      }
      
      // Si le tournoi est nouveau, traiter le fichier summary
      await updateTournamentSummary(safeResult.tournament_id, summaryFile);
      
      setUploadResult(safeResult);
      
      setTimeout(() => {
        onUploadSuccess(safeResult);
      }, 3000);
      
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      setUploadStep('selecting');
    }
  };

  const resetFiles = () => {
    setHandsFile(null);
    setSummaryFile(null);
    setError(null);
    setUploadResult(null);
  };

  const getDropZoneStyle = (type: 'hands' | 'summary', hasFile: boolean) => ({
    border: `2px dashed ${
      dragOver === type ? '#48bb78' : 
      hasFile ? '#667eea' : 
      '#4a5568'
    }`,
    borderRadius: '12px',
    padding: '30px',
    textAlign: 'center' as const,
    backgroundColor: dragOver === type ? '#1a202c' : hasFile ? '#1a2332' : '#1a1f2e',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    minHeight: '140px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center'
  });

  // Affichage spécial pour tournoi existant
  if (uploadResult?.existing) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px',
        backgroundColor: '#1a1f2e',
        borderRadius: '16px',
        border: '1px solid #2d3748',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ color: '#fbbf24', marginBottom: '20px' }}>
          Tournoi déjà présent
        </h2>
        
        <div style={{
          backgroundColor: '#2d3748',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'left'
        }}>
          <h3 style={{ color: '#e2e8f0', margin: '0 0 15px 0' }}>
            🏆 {uploadResult.name}
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '15px',
            fontSize: '14px'
          }}>
            <div>
              <span style={{ color: '#a0aec0' }}>🎯 Type:</span>
              <br />
              <span style={{ color: '#667eea', fontWeight: 'bold' }}>
                {uploadResult.tournament_type || 'Unknown'}
              </span>
            </div>
            <div>
              <span style={{ color: '#a0aec0' }}>🃏 Mains:</span>
              <br />
              <span style={{ color: '#48bb78', fontWeight: 'bold' }}>
                {uploadResult.total_hands}
              </span>
            </div>
          </div>
        </div>
        
        <div style={{
          backgroundColor: '#742a2a',
          color: '#feb2b2',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #e53e3e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <span>📋</span>
            Ce tournoi a déjà été importé et analysé
          </div>
        </div>
        
        <div style={{
          color: '#a0aec0',
          fontSize: '14px',
          marginBottom: '20px'
        }}>
          Redirection vers l'analyse existante dans 4 secondes...
        </div>
        
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button
            onClick={() => {
              setUploadResult(null);
              resetFiles();
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4a5568',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🔙 Retour
          </button>
          
          <button
            onClick={() => onUploadSuccess(uploadResult)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🎮 Voir l'analyse
          </button>
        </div>
      </div>
    );
  }

  // Affichage du résultat d'upload pour nouveau tournoi
  if (uploadResult && !uploadResult.existing) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px',
        backgroundColor: '#1a1f2e',
        borderRadius: '16px',
        border: '1px solid #2d3748',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
        <h2 style={{ color: '#48bb78', marginBottom: '20px' }}>
          Tournoi analysé avec succès !
        </h2>
        
        <div style={{
          backgroundColor: '#2d3748',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'left'
        }}>
          <h3 style={{ color: '#e2e8f0', margin: '0 0 15px 0' }}>
            🏆 {uploadResult.name}
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '15px',
            fontSize: '14px'
          }}>
            <div>
              <span style={{ color: '#a0aec0' }}>🎯 Type:</span>
              <br />
              <span style={{ color: '#667eea', fontWeight: 'bold' }}>
                {uploadResult.tournament_type || 'Unknown'}
              </span>
            </div>
            <div>
              <span style={{ color: '#a0aec0' }}>🃏 Mains:</span>
              <br />
              <span style={{ color: '#48bb78', fontWeight: 'bold' }}>
                {uploadResult.total_hands}
              </span>
            </div>
          </div>
        </div>
        
        <div style={{
          color: '#a0aec0',
          fontSize: '14px',
          marginBottom: '20px'
        }}>
          Redirection automatique vers l'analyse dans 3 secondes...
        </div>
        
        <button
          onClick={() => onUploadSuccess(uploadResult)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#48bb78',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🎮 Analyser maintenant
        </button>
      </div>
    );
  }

  // Interface d'upload normale
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '40px',
      backgroundColor: '#1a1f2e',
      borderRadius: '16px',
      border: '1px solid #2d3748',
      boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#e2e8f0', marginBottom: '10px' }}>
          📁 Importer un nouveau tournoi
        </h2>
        <p style={{ color: '#a0aec0', fontSize: '14px' }}>
          Pour obtenir les statistiques complètes, vous devez importer les deux fichiers générés par Winamax
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '30px'
      }}>
        {/* Zone de drop pour le fichier de mains */}
        <div>
          <h3 style={{ color: '#e2e8f0', marginBottom: '10px', fontSize: '16px' }}>
            1. Fichier de mains
          </h3>
          <div
            style={getDropZoneStyle('hands', !!handsFile)}
            onDragOver={(e) => handleDragOver(e, 'hands')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'hands')}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.txt';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileSelect(file, 'hands');
              };
              input.click();
            }}
          >
            {handsFile ? (
              <div>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>✅</div>
                <div style={{ color: '#48bb78', fontWeight: 'bold', marginBottom: '5px' }}>
                  Fichier sélectionné
                </div>
                <div style={{ color: '#a0aec0', fontSize: '12px' }}>
                  {handsFile.name}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎮</div>
                <div style={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '5px' }}>
                  Fichier des mains
                </div>
                <div style={{ color: '#a0aec0', fontSize: '12px' }}>
                  Ex: 20250708_TRIDENT_SPACE_KO_real_holdem_no-limit.txt
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zone de drop pour le fichier summary */}
        <div>
          <h3 style={{ color: '#e2e8f0', marginBottom: '10px', fontSize: '16px' }}>
            2. Fichier summary
          </h3>
          <div
            style={getDropZoneStyle('summary', !!summaryFile)}
            onDragOver={(e) => handleDragOver(e, 'summary')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'summary')}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.txt';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileSelect(file, 'summary');
              };
              input.click();
            }}
          >
            {summaryFile ? (
              <div>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>✅</div>
                <div style={{ color: '#48bb78', fontWeight: 'bold', marginBottom: '5px' }}>
                  Fichier sélectionné
                </div>
                <div style={{ color: '#a0aec0', fontSize: '12px' }}>
                  {summaryFile.name}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
                <div style={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '5px' }}>
                  Fichier summary
                </div>
                <div style={{ color: '#a0aec0', fontSize: '12px' }}>
                  Ex: 20250708_TRIDENT_SPACE_KO_summary.txt
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Informations d'aide */}
      <div style={{
        backgroundColor: '#2d3748',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        border: '1px solid #4a5568'
      }}>
        <h4 style={{ color: '#fbbf24', margin: '0 0 10px 0', fontSize: '14px' }}>
          💡 Comment trouver vos fichiers :
        </h4>
        <ul style={{ color: '#a0aec0', fontSize: '12px', margin: 0, paddingLeft: '20px' }}>
          <li>Le fichier de mains est généré automatiquement pendant que vous jouez</li>
          <li>Le fichier summary est créé à la fin du tournoi</li>
          <li>Les deux fichiers portent le même nom avec "_summary" ajouté pour le second</li>
          <li>Vous les trouverez dans votre dossier Winamax/History</li>
        </ul>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#742a2a',
          color: '#feb2b2',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #e53e3e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>❌</span>
            {error}
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
        <button
          onClick={resetFiles}
          disabled={uploading}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4a5568',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            opacity: uploading ? 0.5 : 1
          }}
        >
          🔄 Réinitialiser
        </button>
        
        <button
          onClick={handleUpload}
          disabled={!handsFile || !summaryFile || uploading}
          style={{
            padding: '12px 24px',
            backgroundColor: handsFile && summaryFile && !uploading ? '#48bb78' : '#4a5568',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: handsFile && summaryFile && !uploading ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 'bold',
            opacity: handsFile && summaryFile && !uploading ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {uploading ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
              {uploadStep === 'uploading' ? 'Upload en cours...' : 'Traitement...'}
            </>
          ) : (
            <>
              <span>🚀</span>
              Analyser le tournoi
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FileUpload;