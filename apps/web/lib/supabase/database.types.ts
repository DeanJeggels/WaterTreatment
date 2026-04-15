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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      "10933C43CA48": {
        Row: {
          created_at: string
          eCO2: number | null
          id: number
          TVOC: number | null
        }
        Insert: {
          created_at?: string
          eCO2?: number | null
          id?: number
          TVOC?: number | null
        }
        Update: {
          created_at?: string
          eCO2?: number | null
          id?: number
          TVOC?: number | null
        }
        Relationships: []
      }
      "644D3C43CA48": {
        Row: {
          created_at: string
          eco: number | null
          frequency_khz: number | null
          id: number
          tvoc: number | null
        }
        Insert: {
          created_at?: string
          eco?: number | null
          frequency_khz?: number | null
          id?: number
          tvoc?: number | null
        }
        Update: {
          created_at?: string
          eco?: number | null
          frequency_khz?: number | null
          id?: number
          tvoc?: number | null
        }
        Relationships: []
      }
      boq_line_items: {
        Row: {
          category: string
          created_at: string
          description: string
          flowsheet_id: string
          id: string
          override_reason: string | null
          quantity: number
          source_citation: string
          total_price_zar: number | null
          unit: string
          unit_node_id: string
          unit_price_zar: number
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          flowsheet_id: string
          id?: string
          override_reason?: string | null
          quantity: number
          source_citation: string
          total_price_zar?: number | null
          unit: string
          unit_node_id: string
          unit_price_zar: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          flowsheet_id?: string
          id?: string
          override_reason?: string | null
          quantity?: number
          source_citation?: string
          total_price_zar?: number | null
          unit?: string
          unit_node_id?: string
          unit_price_zar?: number
        }
        Relationships: [
          {
            foreignKeyName: "boq_line_items_flowsheet_id_fkey"
            columns: ["flowsheet_id"]
            isOneToOne: false
            referencedRelation: "flowsheets"
            referencedColumns: ["id"]
          },
        ]
      }
      fdr_event_thresholds: {
        Row: {
          event_type: string
          thresholds: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          event_type: string
          thresholds?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          event_type?: string
          thresholds?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fdr_profiles: {
        Row: {
          branding: Json | null
          company_name: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          status: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          branding?: Json | null
          company_name?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          branding?: Json | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fdr_sessions: {
        Row: {
          aircraft_type: string | null
          analysis_complete: boolean | null
          created_at: string | null
          duration_sec: number | null
          expires_at: string
          frame_def_uploaded: boolean | null
          id: string
          ip_address: string | null
          label: string | null
          last_activity_at: string | null
          parameter_count: number | null
          raw_data_uploaded: boolean | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          aircraft_type?: string | null
          analysis_complete?: boolean | null
          created_at?: string | null
          duration_sec?: number | null
          expires_at?: string
          frame_def_uploaded?: boolean | null
          id?: string
          ip_address?: string | null
          label?: string | null
          last_activity_at?: string | null
          parameter_count?: number | null
          raw_data_uploaded?: boolean | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          aircraft_type?: string | null
          analysis_complete?: boolean | null
          created_at?: string | null
          duration_sec?: number | null
          expires_at?: string
          frame_def_uploaded?: boolean | null
          id?: string
          ip_address?: string | null
          label?: string | null
          last_activity_at?: string | null
          parameter_count?: number | null
          raw_data_uploaded?: boolean | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fdr_subscription_plans: {
        Row: {
          active: boolean | null
          created_at: string | null
          features: Json | null
          id: number
          max_aircraft_types: number
          max_users: number
          name: string
          price_annual_usd: number
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          features?: Json | null
          id?: number
          max_aircraft_types: number
          max_users: number
          name: string
          price_annual_usd: number
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          features?: Json | null
          id?: number
          max_aircraft_types?: number
          max_users?: number
          name?: string
          price_annual_usd?: number
        }
        Relationships: []
      }
      fdr_usage_logs: {
        Row: {
          action_type: string
          created_at: string | null
          error_message: string | null
          event_count: number | null
          file_size_bytes: number | null
          id: number
          parameter_count: number | null
          processing_time_ms: number | null
          session_id: string | null
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          error_message?: string | null
          event_count?: number | null
          file_size_bytes?: number | null
          id?: number
          parameter_count?: number | null
          processing_time_ms?: number | null
          session_id?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          error_message?: string | null
          event_count?: number | null
          file_size_bytes?: number | null
          id?: number
          parameter_count?: number | null
          processing_time_ms?: number | null
          session_id?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fdr_usage_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fdr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      flowsheets: {
        Row: {
          created_at: string | null
          discharge_standards: Json | null
          graph_data: Json
          id: string
          name: string
          project_id: string
          proposal_data: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discharge_standards?: Json | null
          graph_data?: Json
          id?: string
          name?: string
          project_id: string
          proposal_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discharge_standards?: Json | null
          graph_data?: Json
          id?: string
          name?: string
          project_id?: string
          proposal_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flowsheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          org_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          org_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          org_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          subscription_tier: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          subscription_tier?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          subscription_tier?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          company_logo_url: string | null
          created_at: string | null
          designer_title: string | null
          full_name: string | null
          id: string
          role: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_tier: string | null
        }
        Insert: {
          company?: string | null
          company_logo_url?: string | null
          created_at?: string | null
          designer_title?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_tier?: string | null
        }
        Update: {
          company?: string | null
          company_logo_url?: string | null
          created_at?: string | null
          designer_title?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_tier?: string | null
        }
        Relationships: []
      }
      project_proposals: {
        Row: {
          flowsheet_id: string
          generated_at: string
          generated_by: string | null
          id: string
          notes: string | null
          pdf_url: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          flowsheet_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          flowsheet_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_proposals_flowsheet_id_fkey"
            columns: ["flowsheet_id"]
            isOneToOne: false
            referencedRelation: "flowsheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proposals_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          org_id: string | null
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          flowsheet_id: string
          id: string
          is_active: boolean
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          flowsheet_id: string
          id?: string
          is_active?: boolean
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          flowsheet_id?: string
          id?: string
          is_active?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_flowsheet_id_fkey"
            columns: ["flowsheet_id"]
            isOneToOne: false
            referencedRelation: "flowsheets"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          compliance: Json | null
          converged: boolean | null
          flowsheet_id: string
          id: string
          iterations: number | null
          results: Json
          run_at: string | null
          status: string | null
        }
        Insert: {
          compliance?: Json | null
          converged?: boolean | null
          flowsheet_id: string
          id?: string
          iterations?: number | null
          results: Json
          run_at?: string | null
          status?: string | null
        }
        Update: {
          compliance?: Json | null
          converged?: boolean | null
          flowsheet_id?: string
          id?: string
          iterations?: number | null
          results?: Json
          run_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_runs_flowsheet_id_fkey"
            columns: ["flowsheet_id"]
            isOneToOne: false
            referencedRelation: "flowsheets"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          description: string | null
          graph_data: Json
          id: string
          is_public: boolean | null
          name: string
        }
        Insert: {
          category?: string | null
          description?: string | null
          graph_data: Json
          id?: string
          is_public?: boolean | null
          name: string
        }
        Update: {
          category?: string | null
          description?: string | null
          graph_data?: Json
          id?: string
          is_public?: boolean | null
          name?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
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
