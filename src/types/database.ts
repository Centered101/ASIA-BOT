export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Status of the student as a person — distinct from card_status (the RFID card). */
export type StudentStatus =
  | "studying"
  | "on_leave"
  | "transferred"
  | "graduated"
  | "resigned"
  | "expelled";

/** ระดับความสำคัญของแจ้งเตือน ใช้จัดลำดับและสีในกล่อง */
export type NotificationPriority = "low" | "normal" | "high";

/** Which profile table a user_accounts row primarily maps to. */
export type AccountSubjectType = "admin" | "teacher" | "student" | "parent" | "alumni";

/** ความสัมพันธ์ของผู้ปกครองกับนักเรียน (guardians.relationship) */
/**
 * ใครกรอกแถวนี้ — ใช้กับ guardians, student_education_history,
 * student_achievements (ดู 0020_student_self_service.sql)
 *
 * นักเรียนแก้/ลบได้เฉพาะแถวที่เป็น "student" ส่วน "staff" คือของฝ่ายทะเบียน
 */
export type RecordSource = "staff" | "student";

export type GuardianRelationship = "บิดา" | "มารดา" | "ผู้ปกครอง" | "ญาติ" | "อื่นๆ";

/** สิ่งที่เปลี่ยนไปในไทม์ไลน์ของนักเรียน (student_status_changes.change_type) */
export type StudentChangeType = "status" | "department" | "class_group" | "advisor" | "program";

/** ประเภทผลงาน (student_achievements.kind) */
export type AchievementKind = "competition" | "award" | "certificate" | "performance" | "publication";

/** ระดับของงาน/การแข่งขัน (student_achievements.level) */
export type AchievementLevel = "school" | "district" | "province" | "region" | "national" | "international";

/** ขอบเขตของตำแหน่งที่นักเรียนดำรง (student_positions.scope) */
export type PositionScope = "class" | "department" | "school" | "club" | "other";

/** สภาพครุภัณฑ์ (assets.condition) */
export type AssetCondition = "new" | "good" | "fair" | "poor" | "broken";

/** สถานะครุภัณฑ์ (assets.status) */
export type AssetStatus = "in_use" | "in_storage" | "under_repair" | "disposed" | "lost";

/** สิ่งที่แจ้งซ่อมชี้ไปหา (maintenance_requests.target_kind) */
export type MaintenanceTargetKind = "asset" | "equipment_item" | "room" | "other";

/** หมวดงานซ่อม (maintenance_requests.category) */
export type MaintenanceCategory =
  | "ไฟฟ้า" | "ประปา" | "แอร์" | "โครงสร้าง"
  | "เฟอร์นิเจอร์" | "อุปกรณ์" | "คอมพิวเตอร์" | "อื่นๆ";

/** ความเร่งด่วน (maintenance_requests.urgency) */
export type MaintenanceUrgency = "low" | "normal" | "high" | "critical";

/**
 * ขั้นตอนงานซ่อม (maintenance_requests.status)
 * ลำดับที่อนุญาตอยู่ใน MAINTENANCE_TRANSITIONS — src/lib/server/maintenance.ts
 */
export type MaintenanceStatus =
  | "reported" | "received" | "inspecting" | "assigned"
  | "repairing" | "waiting_inspection" | "completed" | "cancelled";

/** ระยะของรูปหลักฐานการซ่อม (maintenance_photos.phase) */
export type MaintenancePhotoPhase = "before" | "during" | "after";

/**
 * ผลการเช็กชื่อรายคาบ (class_attendance.status)
 * activity แยกจาก absent เพราะไปแข่ง/ไปกิจกรรมไม่ควรถูกนับเป็นขาดเรียน
 */
