// components/TournamentList.tsx
import React, { useState, useEffect } from 'react';
import { Tournament } from '../types';

interface TournamentListProps {
  onTournamentSelect: (tournament: Tournament) => void;
  onNavigateToUpload: () => void;
}

type SortOption = 'date_desc' | 'date_asc' | 'profit_desc' | 'profit_asc' | 'position_asc' | 'position_desc' | 'hands_desc' | 'hands_asc';
type ViewMode = 'grid' | 'list';

const TournamentList: React.FC<TournamentListProps> = ({ 
  onTournamentSelect, 
  onNavigateToUpload 
}) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingTournament, setDeletingTournament] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [stats, setStats] = useState({
    totalTournaments: 0,
    totalHands: 0,
    totalProfit: 0,
    totalWinnings: 0,
    winRate: 0,
    totalReEntries: 0,
    totalCost: 0
  });

  // API calls
  const getTournaments = async (): Promise<Tournament[]> => {
    const response = await fetch('http://localhost:8000/api/tournaments');
    
    if (!response.ok) {
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Assurer que tous les champs requis sont présents
    return data.map((tournament: any) => ({
      ...tournament,
      fee: tournament.fee ?? 0,
      tournament_type: tournament.tournament_type || 'Unknown',
      late_registration_count: tournament.late_registration_count ?? 0,
      re_entries_count: tournament.re_entries_count ?? 0,
      total_entries: tournament.total_entries ?? 1,
      total_cost: tournament.total_cost ?? tournament.buy_in,
      total_winnings: tournament.total_winnings ?? 0
    }));
  };

  const deleteTournament = async (tournamentId: string): Promise<void> => {
    const response = await fetch(`http://localhost:8000/api/tournaments/${tournamentId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const data = await getTournaments();
      setTournaments(data);
      
      const totalHands = data.reduce((sum, t) => sum + t.total_hands, 0);
      const totalProfit = Math.round(data.reduce((sum, t) => sum + t.profit_loss, 0) * 100) / 100;
      const totalWinnings = Math.round(data.reduce((sum, t) => sum + (t.total_winnings || 0), 0) * 100) / 100;
      const totalCost = Math.round(data.reduce((sum, t) => sum + (t.total_cost || t.buy_in), 0) * 100) / 100;
      const wins = data.filter(t => t.profit_loss > 0).length;
      const winRate = data.length > 0 ? (wins / data.length) * 100 : 0;
      const totalReEntries = data.reduce((sum, t) => sum + (t.re_entries_count || 0), 0);
      
      setStats({
        totalTournaments: data.length,
        totalHands,
        totalProfit,
        totalWinnings,
        winRate,
        totalReEntries,
        totalCost
      });
    } catch (error) {
      console.error('Erreur lors du chargement des tournois:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortTournaments = (tournaments: Tournament[], sortOption: SortOption): Tournament[] => {
    const sorted = [...tournaments].sort((a, b) => {
      switch (sortOption) {
        case 'date_desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date_asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'profit_desc':
          return b.profit_loss - a.profit_loss;
        case 'profit_asc':
          return a.profit_loss - b.profit_loss;
        case 'position_asc':
          return a.final_position - b.final_position;
        case 'position_desc':
          return b.final_position - a.final_position;
        case 'hands_desc':
          return b.total_hands - a.total_hands;
        case 'hands_asc':
          return a.total_hands - b.total_hands;
        default:
          return 0;
      }
    });
    return sorted;
  };

  const sortedTournaments = sortTournaments(tournaments, sortBy);

  const sortOptions: { value: SortOption; label: string; icon: string }[] = [
    { value: 'date_desc', label: 'Plus récent d\'abord', icon: '📅↓' },
    { value: 'date_asc', label: 'Plus ancien d\'abord', icon: '📅↑' },
    { value: 'profit_desc', label: 'Meilleur profit d\'abord', icon: '💰↓' },
    { value: 'profit_asc', label: 'Pire profit d\'abord', icon: '💰↑' },
    { value: 'position_asc', label: 'Meilleure position d\'abord', icon: '🏆↑' },
    { value: 'position_desc', label: 'Pire position d\'abord', icon: '🏆↓' },
    { value: 'hands_desc', label: 'Plus de mains d\'abord', icon: '🃏↓' },
    { value: 'hands_asc', label: 'Moins de mains d\'abord', icon: '🃏↑' }
  ];

  const handleDeleteTournament = async (tournamentId: string) => {
    setDeletingTournament(tournamentId);
    try {
      await deleteTournament(tournamentId);
      await loadTournaments();
      setConfirmDelete(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du tournoi');
    } finally {
      setDeletingTournament(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMoney = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;
    return rounded >= 0 ? `+${rounded}€` : `${rounded}€`;
  };

  const formatPositiveMoney = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;
    return `${rounded}€`;
  };

  const formatTournamentType = (type?: string) => {
    if (!type || type === 'Unknown') return '❓ Type inconnu';
    
    if (type.includes('3-max')) {
      if (type.includes('real money')) return '💰 ' + type;
      return '👥 ' + type;
    }
    if (type.includes('6-max')) {
      if (type.includes('real money')) return '💰 ' + type;
      return '👥👥 ' + type;
    }
    if (type.includes('9-max')) {
      if (type.includes('real money')) return '💰 ' + type;
      return '👥👥👥 ' + type;
    }
    if (type.includes('real money')) return '💰 ' + type;
    if (type.includes('turbo')) return '⚡ ' + type;
    if (type.includes('knockout') || type.includes('KO')) return '💀 ' + type;
    
    return '🎯 ' + type;
  };

  const renderListView = () => (
    <div style={{
      backgroundColor: '#1a1f2e',
      borderRadius: '12px',
      border: '1px solid #2d3748',
      overflow: 'hidden'
    }}>
      {/* En-tête du tableau */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 120px',
        gap: '15px',
        padding: '15px 20px',
        backgroundColor: '#2d3748',
        borderBottom: '1px solid #4a5568',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#a0aec0'
      }}>
        <div>🏆 Tournoi</div>
        <div style={{ textAlign: 'center' }}>📅 Date</div>
        <div style={{ textAlign: 'center' }}>🏆 Position</div>
        <div style={{ textAlign: 'center' }}>🃏 Mains</div>
        <div style={{ textAlign: 'center' }}>💰 Buy-in</div>
        <div style={{ textAlign: 'center' }}>💸 Coût total</div>
        <div style={{ textAlign: 'center' }}>💎 Gains</div>
        <div style={{ textAlign: 'center' }}>📊 Profit</div>
        <div style={{ textAlign: 'center' }}>Actions</div>
      </div>

      {/* Lignes du tableau */}
      {sortedTournaments.map((tournament, index) => (
        <div
          key={tournament.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 120px',
            gap: '15px',
            padding: '15px 20px',
            borderBottom: index < sortedTournaments.length - 1 ? '1px solid #2d3748' : 'none',
            backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease',
            cursor: 'pointer',
            alignItems: 'center'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d3748'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onClick={() => onTournamentSelect(tournament)}
        >
          {/* Nom du tournoi */}
          <div>
            <div style={{ 
              color: '#e2e8f0', 
              fontWeight: 'bold', 
              fontSize: '14px',
              marginBottom: '4px'
            }}>
              {tournament.name}
            </div>
            <div style={{ 
              color: '#667eea', 
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {formatTournamentType(tournament.tournament_type)}
              {tournament.re_entries_count && tournament.re_entries_count > 0 && (
                <span style={{
                  backgroundColor: '#fbbf24',
                  color: '#1a1f2e',
                  padding: '2px 5px',
                  borderRadius: '6px',
                  fontSize: '9px',
                  fontWeight: 'bold'
                }}>
                  🔄 {tournament.re_entries_count}x
                </span>
              )}
            </div>
          </div>

          {/* Date */}
          <div style={{ 
            color: '#a0aec0', 
            fontSize: '12px',
            textAlign: 'center'
          }}>
            {formatDate(tournament.date)}
          </div>

          {/* Position */}
          <div style={{ 
            color: tournament.final_position <= 3 ? '#fbbf24' : '#667eea',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            #{tournament.final_position}
          </div>

          {/* Mains */}
          <div style={{ 
            color: '#48bb78',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {tournament.total_hands}
          </div>

          {/* Buy-in */}
          <div style={{ 
            color: '#667eea',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {tournament.buy_in}€
          </div>

          {/* Coût total */}
          <div style={{ 
            color: '#f56565',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {tournament.total_cost || tournament.buy_in}€
            {tournament.total_entries && tournament.total_entries > 1 && (
              <div style={{ fontSize: '10px', color: '#a0aec0' }}>
                ({tournament.total_entries} entrées)
              </div>
            )}
          </div>

          {/* Gains totaux */}
          <div style={{ 
            color: '#48bb78',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {formatPositiveMoney(tournament.total_winnings || 0)}
          </div>

          {/* Profit */}
          <div style={{ 
            color: tournament.profit_loss >= 0 ? '#48bb78' : '#ef4444',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {formatMoney(tournament.profit_loss)}
          </div>

          {/* Actions */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '8px' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {confirmDelete === tournament.id ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTournament(tournament.id);
                  }}
                  disabled={deletingTournament === tournament.id}
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: deletingTournament === tournament.id ? 'not-allowed' : 'pointer',
                    opacity: deletingTournament === tournament.id ? 0.5 : 1
                  }}
                >
                  {deletingTournament === tournament.id ? '⏳' : '✓'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(null);
                  }}
                  style={{
                    backgroundColor: '#4a5568',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(tournament.id);
                }}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  opacity: 0.7,
                  transition: 'opacity 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                title="Supprimer ce tournoi"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderGridView = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
      gap: '20px'
    }}>
      {sortedTournaments.map((tournament) => (
        <div
          key={tournament.id}
          style={{
            backgroundColor: '#1a1f2e',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #2d3748',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2d3748';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1a1f2e';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Bouton de suppression */}
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'flex',
            gap: '8px',
            zIndex: 10
          }}>
            <div style={{
              backgroundColor: tournament.profit_loss >= 0 ? '#48bb78' : '#ef4444',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {formatMoney(tournament.profit_loss)}
            </div>
            
            {confirmDelete === tournament.id ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTournament(tournament.id);
                  }}
                  disabled={deletingTournament === tournament.id}
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: deletingTournament === tournament.id ? 'not-allowed' : 'pointer',
                    opacity: deletingTournament === tournament.id ? 0.5 : 1
                  }}
                >
                  {deletingTournament === tournament.id ? '⏳' : '✓'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(null);
                  }}
                  style={{
                    backgroundColor: '#4a5568',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(tournament.id);
                }}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  opacity: 0.7,
                  transition: 'opacity 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                title="Supprimer ce tournoi"
              >
                🗑️
              </button>
            )}
          </div>

          {/* Contenu du tournoi */}
          <div onClick={() => onTournamentSelect(tournament)}>
            <h3 style={{
              color: '#e2e8f0',
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: 'bold',
              paddingRight: '120px'
            }}>
              {tournament.name}
            </h3>
            
            <div style={{
              color: '#667eea',
              fontSize: '11px',
              marginBottom: '15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              paddingRight: '120px'
            }}>
              {formatTournamentType(tournament.tournament_type)}
            </div>
            
            {/* Nouvel affichage selon vos spécifications */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '15px',
              fontSize: '14px'
            }}>
              {/* Date */}
              <div>
                <span style={{ color: '#a0aec0' }}>📅 Date:</span>
                <br />
                <span style={{ color: '#e2e8f0', fontSize: '13px' }}>
                  {formatDate(tournament.date)}
                </span>
              </div>
              
              {/* Position */}
              <div>
                <span style={{ color: '#a0aec0' }}>🏆 Position:</span>
                <br />
                <span style={{ 
                  color: tournament.final_position <= 3 ? '#fbbf24' : '#667eea', 
                  fontWeight: 'bold',
                  fontSize: '15px'
                }}>
                  #{tournament.final_position}
                </span>
              </div>
              
              {/* Mains */}
              <div>
                <span style={{ color: '#a0aec0' }}>🃏 Mains:</span>
                <br />
                <span style={{ color: '#48bb78', fontWeight: 'bold' }}>
                  {tournament.total_hands}
                </span>
              </div>
              
              {/* Buy-in */}
              <div>
                <span style={{ color: '#a0aec0' }}>💰 Buy-in:</span>
                <br />
                <span style={{ color: '#667eea', fontWeight: 'bold' }}>
                  {tournament.buy_in}€
                </span>
              </div>
              
              {/* Coût total */}
              <div>
                <span style={{ color: '#a0aec0' }}>💸 Coût total:</span>
                <br />
                <span style={{ color: '#f56565', fontWeight: 'bold' }}>
                  {tournament.total_cost || tournament.buy_in}€
                </span>
                {tournament.total_entries && tournament.total_entries > 1 && (
                  <div style={{ fontSize: '11px', color: '#a0aec0', fontStyle: 'italic' }}>
                    ({tournament.buy_in}€ × {tournament.total_entries})
                  </div>
                )}
              </div>
              
              {/* Re-entries */}
              <div>
                <span style={{ color: '#a0aec0' }}>🔄 Re-entries:</span>
                <br />
                <span style={{ color: '#667eea', fontWeight: 'bold' }}>
                  {tournament.re_entries_count || 0}
                </span>
              </div>

              {/* Gains totaux - toujours affiché */}
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: '#a0aec0' }}>💎 Gains totaux:</span>
                <br />
                <span style={{ color: '#48bb78', fontWeight: 'bold' }}>
                  {formatPositiveMoney(tournament.total_winnings || 0)}
                </span>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '15px',
              borderTop: '1px solid #2d3748'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#48bb78',
                  borderRadius: '50%'
                }}></div>
                <span style={{ color: '#48bb78', fontSize: '12px' }}>
                  Prêt pour le replay
                </span>
              </div>
              <span style={{ 
                color: '#667eea', 
                fontSize: '12px', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>🤖</span>
                Analyse IA →
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        color: '#e2e8f0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '20px',
            animation: 'spin 1s linear infinite'
          }}>🎰</div>
          <div style={{ fontSize: '18px' }}>Chargement de vos tournois...</div>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Statistiques globales */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: '#1a1f2e',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #2d3748',
          textAlign: 'center',
          transition: 'transform 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>
            {stats.totalTournaments}
          </div>
          <div style={{ color: '#a0aec0', fontSize: '14px' }}>Tournois joués</div>
        </div>
        
        <div style={{
          backgroundColor: '#1a1f2e',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #2d3748',
          textAlign: 'center',
          transition: 'transform 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#48bb78' }}>
            {stats.totalHands.toLocaleString()}
          </div>
          <div style={{ color: '#a0aec0', fontSize: '14px' }}>Mains jouées</div>
        </div>
        
        <div style={{
          backgroundColor: '#1a1f2e',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #2d3748',
          textAlign: 'center',
          transition: 'transform 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f56565' }}>
            {formatPositiveMoney(stats.totalCost)}
          </div>
          <div style={{ color: '#a0aec0', fontSize: '14px' }}>Coût total</div>
        </div>

        <div style={{
          backgroundColor: '#1a1f2e',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #2d3748',
          textAlign: 'center',
          transition: 'transform 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#48bb78' }}>
            {formatPositiveMoney(stats.totalWinnings)}
          </div>
          <div style={{ color: '#a0aec0', fontSize: '14px' }}>Gains totaux</div>
        </div>
        
        <div style={{
          backgroundColor: '#1a1f2e',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #2d3748',
          textAlign: 'center',
          transition: 'transform 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: stats.totalProfit >= 0 ? '#48bb78' : '#ef4444' 
          }}>
            {formatMoney(stats.totalProfit)}
          </div>
          <div style={{ color: '#a0aec0', fontSize: '14px' }}>Profit net</div>
        </div>
        
        <div style={{
          backgroundColor: '#1a1f2e',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #2d3748',
          textAlign: 'center',
          transition: 'transform 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: stats.winRate >= 50 ? '#48bb78' : '#fbbf24' 
          }}>
            {stats.winRate.toFixed(1)}%
          </div>
          <div style={{ color: '#a0aec0', fontSize: '14px' }}>Taux de victoire</div>
        </div>

        {stats.totalReEntries > 0 && (
          <div style={{
            backgroundColor: '#1a1f2e',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #2d3748',
            textAlign: 'center',
            transition: 'transform 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fbbf24' }}>
              {stats.totalReEntries}
            </div>
            <div style={{ color: '#a0aec0', fontSize: '14px' }}>Re-entries totales</div>
          </div>
        )}
      </div>

      {/* Header avec titre, sélecteur de vue, filtre et bouton d'import */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <h2 style={{ color: '#e2e8f0', margin: 0 }}>Vos tournois</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Sélecteur de mode de vue */}
          {tournaments.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: viewMode === 'grid' ? '#667eea' : '#2d3748',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Vue en grille"
              >
                <span>⊞</span>
                Grille
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: viewMode === 'list' ? '#667eea' : '#2d3748',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Vue en liste"
              >
                <span>☰</span>
                Liste
              </button>
            </div>
          )}

          {/* Sélecteur de tri */}
          {tournaments.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#a0aec0', fontSize: '14px' }}>Trier par:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{
                  backgroundColor: '#2d3748',
                  color: '#e2e8f0',
                  border: '1px solid #4a5568',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <button
            onClick={onNavigateToUpload}
            style={{
              padding: '12px 24px',
              backgroundColor: '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#38a169';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#48bb78';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>📁</span>
            Importer un nouveau tournoi
          </button>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#1a1f2e',
          borderRadius: '12px',
          border: '1px solid #2d3748'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎲</div>
          <h3 style={{ color: '#e2e8f0', marginBottom: '10px' }}>
            Aucun tournoi importé
          </h3>
          <p style={{ color: '#a0aec0', marginBottom: '30px' }}>
            Importez votre premier fichier de tournoi pour commencer l'analyse
          </p>
          <button
            onClick={onNavigateToUpload}
            style={{
                            padding: '15px 30px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
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
            Commencer l'analyse
          </button>
        </div>
      ) : (
        viewMode === 'grid' ? renderGridView() : renderListView()
      )}
    </div>
  );
};

export default TournamentList;
              