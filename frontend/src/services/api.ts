// services/api.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Types pour les réponses API
interface UploadResponse {
  tournament_id: string;
  name: string;
  total_hands: number;
  tournament_type?: string;
  message: string;
  status?: string;      
  existing?: boolean;   
}

interface TournamentResponse {
  tournament: any;
  total_hands: number;
  hero_name: string;
}

interface HandsResponse {
  hands: any[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface DeleteResponse {
  message: string;
  success: boolean;
}

interface UpdateSummaryResponse {
  message: string;
  summary_data: any;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`Making request to: ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error ${response.status}:`, errorText);
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`Response from ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async uploadTournament(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tournaments/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Upload response:', result); // ✅ Debug log
      return result;
    } catch (error) {
      console.error('Upload request failed:', error);
      throw error;
    }
  }

  async updateTournamentSummary(tournamentId: string, summaryFile: File): Promise<UpdateSummaryResponse> {
    const formData = new FormData();
    formData.append('file', summaryFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/update-summary`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Summary update error:', errorText);
        throw new Error(`Summary update failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Summary update request failed:', error);
      throw error;
    }
  }

  async getAll(): Promise<any[]> {
    return this.request<any[]>('/api/tournaments');
  }

  async getTournaments(): Promise<any[]> {
    const result = await this.request<any[]>('/api/tournaments');
    console.log('Get tournaments response:', result); // ✅ Debug log
    return result;
  }

  async getById(id: string): Promise<TournamentResponse> {
    return this.request<TournamentResponse>(`/api/tournaments/${id}`);
  }

  async getTournament(id: string): Promise<TournamentResponse> {
    return this.request<TournamentResponse>(`/api/tournaments/${id}`);
  }

  async getHands(tournamentId: string, page: number = 1, limit: number = 20): Promise<HandsResponse> {
    return this.request<HandsResponse>(`/api/tournaments/${tournamentId}/hands?page=${page}&limit=${limit}`);
  }

  async deleteTournament(id: string): Promise<DeleteResponse> {
    return this.request<DeleteResponse>(`/api/tournaments/${id}`, {
      method: 'DELETE',
    });
  }
}

export const tournamentAPI = new ApiService();