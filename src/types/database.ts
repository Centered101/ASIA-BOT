export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Status of the student as a person — distinct from card_status (the RFID card). */
export type StudentStatus =
  | "studying"
  | "on_leave"
  | "transferred"
  | "graduated"
  | "resigned"
  | "expelled";

/** Which profile table a user_accounts row primarily maps to. */
export type AccountSubjectType = "admin" | "teacher" | "student" | "parent" | "alumni";

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string;
          admin_id: string;
          username: string;
          password_hash: string;
          role: "superadmin" | "admin" | "staff";
          first_name: string | null;
          last_name: string | null;
          nickname: string | null;
          email: string | null;
          phone: string | null;
          entry_year: string | null;
          department: string | null;
          avatar: string | null;
          admin_status: "active" | "inactive";
          google_email: string | null;
          google_id: string | null;
          username_changed_at: string | null;
          linked_student_id: string | null;
          account_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          username: string;
          password_hash: string;
          role?: "superadmin" | "admin" | "staff";
          first_name?: string | null;
          last_name?: string | null;
          nickname?: string | null;
          email?: string | null;
          phone?: string | null;
          entry_year?: string | null;
          department?: string | null;
          avatar?: string | null;
          admin_status?: "active" | "inactive";
          google_email?: string | null;
          google_id?: string | null;
          username_changed_at?: string | null;
          linked_student_id?: string | null;
          account_id?: string | null;
          created_at?: string;
        };
        Update: {
          admin_id?: string;
          username?: string;
          password_hash?: string;
          role?: "superadmin" | "admin" | "staff";
          first_name?: string | null;
          last_name?: string | null;
          nickname?: string | null;
          email?: string | null;
          phone?: string | null;
          entry_year?: string | null;
          department?: string | null;
          avatar?: string | null;
          admin_status?: "active" | "inactive";
          google_email?: string | null;
          google_id?: string | null;
          username_changed_at?: string | null;
          linked_student_id?: string | null;
          account_id?: string | null;
        };
        Relationships: [];
      };
      admin_logs: {
        Row: {
          id: string;
          log_time: string | null;
          admin_id_attempt: string | null;
          status: string | null;
          reason: string | null;
          ip_address: string | null;
          user_agent: string | null;
          platform: string | null;
          language: string | null;
          screen: string | null;
          timezone: string | null;
          referrer: string | null;
          page_url: string | null;
          touch_device: boolean | null;
        };
        Insert: {
          id?: string;
          log_time?: string | null;
          admin_id_attempt?: string | null;
          status?: string | null;
          reason?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          platform?: string | null;
          language?: string | null;
          screen?: string | null;
          timezone?: string | null;
          referrer?: string | null;
          page_url?: string | null;
          touch_device?: boolean | null;
        };
        Update: {
          admin_id_attempt?: string | null;
          status?: string | null;
          reason?: string | null;
        };
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          student_id: string;
          location: "school" | "library" | "meeting";
          checkin_time: string | null;
          checkout_time: string | null;
          duration: string | null;
          uid: string | null;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          location?: "school" | "library" | "meeting";
          checkin_time?: string | null;
          checkout_time?: string | null;
          duration?: string | null;
          uid?: string | null;
          date?: string;
          created_at?: string;
        };
        Update: {
          student_id?: string;
          location?: "school" | "library" | "meeting";
          checkin_time?: string | null;
          checkout_time?: string | null;
          duration?: string | null;
          uid?: string | null;
          date?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          room_id: string;
          slot_id: number;
          booking_date: string;
          student_id: string;
          student_name: string;
          student_phone: string | null;
          purpose: string;
          attendees: number | null;
          status: "pending" | "approved" | "rejected" | "cancelled";
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          slot_id: number;
          booking_date: string;
          student_id: string;
          student_name: string;
          student_phone?: string | null;
          purpose: string;
          attendees?: number | null;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          room_id?: string;
          slot_id?: number;
          booking_date?: string;
          student_id?: string;
          student_name?: string;
          student_phone?: string | null;
          purpose?: string;
          attendees?: number | null;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          admin_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      entry_logs: {
        Row: {
          id: string;
          student_id: string | null;
          action: "in" | "out";
          scanned_at: string;
        };
        Insert: {
          id?: string;
          student_id?: string | null;
          action: "in" | "out";
          scanned_at?: string;
        };
        Update: {
          student_id?: string | null;
          action?: "in" | "out";
          scanned_at?: string;
        };
        Relationships: [];
      };
      equipment_items: {
        Row: {
          id: string;
          asset_code: string | null;
          name: string;
          category: string;
          department: string | null;
          unit: string;
          total_quantity: number;
          available_quantity: number;
          image_url: string | null;
          description: string | null;
          active: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_code?: string | null;
          name: string;
          category: string;
          department?: string | null;
          unit?: string;
          total_quantity?: number;
          available_quantity?: number;
          image_url?: string | null;
          description?: string | null;
          active?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          asset_code?: string | null;
          name?: string;
          category?: string;
          department?: string | null;
          unit?: string;
          total_quantity?: number;
          available_quantity?: number;
          image_url?: string | null;
          description?: string | null;
          active?: boolean;
          deleted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      equipment_requests: {
        Row: {
          id: string;
          request_code: string;
          equipment_item_id: string;
          student_id: string | null;
          department: string;
          requester_name: string;
          requester_phone: string | null;
          quantity: number;
          purpose: string | null;
          borrow_date: string;
          due_date: string;
          returned_at: string | null;
          delivery_mode: "pickup" | "delivery";
          delivery_loc: string | null;
          time_slot: string | null;
          picked_up_at: string | null;
          status: "pending" | "approved" | "picked_up" | "rejected" | "cancelled" | "returned";
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_code: string;
          equipment_item_id: string;
          student_id?: string | null;
          department: string;
          requester_name: string;
          requester_phone?: string | null;
          quantity: number;
          purpose?: string | null;
          borrow_date: string;
          due_date: string;
          returned_at?: string | null;
          delivery_mode?: "pickup" | "delivery";
          delivery_loc?: string | null;
          time_slot?: string | null;
          picked_up_at?: string | null;
          status?: "pending" | "approved" | "picked_up" | "rejected" | "cancelled" | "returned";
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          request_code?: string;
          equipment_item_id?: string;
          student_id?: string | null;
          department?: string;
          requester_name?: string;
          requester_phone?: string | null;
          quantity?: number;
          purpose?: string | null;
          borrow_date?: string;
          due_date?: string;
          returned_at?: string | null;
          delivery_mode?: "pickup" | "delivery";
          delivery_loc?: string | null;
          time_slot?: string | null;
          picked_up_at?: string | null;
          status?: "pending" | "approved" | "picked_up" | "rejected" | "cancelled" | "returned";
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      evaluations: {
        Row: {
          id: string;
          project_id: string | null;
          gender: string | null;
          evaluator: string | null;
          name: string | null;
          emoji: number | null;
          creative: number | null;
          content: number | null;
          presentation: number | null;
          usability: number | null;
          overall: number | null;
          comments: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          gender?: string | null;
          evaluator?: string | null;
          name?: string | null;
          emoji?: number | null;
          creative?: number | null;
          content?: number | null;
          presentation?: number | null;
          usability?: number | null;
          overall?: number | null;
          comments?: string | null;
          created_at?: string;
        };
        Update: {
          project_id?: string | null;
          gender?: string | null;
          evaluator?: string | null;
          name?: string | null;
          emoji?: number | null;
          creative?: number | null;
          content?: number | null;
          presentation?: number | null;
          usability?: number | null;
          overall?: number | null;
          comments?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          type: "comment" | "report";
          name: string | null;
          student_id: string | null;
          email: string | null;
          contact: string | null;
          category: string | null;
          message: string;
          report_url: string | null;
          image_urls: string[] | null;
          status: "pending" | "in_progress" | "resolved";
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: "comment" | "report";
          name?: string | null;
          student_id?: string | null;
          email?: string | null;
          contact?: string | null;
          category?: string | null;
          message: string;
          report_url?: string | null;
          image_urls?: string[] | null;
          status?: "pending" | "in_progress" | "resolved";
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          type?: "comment" | "report";
          name?: string | null;
          student_id?: string | null;
          email?: string | null;
          contact?: string | null;
          category?: string | null;
          message?: string;
          report_url?: string | null;
          image_urls?: string[] | null;
          status?: "pending" | "in_progress" | "resolved";
          admin_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      login_logs: {
        Row: {
          id: string;
          log_time: string | null;
          student_id_attempt: string | null;
          status: string | null;
          reason: string | null;
          ip_address: string | null;
          user_agent: string | null;
          platform: string | null;
          language: string | null;
          screen: string | null;
          timezone: string | null;
          referrer: string | null;
          page_url: string | null;
          touch_device: boolean | null;
        };
        Insert: {
          id?: string;
          log_time?: string | null;
          student_id_attempt?: string | null;
          status?: string | null;
          reason?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          platform?: string | null;
          language?: string | null;
          screen?: string | null;
          timezone?: string | null;
          referrer?: string | null;
          page_url?: string | null;
          touch_device?: boolean | null;
        };
        Update: {
          student_id_attempt?: string | null;
          status?: string | null;
          reason?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_id: string;
          student_id: string;
          student_name: string;
          items_json: Json;
          total: number;
          pi_id: string | null;
          status: "pending" | "paid" | "cancelled" | "refunded" | "delivered";
          delivery_mode: "pickup" | "delivery" | null;
          delivery_loc: string | null;
          delivery_slot: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string;
          student_id: string;
          student_name: string;
          items_json: Json;
          total: number;
          pi_id?: string | null;
          status?: "pending" | "paid" | "cancelled" | "refunded" | "delivered";
          delivery_mode?: "pickup" | "delivery" | null;
          delivery_loc?: string | null;
          delivery_slot?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          student_name?: string;
          items_json?: Json;
          total?: number;
          pi_id?: string | null;
          status?: "pending" | "paid" | "cancelled" | "refunded" | "delivered";
          delivery_mode?: "pickup" | "delivery" | null;
          delivery_loc?: string | null;
          delivery_slot?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pay_logs: {
        Row: {
          id: string;
          log_ts: string | null;
          order_id: string | null;
          student_id: string | null;
          total: number | null;
          pi_id: string | null;
          stripe_status: string | null;
          status: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          log_ts?: string | null;
          order_id?: string | null;
          student_id?: string | null;
          total?: number | null;
          pi_id?: string | null;
          stripe_status?: string | null;
          status?: string | null;
          note?: string | null;
        };
        Update: {
          order_id?: string | null;
          student_id?: string | null;
          total?: number | null;
          pi_id?: string | null;
          stripe_status?: string | null;
          status?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          tag: string | null;
          stock: number;
          name: string;
          price: number;
          images: string[] | null;
          unit: string | null;
          category: string | null;
          colors: string[] | null;
          color_stock: Json | null;
          cost: number | null;
          active: boolean;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tag?: string | null;
          stock?: number;
          name: string;
          price: number;
          images?: string[] | null;
          unit?: string | null;
          category?: string | null;
          colors?: string[] | null;
          color_stock?: Json | null;
          cost?: number | null;
          active?: boolean;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          tag?: string | null;
          stock?: number;
          name?: string;
          price?: number;
          images?: string[] | null;
          unit?: string | null;
          category?: string | null;
          colors?: string[] | null;
          color_stock?: Json | null;
          cost?: number | null;
          active?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      // Phase 1: `project_evaluations` was declared here but exists neither in
      // supabase/schema.sql nor anywhere in src/. The real table is
      // `evaluations` (keyed by project_id, not project_num). Removed.
      projects: {
        Row: {
          id: string;
          name: string;
          slug: string;
          project_date: string | null;
          storage_folder: string | null;
          poster_url: string | null;
          demo_url: string | null;
          primary_color: string | null;
          bg_image_url: string | null;
          bg_size: string | null;
          logo_url: string | null;
          mascot_url: string | null;
          mascot_msg_welcome: string | null;
          mascot_msg_thanks: string | null;
          custom_fields: Json | null;
          bg_color: string | null;
          bg_overlay: string | null;
          bg_repeat: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          project_date?: string | null;
          storage_folder?: string | null;
          poster_url?: string | null;
          demo_url?: string | null;
          primary_color?: string | null;
          bg_image_url?: string | null;
          bg_size?: string | null;
          bg_color?: string | null;
          bg_overlay?: string | null;
          bg_repeat?: string | null;
          logo_url?: string | null;
          mascot_url?: string | null;
          mascot_msg_welcome?: string | null;
          mascot_msg_thanks?: string | null;
          custom_fields?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          project_date?: string | null;
          storage_folder?: string | null;
          poster_url?: string | null;
          demo_url?: string | null;
          primary_color?: string | null;
          bg_image_url?: string | null;
          bg_size?: string | null;
          bg_color?: string | null;
          bg_overlay?: string | null;
          bg_repeat?: string | null;
          logo_url?: string | null;
          mascot_url?: string | null;
          mascot_msg_welcome?: string | null;
          mascot_msg_thanks?: string | null;
          custom_fields?: Json | null;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          capacity: number;
          location: string | null;
          image_url: string | null;
          amenities: string[] | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          capacity?: number;
          location?: string | null;
          image_url?: string | null;
          amenities?: string[] | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          capacity?: number;
          location?: string | null;
          image_url?: string | null;
          amenities?: string[] | null;
          status?: string;
        };
        Relationships: [];
      };
      students: {
        // Phase 1: parent_name / parent_phone / parent_line were declared here
        // but exist neither in supabase/schema.sql nor anywhere in src/ —
        // phantom columns, removed. Guardians get a proper table in Phase 2.
        // student_status is real as of migration 0006 with the values below.
        Row: {
          id: string;
          student_id: string;
          student_phone: string;
          first_name: string;
          last_name: string;
          program: string;
          entry_year: string;
          nickname: string | null;
          department: string | null;
          uid: string | null;
          card_status: "active" | "inactive" | "lost";
          photo_url: string | null;
          line_user_id: string | null;
          google_email: string | null;
          google_id: string | null;
          google_name: string | null;
          google_avatar_url: string | null;
          account_id: string | null;
          birth_date: string | null;
          gender: "male" | "female" | "other" | null;
          national_id: string | null;
          address: string | null;
          student_status: StudentStatus;
          class_group_id: string | null;
          advisor_teacher_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          student_phone: string;
          first_name: string;
          last_name: string;
          program?: string;
          entry_year: string;
          nickname?: string | null;
          department?: string | null;
          uid?: string | null;
          card_status?: "active" | "inactive" | "lost";
          photo_url?: string | null;
          line_user_id?: string | null;
          google_email?: string | null;
          google_id?: string | null;
          google_name?: string | null;
          google_avatar_url?: string | null;
          account_id?: string | null;
          birth_date?: string | null;
          gender?: "male" | "female" | "other" | null;
          national_id?: string | null;
          address?: string | null;
          student_status?: StudentStatus;
          class_group_id?: string | null;
          advisor_teacher_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          student_phone?: string;
          first_name?: string;
          last_name?: string;
          program?: string;
          entry_year?: string;
          nickname?: string | null;
          department?: string | null;
          uid?: string | null;
          card_status?: "active" | "inactive" | "lost";
          photo_url?: string | null;
          line_user_id?: string | null;
          google_email?: string | null;
          google_id?: string | null;
          google_name?: string | null;
          google_avatar_url?: string | null;
          account_id?: string | null;
          birth_date?: string | null;
          gender?: "male" | "female" | "other" | null;
          national_id?: string | null;
          address?: string | null;
          student_status?: StudentStatus;
          class_group_id?: string | null;
          advisor_teacher_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      teachers: {
        Row: {
          id: string;
          full_name: string;
          nickname: string | null;
          subject: string | null;
          phone: string | null;
          email: string | null;
          department: string | null;
          color: string | null;
          status: "pending" | "reviewing" | "approved" | "rejected" | "active" | "inactive";
          reason: string | null;
          desired_username: string | null;
          desired_password_hash: string | null;
          linked_admin_id: string | null;
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          nickname?: string | null;
          subject?: string | null;
          phone?: string | null;
          email?: string | null;
          department?: string | null;
          color?: string | null;
          status?: "pending" | "reviewing" | "approved" | "rejected" | "active" | "inactive";
          reason?: string | null;
          desired_username?: string | null;
          desired_password_hash?: string | null;
          linked_admin_id?: string | null;
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          nickname?: string | null;
          subject?: string | null;
          phone?: string | null;
          email?: string | null;
          department?: string | null;
          color?: string | null;
          status?: "pending" | "reviewing" | "approved" | "rejected" | "active" | "inactive";
          reason?: string | null;
          desired_username?: string | null;
          desired_password_hash?: string | null;
          linked_admin_id?: string | null;
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          account_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      time_slots: {
        Row: {
          id: number;
          label: string;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: number;
          label: string;
          start_time: string;
          end_time: string;
        };
        Update: {
          label?: string;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };

      // ─── Phase 1 foundation (supabase/migrations/0001-0005) ────────────────
      user_accounts: {
        Row: {
          id: string;
          login: string;
          password_hash: string | null;
          google_id: string | null;
          google_email: string | null;
          subject_type: AccountSubjectType;
          status: "active" | "inactive" | "suspended";
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          login: string;
          password_hash?: string | null;
          google_id?: string | null;
          google_email?: string | null;
          subject_type: AccountSubjectType;
          status?: "active" | "inactive" | "suspended";
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          login?: string;
          password_hash?: string | null;
          google_id?: string | null;
          google_email?: string | null;
          subject_type?: AccountSubjectType;
          status?: "active" | "inactive" | "suspended";
          last_login_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      auth_sessions: {
        Row: {
          id: string;
          account_id: string;
          token_hash: string;
          issued_at: string;
          expires_at: string;
          revoked_at: string | null;
          last_seen_at: string | null;
          ip_address: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          token_hash: string;
          issued_at?: string;
          expires_at: string;
          revoked_at?: string | null;
          last_seen_at?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: {
          expires_at?: string;
          revoked_at?: string | null;
          last_seen_at?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_account_id: string | null;
          actor_label: string | null;
          actor_role: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_account_id?: string | null;
          actor_label?: string | null;
          actor_role?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        // Audit rows are append-only by design; no Update shape.
        Update: Record<string, never>;
        Relationships: [];
      };
      roles: {
        Row: {
          key: string;
          label: string;
          description: string | null;
          sort_order: number;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          key: string;
          label: string;
          description?: string | null;
          sort_order?: number;
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          label?: string;
          description?: string | null;
          sort_order?: number;
          is_system?: boolean;
        };
        Relationships: [];
      };
      permissions: {
        Row: { key: string; label: string; module: string; created_at: string };
        Insert: { key: string; label: string; module: string; created_at?: string };
        Update: { label?: string; module?: string };
        Relationships: [];
      };
      role_permissions: {
        Row: { role_key: string; permission_key: string };
        Insert: { role_key: string; permission_key: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          account_id: string;
          role_key: string;
          scope_type: "class_group" | "department" | "room" | null;
          scope_id: string | null;
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          role_key: string;
          scope_type?: "class_group" | "department" | "room" | null;
          scope_id?: string | null;
          granted_by?: string | null;
          created_at?: string;
        };
        Update: {
          role_key?: string;
          scope_type?: "class_group" | "department" | "room" | null;
          scope_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
