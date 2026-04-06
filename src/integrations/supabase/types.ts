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
      accounts: {
        Row: {
          account_name: string
          account_name_sf: string | null
          assigned_to: string | null
          brand: string | null
          competitor: string[] | null
          country: string
          created_at: string
          customer_status: string
          domain_key: string | null
          ec_link: string | null
          id: string
          industry: string
          martech_stack: string[] | null
          meeting_stage: string
          meeting_status: string
          metadata: Json | null
          mtu: number | null
          notes: string | null
          org_id: string
          platform: string | null
          pv_k: number | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_name_sf?: string | null
          assigned_to?: string | null
          brand?: string | null
          competitor?: string[] | null
          country?: string
          created_at?: string
          customer_status?: string
          domain_key?: string | null
          ec_link?: string | null
          id?: string
          industry?: string
          martech_stack?: string[] | null
          meeting_stage?: string
          meeting_status?: string
          metadata?: Json | null
          mtu?: number | null
          notes?: string | null
          org_id: string
          platform?: string | null
          pv_k?: number | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_name_sf?: string | null
          assigned_to?: string | null
          brand?: string | null
          competitor?: string[] | null
          country?: string
          created_at?: string
          customer_status?: string
          domain_key?: string | null
          ec_link?: string | null
          id?: string
          industry?: string
          martech_stack?: string[] | null
          meeting_stage?: string
          meeting_status?: string
          metadata?: Json | null
          mtu?: number | null
          notes?: string | null
          org_id?: string
          platform?: string | null
          pv_k?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          account_id: string | null
          call_result: Database["public"]["Enums"]["call_result"]
          called_at: string
          called_by: string
          created_at: string
          id: string
          lead_id: string
          note: string | null
          org_id: string
        }
        Insert: {
          account_id?: string | null
          call_result?: Database["public"]["Enums"]["call_result"]
          called_at?: string
          called_by: string
          created_at?: string
          id?: string
          lead_id: string
          note?: string | null
          org_id: string
        }
        Update: {
          account_id?: string | null
          call_result?: Database["public"]["Enums"]["call_result"]
          called_at?: string
          called_by?: string
          created_at?: string
          id?: string
          lead_id?: string
          note?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_sections: {
        Row: {
          content: Json
          created_at: string
          id: string
          org_id: string
          section_type: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          org_id: string
          section_type?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          org_id?: string
          section_type?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homepage_sections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          account_id: string | null
          bounce_note: string | null
          created_at: string
          email: string | null
          email_status: string | null
          first_name: string
          id: string
          is_foreigner: boolean
          is_manager: boolean
          last_name: string
          lead_source_status: string | null
          linkedin_engaged: boolean
          linkedin_messaged_at: string | null
          linkedin_url: string | null
          note: string | null
          org_id: string
          phone: string | null
          pic: string | null
          priority: string
          tags: string[] | null
          title: string | null
          updated_at: string
          yamm_last_sent: string | null
          yamm_status: string
        }
        Insert: {
          account_id?: string | null
          bounce_note?: string | null
          created_at?: string
          email?: string | null
          email_status?: string | null
          first_name: string
          id?: string
          is_foreigner?: boolean
          is_manager?: boolean
          last_name: string
          lead_source_status?: string | null
          linkedin_engaged?: boolean
          linkedin_messaged_at?: string | null
          linkedin_url?: string | null
          note?: string | null
          org_id: string
          phone?: string | null
          pic?: string | null
          priority?: string
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          yamm_last_sent?: string | null
          yamm_status?: string
        }
        Update: {
          account_id?: string | null
          bounce_note?: string | null
          created_at?: string
          email?: string | null
          email_status?: string | null
          first_name?: string
          id?: string
          is_foreigner?: boolean
          is_manager?: boolean
          last_name?: string
          lead_source_status?: string | null
          linkedin_engaged?: boolean
          linkedin_messaged_at?: string | null
          linkedin_url?: string | null
          note?: string | null
          org_id?: string
          phone?: string | null
          pic?: string | null
          priority?: string
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          yamm_last_sent?: string | null
          yamm_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          industry_focus: string | null
          joined_at: string
          org_id: string
          region: string | null
          role: Database["public"]["Enums"]["app_role"]
          supervisor_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          industry_focus?: string | null
          joined_at?: string
          org_id: string
          region?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          supervisor_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          industry_focus?: string | null
          joined_at?: string
          org_id?: string
          region?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          supervisor_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_org_id: string | null
          full_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_org_id?: string | null
          full_name?: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_org_id?: string | null
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_org_id_fkey"
            columns: ["current_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_results: {
        Row: {
          company_name: string
          created_at: string
          description: string | null
          extra_data: Json | null
          id: string
          imported_account_id: string | null
          industry: string | null
          org_id: string
          query_industry: string | null
          query_region: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          description?: string | null
          extra_data?: Json | null
          id?: string
          imported_account_id?: string | null
          industry?: string | null
          org_id: string
          query_industry?: string | null
          query_region?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string | null
          extra_data?: Json | null
          id?: string
          imported_account_id?: string | null
          industry?: string | null
          org_id?: string
          query_industry?: string | null
          query_region?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_results_imported_account_id_fkey"
            columns: ["imported_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_with_member: {
        Args: { _logo_url?: string; _name: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sales_manager" | "sales_rep" | "partner"
      call_result: "未接" | "已接" | "有效通話"
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
      app_role: ["admin", "sales_manager", "sales_rep", "partner"],
      call_result: ["未接", "已接", "有效通話"],
    },
  },
} as const
