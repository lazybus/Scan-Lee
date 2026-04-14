export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      document_types: {
        Row: {
          id: string;
          owner_user_id: string | null;
          name: string;
          slug: string;
          description: string;
          prompt_template: string;
          field_definitions: Json;
          is_public: boolean;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id?: string | null;
          name: string;
          slug: string;
          description: string;
          prompt_template: string;
          field_definitions: Json;
          is_public?: boolean;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string | null;
          name?: string;
          slug?: string;
          description?: string;
          prompt_template?: string;
          field_definitions?: Json;
          is_public?: boolean;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          owner_user_id: string;
          document_type_id: string;
          original_name: string;
          mime_type: string;
          storage_bucket: string;
          storage_object_path: string;
          sha256: string;
          status: string;
          model_name: string | null;
          extracted_data: Json | null;
          reviewed_data: Json | null;
          raw_response: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          document_type_id: string;
          original_name: string;
          mime_type: string;
          storage_bucket?: string;
          storage_object_path: string;
          sha256: string;
          status?: string;
          model_name?: string | null;
          extracted_data?: Json | null;
          reviewed_data?: Json | null;
          raw_response?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          document_type_id?: string;
          original_name?: string;
          mime_type?: string;
          storage_bucket?: string;
          storage_object_path?: string;
          sha256?: string;
          status?: string;
          model_name?: string | null;
          extracted_data?: Json | null;
          reviewed_data?: Json | null;
          raw_response?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
