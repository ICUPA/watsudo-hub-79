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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      drivers: {
        Row: {
          created_at: string
          driver_features: Json | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          location: Json | null
          rating: number | null
          total_trips: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          driver_features?: Json | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location?: Json | null
          rating?: number | null
          total_trips?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          driver_features?: Json | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location?: Json | null
          rating?: number | null
          total_trips?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      insurance_addons: {
        Row: {
          description: string | null
          id: number
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          description?: string | null
          id?: number
          is_active?: boolean
          name: string
          price: number
        }
        Update: {
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      insurance_periods: {
        Row: {
          id: number
          label: string
          months: number
          multiplier: number
        }
        Insert: {
          id?: number
          label: string
          months: number
          multiplier?: number
        }
        Update: {
          id?: number
          label?: string
          months?: number
          multiplier?: number
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          created_at: string
          end_date: string
          id: string
          policy_document_url: string | null
          policy_number: string | null
          premium_amount: number
          quote_id: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          policy_document_url?: string | null
          policy_number?: string | null
          premium_amount: number
          quote_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          policy_document_url?: string | null
          policy_number?: string | null
          premium_amount?: number
          quote_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "insurance_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_quotes: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          quote_data: Json
          status: string
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          quote_data: Json
          status?: string
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          quote_data?: Json
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_quotes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          description: string | null
          id: number
          installments: number
          name: string
        }
        Insert: {
          description?: string | null
          id?: number
          installments: number
          name: string
        }
        Update: {
          description?: string | null
          id?: number
          installments?: number
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_momo_code: string | null
          default_momo_phone: string | null
          id: string
          locale: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
          wa_name: string | null
          wa_phone: string
        }
        Insert: {
          created_at?: string
          default_momo_code?: string | null
          default_momo_phone?: string | null
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
          wa_name?: string | null
          wa_phone: string
        }
        Update: {
          created_at?: string
          default_momo_code?: string | null
          default_momo_phone?: string | null
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
          wa_name?: string | null
          wa_phone?: string
        }
        Relationships: []
      }
      qr_generations: {
        Row: {
          amount: number | null
          created_at: string
          file_path: string
          id: string
          profile_id: string | null
          user_id: string
          ussd: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          file_path: string
          id?: string
          profile_id?: string | null
          user_id: string
          ussd: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          file_path?: string
          id?: string
          profile_id?: string | null
          user_id?: string
          ussd?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_generations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          created_at: string
          driver_user_id: string | null
          dropoff: Json | null
          id: string
          meta: Json | null
          passenger_user_id: string
          pickup: Json | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_user_id?: string | null
          dropoff?: Json | null
          id?: string
          meta?: Json | null
          passenger_user_id: string
          pickup?: Json | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_user_id?: string | null
          dropoff?: Json | null
          id?: string
          meta?: Json | null
          passenger_user_id?: string
          pickup?: Json | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_types: {
        Row: {
          code: string
          id: number
          label: string
        }
        Insert: {
          code: string
          id?: number
          label: string
        }
        Update: {
          code?: string
          id?: number
          label?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          doc_url: string | null
          extra: Json | null
          id: string
          insurance_expiry: string | null
          insurance_policy: string | null
          insurance_provider: string | null
          make: string | null
          model: string | null
          model_year: number | null
          plate: string | null
          updated_at: string
          usage_type: string
          user_id: string
          verified: boolean
          vin: string | null
        }
        Insert: {
          created_at?: string
          doc_url?: string | null
          extra?: Json | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy?: string | null
          insurance_provider?: string | null
          make?: string | null
          model?: string | null
          model_year?: number | null
          plate?: string | null
          updated_at?: string
          usage_type: string
          user_id: string
          verified?: boolean
          vin?: string | null
        }
        Update: {
          created_at?: string
          doc_url?: string | null
          extra?: Json | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy?: string | null
          insurance_provider?: string | null
          make?: string | null
          model?: string | null
          model_year?: number | null
          plate?: string | null
          updated_at?: string
          usage_type?: string
          user_id?: string
          verified?: boolean
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_usage_type_fkey"
            columns: ["usage_type"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["code"]
          },
        ]
      }
      whatsapp_logs: {
        Row: {
          created_at: string
          direction: string
          id: string
          message_content: string | null
          message_type: string
          metadata: Json | null
          phone_number: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          message_content?: string | null
          message_type: string
          metadata?: Json | null
          phone_number: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          message_content?: string | null
          message_type?: string
          metadata?: Json | null
          phone_number?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      ride_status:
        | "pending"
        | "confirmed"
        | "rejected"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_role: "user" | "admin" | "driver"
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
      ride_status: [
        "pending",
        "confirmed",
        "rejected",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_role: ["user", "admin", "driver"],
    },
  },
} as const
