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
      activity_feed: {
        Row: {
          actor_user_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      channel_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      channel_read_states: {
        Row: {
          channel_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_read_states_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_default: boolean
          name: string
          position: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          position?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "channel_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_participants: {
        Row: {
          draft_id: string
          id: string
          pick_order: number
          user_id: string
        }
        Insert: {
          draft_id: string
          id?: string
          pick_order: number
          user_id: string
        }
        Update: {
          draft_id?: string
          id?: string
          pick_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_participants_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_pick_disputes: {
        Row: {
          created_at: string
          draft_id: string
          id: string
          pick_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          id?: string
          pick_id: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          id?: string
          pick_id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      draft_picks: {
        Row: {
          draft_id: string
          id: string
          pick_number: number
          pick_text: string
          picked_at: string
          round: number
          user_id: string
        }
        Insert: {
          draft_id: string
          id?: string
          pick_number: number
          pick_text: string
          picked_at?: string
          round: number
          user_id: string
        }
        Update: {
          draft_id?: string
          id?: string
          pick_number?: number
          pick_text?: string
          picked_at?: string
          round?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_playoff_matches: {
        Row: {
          created_at: string
          draft_id: string | null
          id: string
          match_number: number
          round: string
          season_id: string
          seed_a: number
          seed_b: number
          status: string
          topic_picker_user_id: string | null
          updated_at: string
          user_a: string | null
          user_b: string | null
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          draft_id?: string | null
          id?: string
          match_number?: number
          round: string
          season_id: string
          seed_a: number
          seed_b: number
          status?: string
          topic_picker_user_id?: string | null
          updated_at?: string
          user_a?: string | null
          user_b?: string | null
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          draft_id?: string | null
          id?: string
          match_number?: number
          round?: string
          season_id?: string
          seed_a?: number
          seed_b?: number
          status?: string
          topic_picker_user_id?: string | null
          updated_at?: string
          user_a?: string | null
          user_b?: string | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_playoff_matches_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_playoff_matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "draft_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_results: {
        Row: {
          created_at: string
          draft_id: string
          id: string
          pick_ratings: Json
          points_awarded: number
          rank: number
          summary: string | null
          total_score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          id?: string
          pick_ratings?: Json
          points_awarded?: number
          rank: number
          summary?: string | null
          total_score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          id?: string
          pick_ratings?: Json
          points_awarded?: number
          rank?: number
          summary?: string | null
          total_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_results_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_season_entries: {
        Row: {
          created_at: string
          draft_id: string
          id: string
          is_playoff: boolean
          season_id: string
          season_points_awarded: Json
          week_number: number
        }
        Insert: {
          created_at?: string
          draft_id: string
          id?: string
          is_playoff?: boolean
          season_id: string
          season_points_awarded?: Json
          week_number: number
        }
        Update: {
          created_at?: string
          draft_id?: string
          id?: string
          is_playoff?: boolean
          season_id?: string
          season_points_awarded?: Json
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_season_entries_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_season_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "draft_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_season_standings: {
        Row: {
          avg_finish: number
          avg_score: number
          best_score: number
          consistency: number
          drafts_played: number
          id: string
          is_eliminated: boolean
          playoff_seed: number | null
          podiums: number
          rank: number | null
          season_id: string
          season_points: number
          updated_at: string
          user_id: string
          wins: number
          worst_score: number
        }
        Insert: {
          avg_finish?: number
          avg_score?: number
          best_score?: number
          consistency?: number
          drafts_played?: number
          id?: string
          is_eliminated?: boolean
          playoff_seed?: number | null
          podiums?: number
          rank?: number | null
          season_id: string
          season_points?: number
          updated_at?: string
          user_id: string
          wins?: number
          worst_score?: number
        }
        Update: {
          avg_finish?: number
          avg_score?: number
          best_score?: number
          consistency?: number
          drafts_played?: number
          id?: string
          is_eliminated?: boolean
          playoff_seed?: number | null
          podiums?: number
          rank?: number | null
          season_id?: string
          season_points?: number
          updated_at?: string
          user_id?: string
          wins?: number
          worst_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_season_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "draft_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_season_standings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_seasons: {
        Row: {
          best_of: number
          commissioner_user_id: string | null
          created_at: string
          ends_at: string
          id: string
          name: string
          playoff_weeks: number
          regular_season_drafts: number
          regular_season_weeks: number
          season_label: string
          starts_at: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          best_of?: number
          commissioner_user_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          name: string
          playoff_weeks?: number
          regular_season_drafts?: number
          regular_season_weeks?: number
          season_label: string
          starts_at: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          best_of?: number
          commissioner_user_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          playoff_weeks?: number
          regular_season_drafts?: number
          regular_season_weeks?: number
          season_label?: string
          starts_at?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_seasons_commissioner_user_id_fkey"
            columns: ["commissioner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          category: string | null
          competition_id: string
          created_at: string
          created_by: string
          current_pick_number: number
          current_pick_user_id: string | null
          current_round: number
          id: string
          num_rounds: number
          status: string
          timer_seconds: number | null
          topic: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          competition_id: string
          created_at?: string
          created_by: string
          current_pick_number?: number
          current_pick_user_id?: string | null
          current_round?: number
          id?: string
          num_rounds?: number
          status?: string
          timer_seconds?: number | null
          topic: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          competition_id?: string
          created_at?: string
          created_by?: string
          current_pick_number?: number
          current_pick_user_id?: string | null
          current_round?: number
          id?: string
          num_rounds?: number
          status?: string
          timer_seconds?: number | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_current_pick_user_id_fkey"
            columns: ["current_pick_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comments: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          id: string
          linked_poll_id: string | null
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          id?: string
          linked_poll_id?: string | null
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          linked_poll_id?: string | null
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_linked_poll_id_fkey"
            columns: ["linked_poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
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
      invite_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      item_enrichments: {
        Row: {
          category: string | null
          confidence: number | null
          created_at: string
          id: string
          image_url: string | null
          item_id: string
          item_type: string
          matched_name: string | null
          metadata: Json | null
          normalized_name: string | null
          source_provider: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          item_id: string
          item_type?: string
          matched_name?: string | null
          metadata?: Json | null
          normalized_name?: string | null
          source_provider?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          item_id?: string
          item_type?: string
          matched_name?: string | null
          metadata?: Json | null
          normalized_name?: string | null
          source_provider?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lockbox_attempts: {
        Row: {
          attacker_id: string
          id: string
          is_solved: boolean
          lock_id: string
          phase: string
          solved_at: string | null
          started_at: string
          total_attempts: number
          updated_at: string
        }
        Insert: {
          attacker_id: string
          id?: string
          is_solved?: boolean
          lock_id: string
          phase?: string
          solved_at?: string | null
          started_at?: string
          total_attempts?: number
          updated_at?: string
        }
        Update: {
          attacker_id?: string
          id?: string
          is_solved?: boolean
          lock_id?: string
          phase?: string
          solved_at?: string | null
          started_at?: string
          total_attempts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_attempts_attacker_id_fkey"
            columns: ["attacker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_attempts_lock_id_fkey"
            columns: ["lock_id"]
            isOneToOne: false
            referencedRelation: "lockbox_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_guesses: {
        Row: {
          attempt_id: string
          correct_position: number
          correct_value: number
          created_at: string
          guess_value: string
          id: string
          is_correct: boolean
          phase: string
        }
        Insert: {
          attempt_id: string
          correct_position?: number
          correct_value?: number
          created_at?: string
          guess_value: string
          id?: string
          is_correct?: boolean
          phase: string
        }
        Update: {
          attempt_id?: string
          correct_position?: number
          correct_value?: number
          created_at?: string
          guess_value?: string
          id?: string
          is_correct?: boolean
          phase?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_guesses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "lockbox_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_locks: {
        Row: {
          color_code: string
          created_at: string
          id: string
          is_cracked: boolean
          maze_grid: Json | null
          maze_id: number | null
          number_code: string
          user_id: string
          week_id: string
        }
        Insert: {
          color_code: string
          created_at?: string
          id?: string
          is_cracked?: boolean
          maze_grid?: Json | null
          maze_id?: number | null
          number_code: string
          user_id: string
          week_id: string
        }
        Update: {
          color_code?: string
          created_at?: string
          id?: string
          is_cracked?: boolean
          maze_grid?: Json | null
          maze_id?: number | null
          number_code?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_locks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_locks_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "lockbox_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_scores: {
        Row: {
          crack_points: number
          created_at: string
          defense_points: number
          id: string
          rank: number | null
          total_points: number
          user_id: string
          week_id: string
        }
        Insert: {
          crack_points?: number
          created_at?: string
          defense_points?: number
          id?: string
          rank?: number | null
          total_points?: number
          user_id: string
          week_id: string
        }
        Update: {
          crack_points?: number
          created_at?: string
          defense_points?: number
          id?: string
          rank?: number | null
          total_points?: number
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_scores_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "lockbox_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_weeks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          status: string
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          status?: string
          week_number: number
          year: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          week_number?: number
          year?: number
        }
        Relationships: []
      }
      lore_contributions: {
        Row: {
          content: string
          created_at: string
          id: string
          lore_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lore_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lore_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_contributions_lore_id_fkey"
            columns: ["lore_id"]
            isOneToOne: false
            referencedRelation: "lore_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lore_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lore_entries: {
        Row: {
          context: string
          created_at: string
          created_by: string
          era: string | null
          id: string
          image_url: string | null
          people_involved: string[] | null
          source_message_id: string | null
          status: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          context: string
          created_at?: string
          created_by: string
          era?: string | null
          id?: string
          image_url?: string | null
          people_involved?: string[] | null
          source_message_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          context?: string
          created_at?: string
          created_by?: string
          era?: string | null
          id?: string
          image_url?: string | null
          people_involved?: string[] | null
          source_message_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lore_reactions: {
        Row: {
          created_at: string
          id: string
          lore_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lore_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lore_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_reactions_lore_id_fkey"
            columns: ["lore_id"]
            isOneToOne: false
            referencedRelation: "lore_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lore_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_link_previews: {
        Row: {
          content_type: string
          created_at: string
          description: string | null
          embed_id: string | null
          embed_type: string | null
          fetched_at: string | null
          id: string
          image_url: string | null
          message_id: string
          site_name: string | null
          title: string | null
          url: string
        }
        Insert: {
          content_type?: string
          created_at?: string
          description?: string | null
          embed_id?: string | null
          embed_type?: string | null
          fetched_at?: string | null
          id?: string
          image_url?: string | null
          message_id: string
          site_name?: string | null
          title?: string | null
          url: string
        }
        Update: {
          content_type?: string
          created_at?: string
          description?: string | null
          embed_id?: string | null
          embed_type?: string | null
          fetched_at?: string | null
          id?: string
          image_url?: string | null
          message_id?: string
          site_name?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_link_previews_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_pinned: boolean
          parent_message_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          parent_message_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          parent_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_games: {
        Row: {
          away_score: number | null
          away_team_id: string
          created_at: string
          external_id: string | null
          external_provider: string | null
          home_score: number | null
          home_team_id: string
          id: string
          kickoff_at: string
          season_id: string
          status: string
          updated_at: string
          week_id: string
          winner_team_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          home_score?: number | null
          home_team_id: string
          id?: string
          kickoff_at: string
          season_id: string
          status?: string
          updated_at?: string
          week_id: string
          winner_team_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          kickoff_at?: string
          season_id?: string
          status?: string
          updated_at?: string
          week_id?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfl_games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "nfl_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "nfl_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_games_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_games_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "nfl_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "nfl_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_picks: {
        Row: {
          created_at: string
          game_id: string
          id: string
          is_correct: boolean | null
          picked_team_id: string
          points_awarded: number
          season_id: string
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          is_correct?: boolean | null
          picked_team_id: string
          points_awarded?: number
          season_id: string
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          is_correct?: boolean | null
          picked_team_id?: string
          points_awarded?: number
          season_id?: string
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfl_picks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "nfl_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_picks_picked_team_id_fkey"
            columns: ["picked_team_id"]
            isOneToOne: false
            referencedRelation: "nfl_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_picks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_picks_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "nfl_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_season_standings: {
        Row: {
          accuracy: number
          avg_weekly_rank: number | null
          id: string
          rank: number | null
          season_id: string
          total_correct: number
          total_picked: number
          updated_at: string
          user_id: string
          weekly_wins: number
        }
        Insert: {
          accuracy?: number
          avg_weekly_rank?: number | null
          id?: string
          rank?: number | null
          season_id: string
          total_correct?: number
          total_picked?: number
          updated_at?: string
          user_id: string
          weekly_wins?: number
        }
        Update: {
          accuracy?: number
          avg_weekly_rank?: number | null
          id?: string
          rank?: number | null
          season_id?: string
          total_correct?: number
          total_picked?: number
          updated_at?: string
          user_id?: string
          weekly_wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfl_season_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_seasons: {
        Row: {
          created_at: string
          current_week: number
          ends_at: string
          id: string
          name: string
          starts_at: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          current_week?: number
          ends_at: string
          id?: string
          name: string
          starts_at: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          current_week?: number
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      nfl_teams: {
        Row: {
          abbr: string
          city: string
          conference: string
          created_at: string
          division: string
          external_id: string | null
          external_provider: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
        }
        Insert: {
          abbr: string
          city: string
          conference: string
          created_at?: string
          division: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
        }
        Update: {
          abbr?: string
          city?: string
          conference?: string
          created_at?: string
          division?: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
        }
        Relationships: []
      }
      nfl_tiebreakers: {
        Row: {
          actual_total: number | null
          created_at: string
          delta: number | null
          id: string
          predicted_total: number
          season_id: string
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          actual_total?: number | null
          created_at?: string
          delta?: number | null
          id?: string
          predicted_total: number
          season_id: string
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          actual_total?: number | null
          created_at?: string
          delta?: number | null
          id?: string
          predicted_total?: number
          season_id?: string
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfl_tiebreakers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_tiebreakers_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "nfl_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_weekly_standings: {
        Row: {
          accuracy: number
          correct_picks: number
          id: string
          rank: number | null
          season_id: string
          tiebreak_delta: number | null
          total_picks: number
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          accuracy?: number
          correct_picks?: number
          id?: string
          rank?: number | null
          season_id: string
          tiebreak_delta?: number | null
          total_picks?: number
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          accuracy?: number
          correct_picks?: number
          id?: string
          rank?: number | null
          season_id?: string
          tiebreak_delta?: number | null
          total_picks?: number
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfl_weekly_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_weekly_standings_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "nfl_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_weeks: {
        Row: {
          created_at: string
          ends_at: string
          featured_game_id: string | null
          id: string
          label: string
          season_id: string
          starts_at: string
          status: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          featured_game_id?: string | null
          id?: string
          label: string
          season_id: string
          starts_at: string
          status?: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          featured_game_id?: string | null
          id?: string
          label?: string
          season_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfl_weeks_featured_game_fk"
            columns: ["featured_game_id"]
            isOneToOne: false
            referencedRelation: "nfl_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_weeks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          chat_messages: boolean
          created_at: string
          drafts: boolean
          events: boolean
          id: string
          lockbox: boolean
          mentions: boolean
          polls: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_messages?: boolean
          created_at?: string
          drafts?: boolean
          events?: boolean
          id?: string
          lockbox?: boolean
          mentions?: boolean
          polls?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_messages?: boolean
          created_at?: string
          drafts?: boolean
          events?: boolean
          id?: string
          lockbox?: boolean
          mentions?: boolean
          polls?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          position: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          position?: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closes_at: string | null
          competition_id: string
          created_at: string
          created_by: string
          id: string
          poll_type: string
          question: string
          status: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          competition_id: string
          created_at?: string
          created_by: string
          id?: string
          poll_type?: string
          question: string
          status?: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          competition_id?: string
          created_at?: string
          created_by?: string
          id?: string
          poll_type?: string
          question?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          allow_late_entries: boolean
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
          allow_late_entries?: boolean
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
          allow_late_entries?: boolean
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
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_comment_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          channel_id: string | null
          comments_count: number
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          reactions_count: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reactions_count?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reactions_count?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      push_throttle: {
        Row: {
          channel_id: string
          last_sent_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_sent_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ranking_items: {
        Row: {
          id: string
          image_url: string | null
          label: string
          position: number
          ranking_id: string
        }
        Insert: {
          id?: string
          image_url?: string | null
          label: string
          position?: number
          ranking_id: string
        }
        Update: {
          id?: string
          image_url?: string | null
          label?: string
          position?: number
          ranking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_items_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "rankings"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_submission_entries: {
        Row: {
          id: string
          item_id: string
          rank: number
          submission_id: string
        }
        Insert: {
          id?: string
          item_id: string
          rank: number
          submission_id: string
        }
        Update: {
          id?: string
          item_id?: string
          rank?: number
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_submission_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "ranking_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_submission_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "ranking_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_submissions: {
        Row: {
          id: string
          ranking_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          id?: string
          ranking_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          id?: string
          ranking_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_submissions_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "rankings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rankings: {
        Row: {
          category: string | null
          competition_id: string
          created_at: string
          created_by: string
          id: string
          item_count: number
          status: string
          topic: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          competition_id: string
          created_at?: string
          created_by: string
          id?: string
          item_count?: number
          status?: string
          topic: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          competition_id?: string
          created_at?: string
          created_by?: string
          id?: string
          item_count?: number
          status?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rankings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_bestiary: {
        Row: {
          archetype_id: string
          created_at: string
          defeat_count: number
          first_defeated_at: string
          highest_level_defeated: number
          id: string
          last_defeated_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype_id: string
          created_at?: string
          defeat_count?: number
          first_defeated_at?: string
          highest_level_defeated?: number
          id?: string
          last_defeated_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype_id?: string
          created_at?: string
          defeat_count?: number
          first_defeated_at?: string
          highest_level_defeated?: number
          id?: string
          last_defeated_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rune_delve_class_progress: {
        Row: {
          class: string
          cosmetic_title: string | null
          created_at: string
          id: string
          level: number
          lifetime_runs: number
          lifetime_score: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          class: string
          cosmetic_title?: string | null
          created_at?: string
          id?: string
          level?: number
          lifetime_runs?: number
          lifetime_score?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          class?: string
          cosmetic_title?: string | null
          created_at?: string
          id?: string
          level?: number
          lifetime_runs?: number
          lifetime_score?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      rune_delve_dungeons: {
        Row: {
          created_at: string
          enemy_config: Json
          id: string
          max_turns: number
          run_date: string
          seed: number
        }
        Insert: {
          created_at?: string
          enemy_config?: Json
          id?: string
          max_turns?: number
          run_date: string
          seed: number
        }
        Update: {
          created_at?: string
          enemy_config?: Json
          id?: string
          max_turns?: number
          run_date?: string
          seed?: number
        }
        Relationships: []
      }
      rune_delve_failure_rewards: {
        Row: {
          failure_count: number
          id: string
          last_awarded_at: string
          level_number: number
          user_id: string
        }
        Insert: {
          failure_count?: number
          id?: string
          last_awarded_at?: string
          level_number: number
          user_id: string
        }
        Update: {
          failure_count?: number
          id?: string
          last_awarded_at?: string
          level_number?: number
          user_id?: string
        }
        Relationships: []
      }
      rune_delve_heroes: {
        Row: {
          best_streak: number
          class: string
          cosmetic_title: string | null
          created_at: string
          current_streak: number
          hero_name: string
          id: string
          last_run_date: string | null
          level: number
          lifetime_runs: number
          lifetime_score: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          best_streak?: number
          class?: string
          cosmetic_title?: string | null
          created_at?: string
          current_streak?: number
          hero_name?: string
          id?: string
          last_run_date?: string | null
          level?: number
          lifetime_runs?: number
          lifetime_score?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          best_streak?: number
          class?: string
          cosmetic_title?: string | null
          created_at?: string
          current_streak?: number
          hero_name?: string
          id?: string
          last_run_date?: string | null
          level?: number
          lifetime_runs?: number
          lifetime_score?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      rune_delve_levels: {
        Row: {
          board_size: number
          chapter: number
          created_at: string
          difficulty_tier: number
          enemy_config: Json
          generation_seed: number
          id: string
          level_number: number
          metadata: Json
          modifiers: Json
          objective_target: number
          objective_type: string
          starting_board_layout: Json | null
          status: string
          turn_limit: number
          updated_at: string
        }
        Insert: {
          board_size?: number
          chapter?: number
          created_at?: string
          difficulty_tier?: number
          enemy_config?: Json
          generation_seed: number
          id?: string
          level_number: number
          metadata?: Json
          modifiers?: Json
          objective_target?: number
          objective_type?: string
          starting_board_layout?: Json | null
          status?: string
          turn_limit?: number
          updated_at?: string
        }
        Update: {
          board_size?: number
          chapter?: number
          created_at?: string
          difficulty_tier?: number
          enemy_config?: Json
          generation_seed?: number
          id?: string
          level_number?: number
          metadata?: Json
          modifiers?: Json
          objective_target?: number
          objective_type?: string
          starting_board_layout?: Json | null
          status?: string
          turn_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      rune_delve_loadouts: {
        Row: {
          class: string
          id: string
          slot_1: string | null
          slot_2: string | null
          slot_3: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          class: string
          id?: string
          slot_1?: string | null
          slot_2?: string | null
          slot_3?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          class?: string
          id?: string
          slot_1?: string | null
          slot_2?: string | null
          slot_3?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rune_delve_progress: {
        Row: {
          created_at: string
          current_chapter: number
          highest_completed_level: number
          highest_unlocked_level: number
          id: string
          total_levels_cleared: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_chapter?: number
          highest_completed_level?: number
          highest_unlocked_level?: number
          id?: string
          total_levels_cleared?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_chapter?: number
          highest_completed_level?: number
          highest_unlocked_level?: number
          id?: string
          total_levels_cleared?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rune_delve_relic_unlocks: {
        Row: {
          acquired_at: string
          acquired_at_level: number
          id: string
          rank: number
          relic_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          acquired_at_level?: number
          id?: string
          rank?: number
          relic_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          acquired_at_level?: number
          id?: string
          rank?: number
          relic_id?: string
          user_id?: string
        }
        Relationships: []
      }
      rune_delve_runs: {
        Row: {
          ability_used: boolean
          attempts: number
          best_hp_remaining: number
          best_turns_used: number | null
          clears: number
          completed_at: string
          created_at: string
          dungeon_cleared: boolean
          dungeon_id: string | null
          enemies_defeated: number
          hero_class: string
          hp_remaining: number
          id: string
          last_played_at: string
          level_id: string | null
          level_number: number | null
          longest_chain: number
          pick_log: Json
          run_date: string | null
          score: number
          total_damage: number
          turns_used: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          ability_used?: boolean
          attempts?: number
          best_hp_remaining?: number
          best_turns_used?: number | null
          clears?: number
          completed_at?: string
          created_at?: string
          dungeon_cleared?: boolean
          dungeon_id?: string | null
          enemies_defeated?: number
          hero_class: string
          hp_remaining?: number
          id?: string
          last_played_at?: string
          level_id?: string | null
          level_number?: number | null
          longest_chain?: number
          pick_log?: Json
          run_date?: string | null
          score?: number
          total_damage?: number
          turns_used?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          ability_used?: boolean
          attempts?: number
          best_hp_remaining?: number
          best_turns_used?: number | null
          clears?: number
          completed_at?: string
          created_at?: string
          dungeon_cleared?: boolean
          dungeon_id?: string | null
          enemies_defeated?: number
          hero_class?: string
          hp_remaining?: number
          id?: string
          last_played_at?: string
          level_id?: string | null
          level_number?: number | null
          longest_chain?: number
          pick_log?: Json
          run_date?: string | null
          score?: number
          total_damage?: number
          turns_used?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_runs_dungeon_id_fkey"
            columns: ["dungeon_id"]
            isOneToOne: false
            referencedRelation: "rune_delve_dungeons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rune_delve_runs_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "rune_delve_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_wallet: {
        Row: {
          created_at: string
          lifetime_shards_earned: number
          shards: number
          slots_unlocked: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lifetime_shards_earned?: number
          shards?: number
          slots_unlocked?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          lifetime_shards_earned?: number
          shards?: number
          slots_unlocked?: number
          updated_at?: string
          user_id?: string
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
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_bracket_pool_id: { Args: { _bracket_id: string }; Returns: string }
      is_app_admin: { Args: { _user_id: string }; Returns: boolean }
      is_pick_unlocked: { Args: { _game_id: string }; Returns: boolean }
      is_pool_admin: {
        Args: { _pool_id: string; _user_id: string }
        Returns: boolean
      }
      is_pool_member: {
        Args: { _pool_id: string; _user_id: string }
        Returns: boolean
      }
      recompute_nfl_week_status: {
        Args: { _week_id: string }
        Returns: undefined
      }
      toggle_message_pin: { Args: { p_message_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
