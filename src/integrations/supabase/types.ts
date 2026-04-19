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
      access_keys: {
        Row: {
          activated_at: string | null
          created_at: string
          device: string | null
          device_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          is_master: boolean
          key: string
          note: string | null
          revoked: boolean
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          device?: string | null
          device_id?: string | null
          duration_days?: number
          expires_at?: string | null
          id?: string
          is_master?: boolean
          key: string
          note?: string | null
          revoked?: boolean
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          device?: string | null
          device_id?: string | null
          duration_days?: number
          expires_at?: string | null
          id?: string
          is_master?: boolean
          key?: string
          note?: string | null
          revoked?: boolean
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      key_settings: {
        Row: {
          key_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          key_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          key_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_settings_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: true
            referencedRelation: "access_keys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _cfg_bool: { Args: { _k: string }; Returns: boolean }
      _cfg_text: { Args: { _k: string }; Returns: string }
      _check_admin: { Args: { _password: string }; Returns: boolean }
      _gen_key: { Args: never; Returns: string }
      _require_admin: { Args: { _password: string }; Returns: undefined }
      admin_activate_key: {
        Args: { _id: string; _password: string }
        Returns: {
          activated_at: string | null
          created_at: string
          device: string | null
          device_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          is_master: boolean
          key: string
          note: string | null
          revoked: boolean
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_keys: {
        Args: {
          _count: number
          _duration_days: number
          _note: string
          _password: string
        }
        Returns: Json
      }
      admin_delete_key: {
        Args: { _id: string; _password: string }
        Returns: boolean
      }
      admin_device_stats: { Args: { _password: string }; Returns: Json }
      admin_extend_key: {
        Args: { _days: number; _id: string; _password: string }
        Returns: {
          activated_at: string | null
          created_at: string
          device: string | null
          device_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          is_master: boolean
          key: string
          note: string | null
          revoked: boolean
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_keys: {
        Args: { _password: string }
        Returns: {
          activated_at: string | null
          created_at: string
          device: string | null
          device_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          is_master: boolean
          key: string
          note: string | null
          revoked: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_reset_device: {
        Args: { _id: string; _password: string }
        Returns: {
          activated_at: string | null
          created_at: string
          device: string | null
          device_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          is_master: boolean
          key: string
          note: string | null
          revoked: boolean
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_revoke_key: {
        Args: { _id: string; _password: string }
        Returns: {
          activated_at: string | null
          created_at: string
          device: string | null
          device_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          is_master: boolean
          key: string
          note: string | null
          revoked: boolean
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_expiration: {
        Args: { _expires_at: string; _id: string; _password: string }
        Returns: {
          activated_at: string | null
          created_at: string
          device: string | null
          device_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          is_master: boolean
          key: string
          note: string | null
          revoked: boolean
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_maintenance: {
        Args: { _enabled: boolean; _message: string; _password: string }
        Returns: Json
      }
      admin_unrevoke_key: {
        Args: { _id: string; _password: string }
        Returns: {
          activated_at: string | null
          created_at: string
          device: string | null
          device_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          is_master: boolean
          key: string
          note: string | null
          revoked: boolean
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_maintenance: { Args: never; Returns: Json }
      get_settings: { Args: { _key: string }; Returns: Json }
      is_master_key: { Args: { _key: string }; Returns: boolean }
      redeem_key: {
        Args: { _device: string; _device_id: string; _key: string }
        Returns: Json
      }
      save_settings: { Args: { _key: string; _settings: Json }; Returns: Json }
      validate_key: {
        Args: { _device_id: string; _key: string }
        Returns: Json
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