export type ClassAttendanceStatus = "present" | "late" | "absent" | "leave" | "activity";

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
          /** ฝ่ายที่สังกัด ใช้ key เดียวกับ roles.key — NULL คือยังไม่ระบุ */
          division: string | null;
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
          division?: string | null;
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
          division?: string | null;
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

      // ─── ตารางเดิมที่ types เคยขาดไป (ตรงกับ supabase/schema.sql) ──────────
      line_notification_categories: {
        Row: {
          key: string;
          label: string;
          description: string | null;
          sort_order: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          label: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          key?: string;
          label?: string;
          description?: string | null;
          sort_order?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      line_notification_channels: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          category_key: string;
          is_active: boolean;
          is_default: boolean;
          notes: string | null;
          last_seen_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          category_key?: string;
          is_active?: boolean;
          is_default?: boolean;
          notes?: string | null;
          last_seen_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          group_id?: string;
          name?: string;
          category_key?: string;
          is_active?: boolean;
          is_default?: boolean;
          notes?: string | null;
          last_seen_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      class_groups: {
        Row: {
          id: string;
          name: string;
          program: string | null;
          grade: number | null;
          section: number | null;
          department: string | null;
          color: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          program?: string | null;
          grade?: number | null;
          section?: number | null;
          department?: string | null;
          color?: string | null;
          created_at?: string | null;
        };
        Update: {
          name?: string;
          program?: string | null;
          grade?: number | null;
          section?: number | null;
          department?: string | null;
          color?: string | null;
        };
        Relationships: [];
      };
      class_schedules: {
        Row: {
          id: string;
          class_group_id: string;
          room_name: string;
          subject: string | null;
          teacher: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          teacher_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          class_group_id: string;
          room_name: string;
          subject?: string | null;
          teacher?: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at?: string | null;
        };
        Update: {
          class_group_id?: string;
          room_name?: string;
          subject?: string | null;
          teacher?: string | null;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      class_schedule_overrides: {
        Row: {
          id: string;
          override_date: string;
          class_group_id: string;
          start_time: string;
          end_time: string;
          room_name: string | null;
          subject: string | null;
          teacher: string | null;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          override_date: string;
          class_group_id: string;
          start_time: string;
          end_time: string;
          room_name?: string | null;
          subject?: string | null;
          teacher?: string | null;
          note?: string | null;
          created_at?: string | null;
        };
        Update: {
          override_date?: string;
          class_group_id?: string;
          start_time?: string;
          end_time?: string;
          room_name?: string | null;
          subject?: string | null;
          teacher?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };
      change_requests: {
        Row: {
          id: string;
          student_id: string;
          requested_changes: Json;
          status: "pending" | "approved" | "rejected";
          admin_note: string | null;
          reviewed_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          requested_changes: Json;
          status?: "pending" | "approved" | "rejected";
          admin_note?: string | null;
          reviewed_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          student_id?: string;
          requested_changes?: Json;
          status?: "pending" | "approved" | "rejected";
          admin_note?: string | null;
          reviewed_by?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      student_cards: {
        Row: {
          id: string;
          student_id: string | null;
          uid: string;
          card_status: "active" | "inactive" | "lost";
          card_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id?: string | null;
          uid: string;
          card_status?: "active" | "inactive" | "lost";
          card_type?: string;
          created_at?: string;
        };
        Update: {
          student_id?: string | null;
          uid?: string;
          card_status?: "active" | "inactive" | "lost";
          card_type?: string;
        };
        Relationships: [];
      };
      rfid_cards: {
        Row: {
          id: string;
          student_id: string;
          uid: string;
          card_type: string;
          status: "active" | "inactive" | "lost";
          issued_at: string | null;
          revoked_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          uid: string;
          card_type?: string;
          status?: "active" | "inactive" | "lost";
          issued_at?: string | null;
          revoked_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          student_id?: string;
          uid?: string;
          card_type?: string;
          status?: "active" | "inactive" | "lost";
          issued_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      rfid_devices: {
        Row: {
          id: string;
          device_id: string;
          device_key: string;
          name: string | null;
          location: string | null;
          status: "active" | "inactive";
          created_at: string | null;
        };
        Insert: {
          id?: string;
          device_id: string;
          device_key: string;
          name?: string | null;
          location?: string | null;
          status?: "active" | "inactive";
          created_at?: string | null;
        };
        Update: {
          device_id?: string;
          device_key?: string;
          name?: string | null;
          location?: string | null;
          status?: "active" | "inactive";
        };
        Relationships: [];
      };
      attendance_logs: {
        Row: {
          id: string;
          student_id: string | null;
          uid: string;
          location: string;
          check_in: string | null;
          check_out: string | null;
          duration_minutes: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          student_id?: string | null;
          uid: string;
          location: string;
          check_in?: string | null;
          check_out?: string | null;
          duration_minutes?: number | null;
          created_at?: string | null;
        };
        Update: {
          student_id?: string | null;
          uid?: string;
          location?: string;
          check_in?: string | null;
          check_out?: string | null;
          duration_minutes?: number | null;
        };
        Relationships: [];
      };
      feedbacks: {
        Row: {
          id: string;
          type: "comment" | "report";
          name: string | null;
          contact: string | null;
          category: string;
          page: string | null;
          message: string;
          image_urls: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: "comment" | "report";
          name?: string | null;
          contact?: string | null;
          category: string;
          page?: string | null;
          message: string;
          image_urls?: string[] | null;
          created_at?: string;
        };
        Update: {
          type?: "comment" | "report";
          name?: string | null;
          contact?: string | null;
          category?: string;
          page?: string | null;
          message?: string;
          image_urls?: string[] | null;
        };
        Relationships: [];
      };
      room_bookings: {
        Row: {
          id: string;
          room_id: string;
          booker_name: string;
          booker_phone: string | null;
          purpose: string;
          date: string;
          time_start: string;
          time_end: string;
          status: "pending" | "approved" | "rejected" | "cancelled";
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          booker_name: string;
          booker_phone?: string | null;
          purpose: string;
          date: string;
          time_start: string;
          time_end: string;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          note?: string | null;
          created_at?: string;
        };
        Update: {
          room_id?: string;
          booker_name?: string;
          booker_phone?: string | null;
          purpose?: string;
          date?: string;
          time_start?: string;
          time_end?: string;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          note?: string | null;
        };
        Relationships: [];
      };
      teacher_applications: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          department: string | null;
          subject: string | null;
          reason: string;
          desired_username: string;
          status: "pending" | "reviewing" | "approved" | "rejected";
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          department?: string | null;
          subject?: string | null;
          reason: string;
          desired_username: string;
          status?: "pending" | "reviewing" | "approved" | "rejected";
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          department?: string | null;
          subject?: string | null;
          reason?: string;
          desired_username?: string;
          status?: "pending" | "reviewing" | "approved" | "rejected";
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      name_change_requests: {
        Row: {
          id: string;
          student_id: string;
          old_first_name: string;
          old_last_name: string;
          new_first_name: string;
          new_last_name: string;
          reason: string | null;
          status: "pending" | "approved" | "rejected";
          admin_note: string | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          old_first_name: string;
          old_last_name: string;
          new_first_name: string;
          new_last_name: string;
          reason?: string | null;
          status?: "pending" | "approved" | "rejected";
          admin_note?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          old_first_name?: string;
          old_last_name?: string;
          new_first_name?: string;
          new_last_name?: string;
          reason?: string | null;
          status?: "pending" | "approved" | "rejected";
          admin_note?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_conversations: {
        Row: {
          id: string;
          session_id: string;
          messages: Json;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          messages?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          session_id?: string;
          messages?: Json;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      agent_logs: {
        Row: {
          id: string;
          session_id: string | null;
          channel: string;
          user_id: string | null;
          user_role: string | null;
          user_message: string;
          tools_called: Json | null;
          response: string | null;
          latency_ms: number | null;
          error: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          channel: string;
          user_id?: string | null;
          user_role?: string | null;
          user_message: string;
          tools_called?: Json | null;
          response?: string | null;
          latency_ms?: number | null;
          error?: string | null;
          created_at?: string | null;
        };
        Update: {
          session_id?: string | null;
          channel?: string;
          user_id?: string | null;
          user_role?: string | null;
          user_message?: string;
          tools_called?: Json | null;
          response?: string | null;
          latency_ms?: number | null;
          error?: string | null;
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

      // ─── Phase 2 Student 360 (supabase/migrations/0011-0013) ──────────────
      guardians: {
        Row: {
          source: RecordSource;
          recorded_by: string | null;
          id: string;
          student_id: string;
          full_name: string;
          relationship: GuardianRelationship;
          phone: string | null;
          phone_alt: string | null;
          email: string | null;
          line_user_id: string | null;
          national_id: string | null;
          occupation: string | null;
          workplace: string | null;
          income_range: string | null;
          address: string | null;
          is_primary: boolean;
          is_emergency_contact: boolean;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          source?: RecordSource;
          recorded_by?: string | null;
          id?: string;
          student_id: string;
          full_name: string;
          relationship?: GuardianRelationship;
          phone?: string | null;
          phone_alt?: string | null;
          email?: string | null;
          line_user_id?: string | null;
          national_id?: string | null;
          occupation?: string | null;
          workplace?: string | null;
          income_range?: string | null;
          address?: string | null;
          is_primary?: boolean;
          is_emergency_contact?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          source?: RecordSource;
          recorded_by?: string | null;
          full_name?: string;
          relationship?: GuardianRelationship;
          phone?: string | null;
          phone_alt?: string | null;
          email?: string | null;
          line_user_id?: string | null;
          national_id?: string | null;
          occupation?: string | null;
          workplace?: string | null;
          income_range?: string | null;
          address?: string | null;
          is_primary?: boolean;
          is_emergency_contact?: boolean;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_education_history: {
        Row: {
          source: RecordSource;
          id: string;
          student_id: string;
          school_name: string;
          level: string | null;
          province: string | null;
          gpa: number | null;
          graduated_year: string | null;
          document_url: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          source?: RecordSource;
          id?: string;
          student_id: string;
          school_name: string;
          level?: string | null;
          province?: string | null;
          gpa?: number | null;
          graduated_year?: string | null;
          document_url?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          source?: RecordSource;
          school_name?: string;
          level?: string | null;
          province?: string | null;
          gpa?: number | null;
          graduated_year?: string | null;
          document_url?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };
      student_status_changes: {
        Row: {
          id: string;
          student_id: string;
          change_type: StudentChangeType;
          from_value: string | null;
          to_value: string | null;
          effective_date: string;
          academic_year: string | null;
          reason: string | null;
          document_url: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          change_type: StudentChangeType;
          from_value?: string | null;
          to_value?: string | null;
          effective_date?: string;
          academic_year?: string | null;
          reason?: string | null;
          document_url?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        // append-only โดยเจตนา แก้อดีตให้เพิ่มแถวใหม่ ไม่ใช่ UPDATE ทับ
        Update: Record<string, never>;
        Relationships: [];
      };
      student_achievements: {
        Row: {
          source: RecordSource;
          id: string;
          student_id: string;
          kind: AchievementKind;
          title: string;
          level: AchievementLevel | null;
          rank: string | null;
          organizer: string | null;
          event_name: string | null;
          event_date: string | null;
          academic_year: string | null;
          team_members: string | null;
          advisor_name: string | null;
          description: string | null;
          image_urls: string[] | null;
          document_url: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          source?: RecordSource;
          id?: string;
          student_id: string;
          kind?: AchievementKind;
          title: string;
          level?: AchievementLevel | null;
          rank?: string | null;
          organizer?: string | null;
          event_name?: string | null;
          event_date?: string | null;
          academic_year?: string | null;
          team_members?: string | null;
          advisor_name?: string | null;
          description?: string | null;
          image_urls?: string[] | null;
          document_url?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          source?: RecordSource;
          kind?: AchievementKind;
          title?: string;
          level?: AchievementLevel | null;
          rank?: string | null;
          organizer?: string | null;
          event_name?: string | null;
          event_date?: string | null;
          academic_year?: string | null;
          team_members?: string | null;
          advisor_name?: string | null;
          description?: string | null;
          image_urls?: string[] | null;
          document_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_positions: {
        Row: {
          id: string;
          student_id: string;
          position: string;
          scope: PositionScope;
          scope_ref: string | null;
          academic_year: string | null;
          started_on: string;
          ended_on: string | null;
          note: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          position: string;
          scope?: PositionScope;
          scope_ref?: string | null;
          academic_year?: string | null;
          started_on?: string;
          ended_on?: string | null;
          note?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          position?: string;
          scope?: PositionScope;
          scope_ref?: string | null;
          academic_year?: string | null;
          started_on?: string;
          ended_on?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };

      // ─── Phase 3 ครุภัณฑ์และแจ้งซ่อม (supabase/migrations/0014-0015) ──────
      assets: {
        Row: {
          id: string;
          asset_code: string | null;
          serial_number: string | null;
          name: string;
          category: string;
          brand: string | null;
          model: string | null;
          room_id: string | null;
          location_note: string | null;
          responsible_person: string | null;
          department: string | null;
          acquired_on: string | null;
          price: number | null;
          funding_source: string | null;
          condition: AssetCondition;
          status: AssetStatus;
          qr_token: string;
          image_urls: string[] | null;
          equipment_item_id: string | null;
          note: string | null;
          disposed_at: string | null;
          disposed_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_code?: string | null;
          serial_number?: string | null;
          name: string;
          category: string;
          brand?: string | null;
          model?: string | null;
          room_id?: string | null;
          location_note?: string | null;
          responsible_person?: string | null;
          department?: string | null;
          acquired_on?: string | null;
          price?: number | null;
          funding_source?: string | null;
          condition?: AssetCondition;
          status?: AssetStatus;
          qr_token?: string;
          image_urls?: string[] | null;
          equipment_item_id?: string | null;
          note?: string | null;
          disposed_at?: string | null;
          disposed_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          asset_code?: string | null;
          serial_number?: string | null;
          name?: string;
          category?: string;
          brand?: string | null;
          model?: string | null;
          room_id?: string | null;
          location_note?: string | null;
          responsible_person?: string | null;
          department?: string | null;
          acquired_on?: string | null;
          price?: number | null;
          funding_source?: string | null;
          condition?: AssetCondition;
          status?: AssetStatus;
          image_urls?: string[] | null;
          equipment_item_id?: string | null;
          note?: string | null;
          disposed_at?: string | null;
          disposed_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      asset_movements: {
        Row: {
          id: string;
          asset_id: string;
          from_room_id: string | null;
          to_room_id: string | null;
          from_location: string | null;
          to_location: string | null;
          from_person: string | null;
          to_person: string | null;
          moved_on: string;
          reason: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          from_room_id?: string | null;
          to_room_id?: string | null;
          from_location?: string | null;
          to_location?: string | null;
          from_person?: string | null;
          to_person?: string | null;
          moved_on?: string;
          reason?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        // append-only ห้าม UPDATE ทับ
        Update: Record<string, never>;
        Relationships: [];
      };
      maintenance_requests: {
        Row: {
          id: string;
          request_code: string;
          reporter_name: string;
          reporter_student_id: string | null;
          reporter_admin_id: string | null;
          reporter_phone: string | null;
          target_kind: MaintenanceTargetKind;
          asset_id: string | null;
          equipment_item_id: string | null;
          room_id: string | null;
          target_label: string | null;
          affected_quantity: number | null;
          location_note: string | null;
          category: MaintenanceCategory;
          symptom: string;
          urgency: MaintenanceUrgency;
          status: MaintenanceStatus;
          assigned_to: string | null;
          scheduled_on: string | null;
          cost: number | null;
          parts_note: string | null;
          completed_at: string | null;
          completion_note: string | null;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_code: string;
          reporter_name: string;
          reporter_student_id?: string | null;
          reporter_admin_id?: string | null;
          reporter_phone?: string | null;
          target_kind?: MaintenanceTargetKind;
          asset_id?: string | null;
          equipment_item_id?: string | null;
          room_id?: string | null;
          target_label?: string | null;
          affected_quantity?: number | null;
          location_note?: string | null;
          category?: MaintenanceCategory;
          symptom: string;
          urgency?: MaintenanceUrgency;
          status?: MaintenanceStatus;
          assigned_to?: string | null;
          scheduled_on?: string | null;
          cost?: number | null;
          parts_note?: string | null;
          completed_at?: string | null;
          completion_note?: string | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: MaintenanceStatus;
          urgency?: MaintenanceUrgency;
          category?: MaintenanceCategory;
          symptom?: string;
          affected_quantity?: number | null;
          location_note?: string | null;
          assigned_to?: string | null;
          scheduled_on?: string | null;
          cost?: number | null;
          parts_note?: string | null;
          completed_at?: string | null;
          completion_note?: string | null;
          admin_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      maintenance_photos: {
        Row: {
          id: string;
          request_id: string;
          phase: MaintenancePhotoPhase;
          image_url: string;
          caption: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          phase: MaintenancePhotoPhase;
          image_url: string;
          caption?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: { caption?: string | null };
        Relationships: [];
      };
      class_attendance: {
        Row: {
          id: string;
          class_schedule_id: string;
          student_id: string;
          attend_date: string;
          status: ClassAttendanceStatus;
          note: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_schedule_id: string;
          student_id: string;
          attend_date?: string;
          status?: ClassAttendanceStatus;
          note?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: ClassAttendanceStatus;
          note?: string | null;
          recorded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      class_assignments: {
        Row: {
          id: string;
          class_schedule_id: string;
          assigned_date: string;
          title: string;
          description: string | null;
          due_date: string | null;
          max_score: number | null;
          attachment_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_schedule_id: string;
          assigned_date?: string;
          title: string;
          description?: string | null;
          due_date?: string | null;
          max_score?: number | null;
          attachment_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          due_date?: string | null;
          max_score?: number | null;
          attachment_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      maintenance_status_history: {
        Row: {
          id: string;
          request_id: string;
          from_status: MaintenanceStatus | null;
          to_status: MaintenanceStatus;
          note: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          from_status?: MaintenanceStatus | null;
          to_status: MaintenanceStatus;
          note?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        // append-only ห้าม UPDATE ทับ
        Update: Record<string, never>;
        Relationships: [];
      };

      // ─── ศูนย์แจ้งเตือน (0022) ──────────────────────────────────────────
      notifications: {
        Row: {
          id: string;
          account_id: string;
          category_key: string;
          title: string;
          body: string | null;
          link: string | null;
          entity_type: string | null;
          entity_id: string | null;
          priority: NotificationPriority;
          read_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          category_key?: string;
          title: string;
          body?: string | null;
          link?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          priority?: NotificationPriority;
          read_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        // แก้ได้เฉพาะ read_at — เนื้อความที่ส่งไปแล้วต้องไม่ถูกเขียนทับ
        Update: { read_at?: string | null };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          account_id: string;
          category_key: string;
          in_app: boolean;
          line: boolean;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          category_key: string;
          in_app?: boolean;
          line?: boolean;
          updated_at?: string;
        };
        Update: {
          in_app?: boolean;
          line?: boolean;
          updated_at?: string;
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
