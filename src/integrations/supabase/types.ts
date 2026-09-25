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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          group_id: string | null
          id: string
          ip_address: unknown
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          group_id?: string | null
          id?: string
          ip_address?: unknown
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          group_id?: string | null
          id?: string
          ip_address?: unknown
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_selections: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          group_id: string
          id: string
          member_id: string
          nomination_count: number
          position_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["candidate_status"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          member_id: string
          nomination_count?: number
          position_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          member_id?: string
          nomination_count?: number
          position_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_selections_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_selections_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_selections_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      election_cycles: {
        Row: {
          allow_vote_editing: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          group_id: string
          id: string
          is_adhoc: boolean
          nomination_end: string | null
          nomination_start: string | null
          status: Database["public"]["Enums"]["election_status"]
          title: string
          updated_at: string
          voting_end: string | null
          voting_start: string | null
        }
        Insert: {
          allow_vote_editing?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id: string
          id?: string
          is_adhoc?: boolean
          nomination_end?: string | null
          nomination_start?: string | null
          status?: Database["public"]["Enums"]["election_status"]
          title: string
          updated_at?: string
          voting_end?: string | null
          voting_start?: string | null
        }
        Update: {
          allow_vote_editing?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id?: string
          id?: string
          is_adhoc?: boolean
          nomination_end?: string | null
          nomination_start?: string | null
          status?: Database["public"]["Enums"]["election_status"]
          title?: string
          updated_at?: string
          voting_end?: string | null
          voting_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "election_cycles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_admins: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_admins_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_settings: {
        Row: {
          allow_vote_editing: boolean
          created_at: string
          election_timezone: string
          group_id: string
          id: string
          notification_preferences: Json | null
          require_result_review: boolean
          updated_at: string
        }
        Insert: {
          allow_vote_editing?: boolean
          created_at?: string
          election_timezone?: string
          group_id: string
          id?: string
          notification_preferences?: Json | null
          require_result_review?: boolean
          updated_at?: string
        }
        Update: {
          allow_vote_editing?: boolean
          created_at?: string
          election_timezone?: string
          group_id?: string
          id?: string
          notification_preferences?: Json | null
          require_result_review?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          registration_fee_paid: boolean
          slug: string | null
          status: Database["public"]["Enums"]["group_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          registration_fee_paid?: boolean
          slug?: string | null
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          registration_fee_paid?: boolean
          slug?: string | null
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          group_id: string
          id: string
          invited_by: string | null
          role: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          group_id: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          group_id?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string | null
          group_id: string
          id: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string | null
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string | null
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      nominations: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          group_id: string
          id: string
          is_valid: boolean
          nominated_by_member_id: string
          nominee_member_id: string
          position_id: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          is_valid?: boolean
          nominated_by_member_id: string
          nominee_member_id: string
          position_id: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          is_valid?: boolean
          nominated_by_member_id?: string
          nominee_member_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nominations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nominations_nominated_by_member_id_fkey"
            columns: ["nominated_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nominations_nominee_member_id_fkey"
            columns: ["nominee_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nominations_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          group_id: string
          id: string
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          type: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          group_id: string
          id?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          type: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          group_id?: string
          id?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          election_cycle_id: string
          group_id: string
          id: string
          is_active: boolean
          max_candidates: number
          max_winners: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          election_cycle_id: string
          group_id: string
          id?: string
          is_active?: boolean
          max_candidates?: number
          max_winners?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          election_cycle_id?: string
          group_id?: string
          id?: string
          is_active?: boolean
          max_candidates?: number
          max_winners?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_election_cycle_id_fkey"
            columns: ["election_cycle_id"]
            isOneToOne: false
            referencedRelation: "election_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      result_publications: {
        Row: {
          election_cycle_id: string
          email_sent: boolean
          email_sent_at: string | null
          group_id: string
          id: string
          published_at: string
          published_by: string | null
        }
        Insert: {
          election_cycle_id: string
          email_sent?: boolean
          email_sent_at?: string | null
          group_id: string
          id?: string
          published_at?: string
          published_by?: string | null
        }
        Update: {
          election_cycle_id?: string
          email_sent?: boolean
          email_sent_at?: string | null
          group_id?: string
          id?: string
          published_at?: string
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "result_publications_election_cycle_id_fkey"
            columns: ["election_cycle_id"]
            isOneToOne: false
            referencedRelation: "election_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_publications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      result_summaries: {
        Row: {
          candidate_id: string
          created_at: string
          election_cycle_id: string
          group_id: string
          id: string
          is_winner: boolean
          position_id: string
          rank: number | null
          vote_count: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          election_cycle_id: string
          group_id: string
          id?: string
          is_winner?: boolean
          position_id: string
          rank?: number | null
          vote_count?: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          election_cycle_id?: string
          group_id?: string
          id?: string
          is_winner?: boolean
          position_id?: string
          rank?: number | null
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "result_summaries_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_selections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_summaries_election_cycle_id_fkey"
            columns: ["election_cycle_id"]
            isOneToOne: false
            referencedRelation: "election_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_summaries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_summaries_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          currency: string
          id: string
          interval: string
          is_active: boolean
          name: string
          price_cents: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          interval: string
          is_active?: boolean
          name: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          interval?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          group_id: string
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          group_id: string
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          group_id?: string
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voter_codes: {
        Row: {
          code: string
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          member_id: string
        }
        Insert: {
          code: string
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          member_id: string
        }
        Update: {
          code?: string
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voter_codes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voter_codes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          candidate_id: string
          cast_at: string
          election_cycle_id: string
          group_id: string
          id: string
          is_latest: boolean
          member_id: string
          position_id: string
        }
        Insert: {
          candidate_id: string
          cast_at?: string
          election_cycle_id: string
          group_id: string
          id?: string
          is_latest?: boolean
          member_id: string
          position_id: string
        }
        Update: {
          candidate_id?: string
          cast_at?: string
          election_cycle_id?: string
          group_id?: string
          id?: string
          is_latest?: boolean
          member_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_selections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_election_cycle_id_fkey"
            columns: ["election_cycle_id"]
            isOneToOne: false
            referencedRelation: "election_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_election: {
        Args: {
          p_election_id: string
          p_expected_status: Database["public"]["Enums"]["election_status"]
        }
        Returns: Database["public"]["Enums"]["election_status"]
      }
      cast_vote: {
        Args: { p_candidate_id: string; p_position_id: string }
        Returns: undefined
      }
      create_organisation: { Args: never; Returns: string }
      get_my_ballot: {
        Args: { p_election_id: string }
        Returns: {
          candidate_id: string
          cast_at: string
          position_id: string
        }[]
      }
      get_turnout: {
        Args: { p_election_id: string }
        Returns: {
          eligible: number
          position_id: string
          voters: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_draft_election_of_group: {
        Args: { _election_id: string; _group_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      respond_to_candidacy: {
        Args: { p_accept: boolean; p_candidate_id: string }
        Returns: undefined
      }
      submit_nomination: {
        Args: { p_nominee_member_id: string; p_position_id: string }
        Returns: string
      }
      vote_editing_allowed: {
        Args: { p_election_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "global_admin" | "group_admin" | "member"
      candidate_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "qualified"
      election_status:
        | "draft"
        | "nominations_open"
        | "nominations_closed"
        | "candidate_review"
        | "candidate_acceptance"
        | "ready_for_voting"
        | "voting_open"
        | "voting_closed"
        | "result_review"
        | "published"
        | "cancelled"
      group_status:
        | "pending_payment"
        | "active"
        | "suspended"
        | "closed"
        | "terminated"
      invitation_status: "pending" | "accepted" | "expired" | "cancelled"
      member_status: "invited" | "active" | "inactive" | "suspended"
      subscription_status:
        | "pending"
        | "active"
        | "past_due"
        | "expired"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["global_admin", "group_admin", "member"],
      candidate_status: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "qualified",
      ],
      election_status: [
        "draft",
        "nominations_open",
        "nominations_closed",
        "candidate_review",
        "candidate_acceptance",
        "ready_for_voting",
        "voting_open",
        "voting_closed",
        "result_review",
        "published",
        "cancelled",
      ],
      group_status: [
        "pending_payment",
        "active",
        "suspended",
        "closed",
        "terminated",
      ],
      invitation_status: ["pending", "accepted", "expired", "cancelled"],
      member_status: ["invited", "active", "inactive", "suspended"],
      subscription_status: [
        "pending",
        "active",
        "past_due",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
