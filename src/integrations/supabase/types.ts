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
      calendar_events: {
        Row: {
          all_day: boolean
          category: string
          color: string | null
          course_id: string | null
          created_at: string
          description: string | null
          end_date: string
          event_type: string
          id: string
          location: string | null
          recurrence: string | null
          recurrence_end_date: string | null
          start_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          category: string
          color?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          event_type: string
          id?: string
          location?: string | null
          recurrence?: string | null
          recurrence_end_date?: string | null
          start_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          category?: string
          color?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          event_type?: string
          id?: string
          location?: string | null
          recurrence?: string | null
          recurrence_end_date?: string | null
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ai_policy: Database["public"]["Enums"]["ai_policy"]
          ai_policy_details: string | null
          code: string | null
          color: string | null
          created_at: string
          credits: number | null
          evaluation_type: Database["public"]["Enums"]["evaluation_type"]
          id: string
          lecturer: string | null
          lecturer_email: string | null
          material_url: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_policy?: Database["public"]["Enums"]["ai_policy"]
          ai_policy_details?: string | null
          code?: string | null
          color?: string | null
          created_at?: string
          credits?: number | null
          evaluation_type?: Database["public"]["Enums"]["evaluation_type"]
          id?: string
          lecturer?: string | null
          lecturer_email?: string | null
          material_url?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_policy?: Database["public"]["Enums"]["ai_policy"]
          ai_policy_details?: string | null
          code?: string | null
          color?: string | null
          created_at?: string
          credits?: number | null
          evaluation_type?: Database["public"]["Enums"]["evaluation_type"]
          id?: string
          lecturer?: string | null
          lecturer_email?: string | null
          material_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          completed: boolean | null
          created_at: string
          deadline: string | null
          id: string
          project_id: string
          title: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          deadline?: string | null
          id?: string
          project_id: string
          title: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          deadline?: string | null
          id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          course_id: string
          created_at: string
          deadline: string | null
          description: string | null
          exercise_type: Database["public"]["Enums"]["exercise_type"] | null
          feedback: string | null
          id: string
          link: string | null
          redo_for_exam: boolean | null
          status: Database["public"]["Enums"]["exercise_status"]
          title: string
          updated_at: string
          week_number: number | null
        }
        Insert: {
          course_id: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          exercise_type?: Database["public"]["Enums"]["exercise_type"] | null
          feedback?: string | null
          id?: string
          link?: string | null
          redo_for_exam?: boolean | null
          status?: Database["public"]["Enums"]["exercise_status"]
          title: string
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          exercise_type?: Database["public"]["Enums"]["exercise_type"] | null
          feedback?: string | null
          id?: string
          link?: string | null
          redo_for_exam?: boolean | null
          status?: Database["public"]["Enums"]["exercise_status"]
          title?: string
          updated_at?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          course_id: string
          created_at: string
          deadline: string | null
          description: string | null
          documentation_requirements: string | null
          group_size: number | null
          id: string
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          documentation_requirements?: string | null
          group_size?: number | null
          id?: string
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          documentation_requirements?: string | null
          group_size?: number | null
          id?: string
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      theory_topics: {
        Row: {
          course_id: string
          created_at: string
          file_path: string | null
          id: string
          personal_summary: string | null
          sort_order: number | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          source_url: string | null
          status: Database["public"]["Enums"]["theory_status"]
          title: string
          updated_at: string
          week_number: number | null
        }
        Insert: {
          course_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          personal_summary?: string | null
          sort_order?: number | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["theory_status"]
          title: string
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          personal_summary?: string | null
          sort_order?: number | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["theory_status"]
          title?: string
          updated_at?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "theory_topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_items: {
        Row: {
          completed: boolean | null
          created_at: string
          description: string
          id: string
          project_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          description: string
          id?: string
          project_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          description?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      week_plans: {
        Row: {
          actual_hours: number | null
          course_id: string
          created_at: string
          deliverable_goals: string | null
          estimated_hours: number | null
          exercise_goals: string | null
          id: string
          theory_goals: string | null
          updated_at: string
          week_number: number
        }
        Insert: {
          actual_hours?: number | null
          course_id: string
          created_at?: string
          deliverable_goals?: string | null
          estimated_hours?: number | null
          exercise_goals?: string | null
          id?: string
          theory_goals?: string | null
          updated_at?: string
          week_number: number
        }
        Update: {
          actual_hours?: number | null
          course_id?: string
          created_at?: string
          deliverable_goals?: string | null
          estimated_hours?: number | null
          exercise_goals?: string | null
          id?: string
          theory_goals?: string | null
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "week_plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_policy: "ALLOWED" | "LIMITED" | "FORBIDDEN"
      evaluation_type: "EXAM" | "PROJECT" | "PAPER" | "CONTINUOUS" | "MIXED"
      exercise_status: "NOT_STARTED" | "IN_PROGRESS" | "DONE"
      exercise_type: "LAB" | "HOMEWORK" | "ASSIGNMENT"
      project_status:
        | "NOT_STARTED"
        | "PLANNING"
        | "IN_PROGRESS"
        | "REVIEW"
        | "SUBMITTED"
      source_type: "SLIDES" | "GITBOOK" | "VIDEO" | "PDF" | "OTHER"
      theory_status: "NOT_VIEWED" | "REVIEWED" | "MASTERED"
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
      ai_policy: ["ALLOWED", "LIMITED", "FORBIDDEN"],
      evaluation_type: ["EXAM", "PROJECT", "PAPER", "CONTINUOUS", "MIXED"],
      exercise_status: ["NOT_STARTED", "IN_PROGRESS", "DONE"],
      exercise_type: ["LAB", "HOMEWORK", "ASSIGNMENT"],
      project_status: [
        "NOT_STARTED",
        "PLANNING",
        "IN_PROGRESS",
        "REVIEW",
        "SUBMITTED",
      ],
      source_type: ["SLIDES", "GITBOOK", "VIDEO", "PDF", "OTHER"],
      theory_status: ["NOT_VIEWED", "REVIEWED", "MASTERED"],
    },
  },
} as const
