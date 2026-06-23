export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
          status: "pending" | "paid" | "cancelled" | "refunded";
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
          status?: "pending" | "paid" | "cancelled" | "refunded";
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
          status?: "pending" | "paid" | "cancelled" | "refunded";
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
          cost: number | null;
          active: boolean;
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
          cost?: number | null;
          active?: boolean;
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
          cost?: number | null;
          active?: boolean;
        };
        Relationships: [];
      };
      project_evaluations: {
        Row: {
          id: string;
          project_num: number;
          gender: string | null;
          evaluator: string | null;
          name: string | null;
          emoji: string | null;
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
          project_num: number;
          gender?: string | null;
          evaluator?: string | null;
          name?: string | null;
          emoji?: string | null;
          creative?: number | null;
          content?: number | null;
          presentation?: number | null;
          usability?: number | null;
          overall?: number | null;
          comments?: string | null;
          created_at?: string;
        };
        Update: {
          project_num?: number;
          gender?: string | null;
          evaluator?: string | null;
          name?: string | null;
          emoji?: string | null;
          creative?: number | null;
          content?: number | null;
          presentation?: number | null;
          usability?: number | null;
          overall?: number | null;
          comments?: string | null;
        };
        Relationships: [];
      };
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
          parent_name: string | null;
          parent_phone: string | null;
          parent_line: string | null;
          uid: string | null;
          card_status: "active" | "inactive" | "lost";
          student_status: "active" | "inactive" | "suspended";
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
          parent_name?: string | null;
          parent_phone?: string | null;
          parent_line?: string | null;
          uid?: string | null;
          card_status?: "active" | "inactive" | "lost";
          student_status?: "active" | "inactive" | "suspended";
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
          parent_name?: string | null;
          parent_phone?: string | null;
          parent_line?: string | null;
          uid?: string | null;
          card_status?: "active" | "inactive" | "lost";
          student_status?: "active" | "inactive" | "suspended";
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
