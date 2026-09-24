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
          plan: string
          revoked: boolean
          user_id: string | null
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
          plan?: string
          revoked?: boolean
          user_id?: string | null
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
          plan?: string
          revoked?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      admin_ai_audit: {
        Row: {
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          proposal: Json
        }
        Insert: {
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          proposal: Json
        }
        Update: {
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          proposal?: Json
        }
        Relationships: []
      }
      admin_ai_conversation: {
        Row: {
          messages: Json
          singleton: boolean
          updated_at: string
        }
        Insert: {
          messages?: Json
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          messages?: Json
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_messages: {
        Row: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          target_key_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          target_key_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          target_key_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_messages_target_key_id_fkey"
            columns: ["target_key_id"]
            isOneToOne: false
            referencedRelation: "access_keys"
            referencedColumns: ["id"]
          },
        ]
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
      key_expiry_notices: {
        Row: {
          expires_at: string
          key_id: string
          notified_at: string
        }
        Insert: {
          expires_at: string
          key_id: string
          notified_at?: string
        }
        Update: {
          expires_at?: string
          key_id?: string
          notified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_expiry_notices_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: true
            referencedRelation: "access_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      key_rewards: {
        Row: {
          best_streak: number
          coins: number
          current_streak: number
          key_id: string
          last_daily_claim: string | null
          total_claims: number
          updated_at: string
        }
        Insert: {
          best_streak?: number
          coins?: number
          current_streak?: number
          key_id: string
          last_daily_claim?: string | null
          total_claims?: number
          updated_at?: string
        }
        Update: {
          best_streak?: number
          coins?: number
          current_streak?: number
          key_id?: string
          last_daily_claim?: string | null
          total_claims?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_rewards_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: true
            referencedRelation: "access_keys"
            referencedColumns: ["id"]
          },
        ]
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
      message_reads: {
        Row: {
          key_id: string
          message_id: string
          read_at: string
        }
        Insert: {
          key_id: string
          message_id: string
          read_at?: string
        }
        Update: {
          key_id?: string
          message_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "access_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "admin_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_functions: {
        Row: {
          created_at: string
          icon: string
          id: string
          min_plan: string
          name: string
          sort_order: number
          tag: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          icon?: string
          id: string
          min_plan?: string
          name: string
          sort_order?: number
          tag: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          min_plan?: string
          name?: string
          sort_order?: number
          tag?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device: string | null
          endpoint: string
          id: string
          key_id: string | null
          last_seen_at: string
          p256dh: string
          scope: string
        }
        Insert: {
          auth: string
          created_at?: string
          device?: string | null
          endpoint: string
          id?: string
          key_id?: string | null
          last_seen_at?: string
          p256dh: string
          scope?: string
        }
        Update: {
          auth?: string
          created_at?: string
          device?: string | null
          endpoint?: string
          id?: string
          key_id?: string | null
          last_seen_at?: string
          p256dh?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "access_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_claims: {
        Row: {
          claimed_on: string
          coins: number
          created_at: string
          key_id: string
        }
        Insert: {
          claimed_on: string
          coins?: number
          created_at?: string
          key_id: string
        }
        Update: {
          claimed_on?: string
          coins?: number
          created_at?: string
          key_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_claims_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "access_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          device: string | null
          device_id: string | null
          id: string
          key_hash: string | null
          key_hint: string | null
          notified_at: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          device_id?: string | null
          id?: string
          key_hash?: string | null
          key_hint?: string | null
          notified_at?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          device?: string | null
          device_id?: string | null
          id?: string
          key_hash?: string | null
          key_hint?: string | null
          notified_at?: string | null
          reason?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_type: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_type: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          key_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          key_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          key_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_threads_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: true
            referencedRelation: "access_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrade_requests: {
        Row: {
          created_at: string
          id: string
          key_id: string
          message: string | null
          requested_plan: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_id: string
          message?: string | null
          requested_plan: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_id?: string
          message?: string | null
          requested_plan?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "upgrade_requests_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
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
      _plan_days: { Args: { _plan: string }; Returns: number }
      _require_admin: { Args: { _password: string }; Returns: undefined }
      _reward_cfg: { Args: never; Returns: Json }
      _reward_key_id: { Args: { _key: string }; Returns: string }
      _reward_state: { Args: { _key_id: string }; Returns: Json }
      _valid_access_key: { Args: { _key: string }; Returns: boolean }
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_apply_panel_proposal: {
        Args: { _password: string; _proposal: Json }
        Returns: Json
      }
      admin_clear_access_devices: {
        Args: { _current_device_id: string; _password: string }
        Returns: number
      }
      admin_create_keys: {
        Args: {
          _count: number
          _duration_days: number
          _note: string
          _password: string
          _plan?: string
        }
        Returns: Json
      }
      admin_delete_key: {
        Args: { _id: string; _password: string }
        Returns: boolean
      }
      admin_delete_message: {
        Args: { _id: string; _password: string }
        Returns: boolean
      }
      admin_delete_push_subscription: {
        Args: { _id: string; _password: string }
        Returns: boolean
      }
      admin_device_stats: { Args: { _password: string }; Returns: Json }
      admin_edit_message: {
        Args: { _body: string; _id: string; _password: string; _title: string }
        Returns: Json
      }
      admin_end_access_session: {
        Args: { _password: string; _session_id: string }
        Returns: boolean
      }
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_get_ai_messages: { Args: { _password: string }; Returns: Json }
      admin_list_access_sessions: { Args: { _password: string }; Returns: Json }
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
          plan: string
          revoked: boolean
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_messages: { Args: { _password: string }; Returns: Json }
      admin_list_panel_functions: { Args: { _password: string }; Returns: Json }
      admin_list_push_subscriptions: {
        Args: { _password: string }
        Returns: {
          auth: string
          created_at: string
          device: string | null
          endpoint: string
          id: string
          key_id: string | null
          last_seen_at: string
          p256dh: string
          scope: string
        }[]
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_security_events: {
        Args: { _password: string }
        Returns: {
          created_at: string
          device: string
          device_id: string
          id: string
          key_hint: string
          notified_at: string
          reason: string
        }[]
      }
      admin_list_upgrade_requests: {
        Args: { _password: string }
        Returns: Json
      }
      admin_open_panel: {
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_resolve_upgrade_request: {
        Args: { _approve: boolean; _id: string; _password: string }
        Returns: Json
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reward_add_coins: {
        Args: { _amount: number; _key_id: string; _password: string }
        Returns: Json
      }
      admin_reward_clear_claims: {
        Args: { _key_id: string; _password: string }
        Returns: Json
      }
      admin_reward_config: { Args: { _password: string }; Returns: Json }
      admin_reward_list: { Args: { _password: string }; Returns: Json }
      admin_reward_reset: {
        Args: { _clear_history?: boolean; _key_id: string; _password: string }
        Returns: Json
      }
      admin_reward_set_coins: {
        Args: { _coins: number; _key_id: string; _password: string }
        Returns: Json
      }
      admin_reward_set_config: {
        Args: {
          _daily_amount: number
          _max_coins: number
          _password: string
          _redeem_cost: number
          _redeem_days: number
        }
        Returns: Json
      }
      admin_reward_set_streak: {
        Args: { _key_id: string; _password: string; _streak: number }
        Returns: Json
      }
      admin_save_ai_messages: {
        Args: { _messages: Json; _password: string }
        Returns: boolean
      }
      admin_save_push_subscription: {
        Args: {
          _auth: string
          _device?: string
          _endpoint: string
          _p256dh: string
          _password: string
        }
        Returns: {
          auth: string
          created_at: string
          device: string | null
          endpoint: string
          id: string
          key_id: string | null
          last_seen_at: string
          p256dh: string
          scope: string
        }
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_send_message: {
        Args: {
          _body: string
          _password: string
          _target_key_id?: string
          _title: string
        }
        Returns: Json
      }
      admin_set_app_version: {
        Args: { _password: string; _version: string }
        Returns: string
      }
      admin_set_device: {
        Args: { _device: string; _id: string; _password: string }
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_device_approval: {
        Args: {
          _approved: boolean
          _current_device_id: string
          _device_id: string
          _password: string
        }
        Returns: boolean
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
          plan: string
          revoked: boolean
          user_id: string | null
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
      admin_set_plan: {
        Args: {
          _apply_duration?: boolean
          _id: string
          _password: string
          _plan: string
        }
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_support_close_chat: {
        Args: { _password: string; _thread_id: string }
        Returns: {
          closed_at: string | null
          created_at: string
          id: string
          key_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "support_threads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_support_delete_chat: {
        Args: { _password: string; _thread_id: string }
        Returns: boolean
      }
      admin_support_edit_message: {
        Args: { _body: string; _message_id: string; _password: string }
        Returns: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_type: string
          thread_id: string
        }
        SetofOptions: {
          from: "*"
          to: "support_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_support_list_messages: {
        Args: { _password: string; _thread_id: string }
        Returns: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_type: string
          thread_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "support_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_support_list_threads: {
        Args: { _password: string }
        Returns: {
          id: string
          key: string
          key_id: string
          updated_at: string
        }[]
      }
      admin_support_send_message: {
        Args: { _body: string; _password: string; _thread_id: string }
        Returns: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_type: string
          thread_id: string
        }
        SetofOptions: {
          from: "*"
          to: "support_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_touch_access_session: {
        Args: {
          _device_id: string
          _device_label: string
          _password: string
          _session_id: string
        }
        Returns: boolean
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_key_access: {
        Args: {
          _duration_days: number
          _id: string
          _key: string
          _password: string
          _plan: string
        }
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
          plan: string
          revoked: boolean
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "access_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_daily_reward: { Args: { _key: string }; Returns: Json }
      count_unread_messages: { Args: { _key: string }; Returns: number }
      get_app_version: { Args: never; Returns: string }
      get_daily_reward: { Args: { _key: string }; Returns: Json }
      get_login_email_by_username: {
        Args: { _username: string }
        Returns: string
      }
      get_maintenance: { Args: never; Returns: Json }
      get_settings: { Args: { _key: string }; Returns: Json }
      is_master_key: { Args: { _key: string }; Returns: boolean }
      list_my_messages: { Args: { _key: string }; Returns: Json }
      list_my_upgrade_requests: { Args: { _key: string }; Returns: Json }
      list_panel_functions: { Args: { _key: string }; Returns: Json }
      mark_messages_read: {
        Args: { _ids: string[]; _key: string }
        Returns: number
      }
      mark_security_event_notified: {
        Args: { _event_id: string }
        Returns: boolean
      }
      notify_expired_keys: { Args: never; Returns: number }
      record_security_event: {
        Args: {
          _device: string
          _device_id: string
          _key: string
          _reason: string
        }
        Returns: string
      }
      redeem_atlas_coins: { Args: { _key: string }; Returns: Json }
      redeem_key: {
        Args: { _device: string; _device_id: string; _key: string }
        Returns: Json
      }
      request_upgrade: {
        Args: { _key: string; _message?: string; _plan: string }
        Returns: Json
      }
      save_settings: { Args: { _key: string; _settings: Json }; Returns: Json }
      support_close_chat: {
        Args: { _key: string }
        Returns: {
          closed_at: string | null
          created_at: string
          id: string
          key_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "support_threads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      support_delete_chat: { Args: { _key: string }; Returns: boolean }
      support_edit_message: {
        Args: { _body: string; _key: string; _message_id: string }
        Returns: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_type: string
          thread_id: string
        }
        SetofOptions: {
          from: "*"
          to: "support_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      support_list_messages: {
        Args: { _key: string }
        Returns: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_type: string
          thread_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "support_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      support_send_message: {
        Args: { _body: string; _key: string }
        Returns: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_type: string
          thread_id: string
        }
        SetofOptions: {
          from: "*"
          to: "support_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_delete_push_subscription: {
        Args: { _endpoint: string; _key: string }
        Returns: boolean
      }
      user_push_status: { Args: { _key: string }; Returns: boolean }
      user_save_push_subscription: {
        Args: {
          _auth: string
          _device: string
          _endpoint: string
          _key: string
          _p256dh: string
        }
        Returns: boolean
      }
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
    Enums: {},
  },
} as const
