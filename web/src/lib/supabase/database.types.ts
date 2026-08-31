/**
 * Supabase 타입 계약(수기 유지 서브셋).
 *
 * 전체 스키마 대신, 대시보드가 실제로 호출하는 RPC 함수의 인자·반환만 정확히 선언한다.
 * Tables/Views는 permissive 인덱스 시그니처로 두어 `createClient<Database>`가
 * 유효하되 `.from()` 사용처(제네릭 미지정)는 기존과 동일하게 동작한다.
 *
 * 스키마가 커지면 CLI로 재생성 권장:
 *   supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** farm_trend_* RPC 공통 인자 (lsind/item + 기간 + 버킷). */
export type TrendRpcArgs = {
  p_lsind: string;
  p_item: string;
  p_from: string;
  p_to: string;
  p_bucket: string;
};

export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      farm_trend_history_json: {
        Args: TrendRpcArgs;
        Returns: Json;
      };
      farm_trend_history_by_controller_json: {
        Args: TrendRpcArgs;
        Returns: Json;
      };
      farm_trend_uplink_coverage_json: {
        Args: TrendRpcArgs;
        Returns: Json;
      };
    };
    Enums: {
      [key: string]: never;
    };
    CompositeTypes: {
      [key: string]: never;
    };
  };
};

/** 타입 계약이 아는 RPC 이름. */
export type TrendRpcName = keyof Database["public"]["Functions"];
