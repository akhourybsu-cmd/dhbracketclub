export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action_payload: Json | null
          action_type: string
          actor_user_id: string
          created_at: string
          id: string
          pool_id: string
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          actor_user_id: string
          created_at?: string
          id?: string
          pool_id: string
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_logs_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      bracket_picks: {
        Row: {
          bracket_id: string
          created_at: string
          game_id: string
          id: string
          picked_in_round: number
          picked_team_id: string
          updated_at: string
        }
        Insert: {
          bracket_id: string
          created_at?: string
          game_id: string
          id?: string
          picked_in_round: number
          picked_team_id: string
          updated_at?: string
        }
        Update: {
          bracket_id?: string
          created_at?: string
          game_id?: string
          id?: string
          picked_in_round?: number
          picked_team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_picks_bracket_id_fkey"
            columns: ["bracket_id"]
            isOneToOne: false
            referencedRelation: "brackets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_picks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_picks_picked_team_id_fkey"
            columns: ["picked_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      brackets: {
        Row: {
          created_at: string
          id: string
          pool_id: string
          status: string | null
          submitted_at: string | null
          tiebreaker_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pool_id: string
          status?: string | null
          submitted_at?: string | null
          tiebreaker_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pool_id?: string
          status?: string | null
          submitted_at?: string | null
          tiebreaker_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brackets_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brackets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_external_mappings: {
        Row: {
          created_at: string
          external_game_id: string
          external_region: string | null
          external_round_name: string | null
          game_id: string
          id: string
          provider_name: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_game_id: string
          external_region?: string | null
          external_round_name?: string | null
          game_id: string
          id?: string
          provider_name: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_game_id?: string
          external_region?: string | null
          external_round_name?: string | null
          game_id?: string
          id?: string
          provider_name?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_external_mappings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_external_mappings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      game_state_history: {
        Row: {
          changed_at: string
          changed_by_source: string
          game_id: string
          id: string
          new_score: Json | null
          new_status: string | null
          new_winner_team_id: string | null
          previous_score: Json | null
          previous_status: string | null
          previous_winner_team_id: string | null
          sync_run_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by_source: string
          game_id: string
          id?: string
          new_score?: Json | null
          new_status?: string | null
          new_winner_team_id?: string | null
          previous_score?: Json | null
          previous_status?: string | null
          previous_winner_team_id?: string | null
          sync_run_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by_source?: string
          game_id?: string
          id?: string
          new_score?: Json | null
          new_status?: string | null
          new_winner_team_id?: string | null
          previous_score?: Json | null
          previous_status?: string | null
          previous_winner_team_id?: string | null
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_state_history_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_history_new_winner_team_id_fkey"
            columns: ["new_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_history_previous_winner_team_id_fkey"
            columns: ["previous_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_history_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          game_slot: number
          id: string
          is_result_final: boolean
          live_clock: string | null
          live_period: string | null
          region: string
          round_name: string
          round_number: number
          scheduled_at: string | null
          source_last_updated_at: string | null
          source_payload: Json | null
          status: string | null
          team1_id: string | null
          team1_score: number | null
          team2_id: string | null
          team2_score: number | null
          tournament_id: string
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string
          game_slot: number
          id?: string
          is_result_final?: boolean
          live_clock?: string | null
          live_period?: string | null
          region: string
          round_name: string
          round_number: number
          scheduled_at?: string | null
          source_last_updated_at?: string | null
          source_payload?: Json | null
          status?: string | null
          team1_id?: string | null
          team1_score?: number | null
          team2_id?: string | null
          team2_score?: number | null
          tournament_id: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string
          game_slot?: number
          id?: string
          is_result_final?: boolean
          live_clock?: string | null
          live_period?: string | null
          region?: string
          round_name?: string
          round_number?: number
          scheduled_at?: string | null
          source_last_updated_at?: string | null
          source_payload?: Json | null
          status?: string | null
          team1_id?: string | null
          team1_score?: number | null
          team2_id?: string | null
          team2_score?: number | null
          tournament_id?: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_members: {
        Row: {
          id: string
          joined_at: string
          pool_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          pool_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          pool_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          lock_time: string
          name: string
          owner_user_id: string
          tournament_id: string
          visibility: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code: string
          lock_time: string
          name: string
          owner_user_id: string
          tournament_id: string
          visibility?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          lock_time?: string
          name?: string
          owner_user_id?: string
          tournament_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pools_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      provider_configs: {
        Row: {
          base_url: string | null
          created_at: string
          enabled: boolean
          id: string
          provider_name: string
          sport: string
          tournament_scope: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          provider_name: string
          sport?: string
          tournament_scope?: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          provider_name?: string
          sport?: string
          tournament_scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          id: string
          points_per_correct_pick: number
          pool_id: string
          round_number: number
        }
        Insert: {
          id?: string
          points_per_correct_pick: number
          pool_id: string
          round_number: number
        }
        Update: {
          id?: string
          points_per_correct_pick?: number
          pool_id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      standings: {
        Row: {
          correct_picks: number | null
          id: string
          pool_id: string
          possible_points_remaining: number | null
          rank: number | null
          total_points: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_picks?: number | null
          id?: string
          pool_id: string
          possible_points_remaining?: number | null
          rank?: number | null
          total_points?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_picks?: number | null
          id?: string
          pool_id?: string
          possible_points_remaining?: number | null
          rank?: number | null
          total_points?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standings_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      standings_snapshots: {
        Row: {
          correct_picks: number
          id: string
          pool_id: string
          possible_points_remaining: number
          rank: number | null
          snapshot_at: string
          source: string
          total_points: number
          user_id: string
        }
        Insert: {
          correct_picks?: number
          id?: string
          pool_id: string
          possible_points_remaining?: number
          rank?: number | null
          snapshot_at?: string
          source?: string
          total_points?: number
          user_id: string
        }
        Update: {
          correct_picks?: number
          id?: string
          pool_id?: string
          possible_points_remaining?: number
          rank?: number | null
          snapshot_at?: string
          source?: string
          total_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standings_snapshots_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_events: {
        Row: {
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          status: string
          sync_run_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          status?: string
          sync_run_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          status?: string
          sync_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_events_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          initiated_by_user_id: string | null
          provider_name: string
          raw_summary: Json | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          initiated_by_user_id?: string | null
          provider_name: string
          raw_summary?: Json | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          initiated_by_user_id?: string | null
          provider_name?: string
          raw_summary?: Json | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_initiated_by_user_id_fkey"
            columns: ["initiated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          play_in_group: number | null
          region: string
          school_name: string
          seed: number
          short_name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          play_in_group?: number | null
          region: string
          school_name: string
          seed: number
          short_name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          play_in_group?: number | null
          region?: string
          school_name?: string
          seed?: number
          short_name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          external_season_id: string | null
          gender_division: string | null
          id: string
          last_synced_at: string | null
          lock_time: string
          name: string
          season_year: number
          sport: string | null
          status: string | null
          sync_status: string | null
        }
        Insert: {
          created_at?: string
          external_season_id?: string | null
          gender_division?: string | null
          id?: string
          last_synced_at?: string | null
          lock_time: string
          name: string
          season_year: number
          sport?: string | null
          status?: string | null
          sync_status?: string | null
        }
        Update: {
          created_at?: string
          external_season_id?: string | null
          gender_division?: string | null
          id?: string
          last_synced_at?: string | null
          lock_time?: string
          name?: string
          season_year?: number
          sport?: string | null
          status?: string | null
          sync_status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_bracket_pool_id: { Args: { _bracket_id: string }; Returns: string }
      is_pool_admin: {
        Args: { _pool_id: string; _user_id: string }
        Returns: boolean
      }
      is_pool_member: {
        Args: { _pool_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
