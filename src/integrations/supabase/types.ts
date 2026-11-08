export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          changed_by: string | null;
          created_at: string;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string | null;
          table_name: string;
        };
        Insert: {
          action: string;
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      credit_limits: {
        Row: {
          created_at: string;
          created_by: string | null;
          credit_days: number;
          credit_limit: number;
          customer_id: string;
          effective_from: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          credit_days?: number;
          credit_limit: number;
          customer_id: string;
          effective_from?: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          credit_days?: number;
          credit_limit?: number;
          customer_id?: string;
          effective_from?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_limits_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_limits_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customer_summary";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_ledger_entries: {
        Row: {
          created_at: string;
          created_by: string | null;
          credit: number;
          customer_id: string;
          debit: number;
          entry_date: string;
          entry_type: string;
          id: string;
          note: string | null;
          payment_id: string | null;
          sale_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          credit?: number;
          customer_id: string;
          debit?: number;
          entry_date: string;
          entry_type: string;
          id?: string;
          note?: string | null;
          payment_id?: string | null;
          sale_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          credit?: number;
          customer_id?: string;
          debit?: number;
          entry_date?: string;
          entry_type?: string;
          id?: string;
          note?: string | null;
          payment_id?: string | null;
          sale_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_ledger_entries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_ledger_entries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customer_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_ledger_entries_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_ledger_entries_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_ledger_entries_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "v_invoice_balances";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_payments: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          id: string;
          import_job_id: string | null;
          is_sample: boolean;
          is_void: boolean;
          method: string | null;
          payment_date: string;
          reference: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          id?: string;
          import_job_id?: string | null;
          is_sample?: boolean;
          is_void?: boolean;
          method?: string | null;
          payment_date: string;
          reference?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          id?: string;
          import_job_id?: string | null;
          is_sample?: boolean;
          is_void?: boolean;
          method?: string | null;
          payment_date?: string;
          reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customer_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_price_history: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_id: string;
          effective_date: string;
          id: string;
          import_job_id: string | null;
          is_void: boolean;
          price: number;
          product_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          effective_date: string;
          id?: string;
          import_job_id?: string | null;
          is_void?: boolean;
          price: number;
          product_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          effective_date?: string;
          id?: string;
          import_job_id?: string | null;
          is_void?: boolean;
          price?: number;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_price_history_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_price_history_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customer_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_price_history_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_price_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          category: string;
          code: string | null;
          contact_person: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          import_job_id: string | null;
          is_active: boolean;
          is_sample: boolean;
          name: string;
          phone: string | null;
          town: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          address?: string | null;
          category?: string;
          code?: string | null;
          contact_person?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          import_job_id?: string | null;
          is_active?: boolean;
          is_sample?: boolean;
          name: string;
          phone?: string | null;
          town?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string | null;
          category?: string;
          code?: string | null;
          contact_person?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          import_job_id?: string | null;
          is_active?: boolean;
          is_sample?: boolean;
          name?: string;
          phone?: string | null;
          town?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          created_by: string | null;
          expense_date: string;
          id: string;
          note: string | null;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          created_by?: string | null;
          expense_date: string;
          id?: string;
          note?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          expense_date?: string;
          id?: string;
          note?: string | null;
        };
        Relationships: [];
      };
      import_jobs: {
        Row: {
          created_at: string;
          created_by: string | null;
          duplicate_rows: number;
          error_rows: number;
          errors: Json | null;
          file_name: string;
          id: string;
          reversed_at: string | null;
          reversed_by: string | null;
          status: string;
          target_table: string;
          total_rows: number;
          valid_rows: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          duplicate_rows?: number;
          error_rows?: number;
          errors?: Json | null;
          file_name: string;
          id?: string;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: string;
          target_table: string;
          total_rows?: number;
          valid_rows?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          duplicate_rows?: number;
          error_rows?: number;
          errors?: Json | null;
          file_name?: string;
          id?: string;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: string;
          target_table?: string;
          total_rows?: number;
          valid_rows?: number;
        };
        Relationships: [];
      };
      inventory_snapshots: {
        Row: {
          avg_cost: number;
          created_at: string;
          created_by: string | null;
          godown: string;
          id: string;
          import_job_id: string | null;
          is_void: boolean;
          product_id: string;
          quantity_kg: number;
          snapshot_date: string;
        };
        Insert: {
          avg_cost: number;
          created_at?: string;
          created_by?: string | null;
          godown: string;
          id?: string;
          import_job_id?: string | null;
          is_void?: boolean;
          product_id: string;
          quantity_kg: number;
          snapshot_date: string;
        };
        Update: {
          avg_cost?: number;
          created_at?: string;
          created_by?: string | null;
          godown?: string;
          id?: string;
          import_job_id?: string | null;
          is_void?: boolean;
          product_id?: string;
          quantity_kg?: number;
          snapshot_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_snapshots_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      market_prices: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          import_job_id: string | null;
          is_void: boolean;
          price: number;
          price_date: string;
          product_id: string;
          source_name: string | null;
          source_type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          import_job_id?: string | null;
          is_void?: boolean;
          price: number;
          price_date: string;
          product_id: string;
          source_name?: string | null;
          source_type?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          import_job_id?: string | null;
          is_void?: boolean;
          price?: number;
          price_date?: string;
          product_id?: string;
          source_name?: string | null;
          source_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_prices_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_allocations: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          id: string;
          payment_id: string;
          sale_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          payment_id: string;
          sale_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          payment_id?: string;
          sale_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "v_invoice_balances";
            referencedColumns: ["id"];
          },
        ];
      };
      product_cost_history: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_date: string;
          id: string;
          import_job_id: string | null;
          is_void: boolean;
          landed_cost: number;
          product_id: string;
          source: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_date: string;
          id?: string;
          import_job_id?: string | null;
          is_void?: boolean;
          landed_cost: number;
          product_id: string;
          source?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          id?: string;
          import_job_id?: string | null;
          is_void?: boolean;
          landed_cost?: number;
          product_id?: string;
          source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_cost_history_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_cost_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          import_job_id: string | null;
          is_active: boolean;
          is_sample: boolean;
          name: string;
          pack_size_kg: number | null;
          sku: string | null;
          unit: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          import_job_id?: string | null;
          is_active?: boolean;
          is_sample?: boolean;
          name: string;
          pack_size_kg?: number | null;
          sku?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          import_job_id?: string | null;
          is_active?: boolean;
          is_sample?: boolean;
          name?: string;
          pack_size_kg?: number | null;
          sku?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          created_at: string;
          created_by: string | null;
          freight_per_kg: number;
          godown: string | null;
          id: string;
          is_sample: boolean;
          product_id: string;
          purchase_date: string;
          quantity_kg: number;
          supplier_id: string | null;
          unit_cost: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          freight_per_kg?: number;
          godown?: string | null;
          id?: string;
          is_sample?: boolean;
          product_id: string;
          purchase_date: string;
          quantity_kg: number;
          supplier_id?: string | null;
          unit_cost: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          freight_per_kg?: number;
          godown?: string | null;
          id?: string;
          is_sample?: boolean;
          product_id?: string;
          purchase_date?: string;
          quantity_kg?: number;
          supplier_id?: string | null;
          unit_cost?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_items: {
        Row: {
          created_at: string;
          id: string;
          line_total: number;
          product_id: string;
          quantity_kg: number;
          sale_id: string;
          unit_cost: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          line_total: number;
          product_id: string;
          quantity_kg: number;
          sale_id: string;
          unit_cost: number;
          unit_price: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          line_total?: number;
          product_id?: string;
          quantity_kg?: number;
          sale_id?: string;
          unit_cost?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "v_invoice_balances";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_id: string;
          due_date: string | null;
          id: string;
          import_job_id: string | null;
          invoice_no: string | null;
          is_sample: boolean;
          is_void: boolean;
          payment_type: string;
          sale_date: string;
          total_amount: number;
          total_cost: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          due_date?: string | null;
          id?: string;
          import_job_id?: string | null;
          invoice_no?: string | null;
          is_sample?: boolean;
          is_void?: boolean;
          payment_type?: string;
          sale_date: string;
          total_amount?: number;
          total_cost?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          due_date?: string | null;
          id?: string;
          import_job_id?: string | null;
          invoice_no?: string | null;
          is_sample?: boolean;
          is_void?: boolean;
          payment_type?: string;
          sale_date?: string;
          total_amount?: number;
          total_cost?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customer_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_sample: boolean;
          name: string;
          phone: string | null;
          town: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_sample?: boolean;
          name: string;
          phone?: string | null;
          town?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_sample?: boolean;
          name?: string;
          phone?: string | null;
          town?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_customer_summary: {
        Row: {
          category: string | null;
          code: string | null;
          contact_person: string | null;
          credit_days: number | null;
          credit_limit: number | null;
          gross_profit: number | null;
          id: string | null;
          invoice_count: number | null;
          is_sample: boolean | null;
          last_purchase_date: string | null;
          name: string | null;
          outstanding: number | null;
          overdue: number | null;
          phone: string | null;
          total_cost: number | null;
          total_sales: number | null;
          town: string | null;
        };
        Relationships: [];
      };
      v_invoice_balances: {
        Row: {
          allocated: number | null;
          created_at: string | null;
          created_by: string | null;
          customer_id: string | null;
          due_date: string | null;
          id: string | null;
          import_job_id: string | null;
          invoice_no: string | null;
          is_sample: boolean | null;
          is_void: boolean | null;
          payment_type: string | null;
          sale_date: string | null;
          total_amount: number | null;
          total_cost: number | null;
          unpaid: number | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customer_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      apply_allocated_payment_import: {
        Args: { _file: string; _rows: Json };
        Returns: string;
      };
      apply_import: {
        Args: { _file: string; _rows: Json; _type: string };
        Returns: string;
      };
      apply_import_financial: {
        Args: { _file: string; _rows: Json; _type: string };
        Returns: string;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_finance: { Args: { _user_id: string }; Returns: boolean };
      reverse_import: { Args: { _job: string }; Returns: boolean };
      reverse_import_financial: { Args: { _job: string }; Returns: boolean };
      save_customer: { Args: { _id: string; _values: Json }; Returns: string };
      set_team_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "owner" | "management" | "staff";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "management", "staff"],
    },
  },
} as const;
