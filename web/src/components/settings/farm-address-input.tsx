"use client";

import { useCallback, useState, useTransition } from "react";
import {
  geocodeFarmAddressAction,
  saveFarmAddressAction,
} from "@/lib/actions/app-settings-actions";
import type { FarmKey } from "@/lib/data/farm-key";
import { PageActionButton } from "@/components/common/page-action-button";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type AddressDraft = {
  addressText: string;
  lat: number | null;
  lng: number | null;
  sido: string;
  sigungu: string;
  addressDetail: string;
  geocodeSource: string;
};

export function addressDraftFromLocation(
  location: FarmLocationRow | null | undefined
): AddressDraft {
  if (!location) {
    return {
      addressText: "",
      lat: null,
      lng: null,
      sido: "",
      sigungu: "",
      addressDetail: "",
      geocodeSource: "",
    };
  }
  return {
    addressText: location.addressText,
    lat: location.lat,
    lng: location.lng,
    sido: location.sido,
    sigungu: location.sigungu,
    addressDetail: location.addressDetail ?? "",
    geocodeSource: location.geocodeSource,
  };
}

const ERROR_LABEL: Record<string, string> = {
  address_too_short: "주소를 4자 이상 입력하세요.",
  geocode_not_found:
    "주소를 찾을 수 없습니다. 도로명·지번을 확인하거나 KAKAO_REST_API_KEY 설정 후 다시 시도하세요.",
  forbidden: "수정 권한이 없습니다.",
  invalid: "입력값이 올바르지 않습니다.",
  invalid_coords: "좌표가 올바르지 않습니다.",
  unauthorized: "로그인이 필요합니다.",
};

type Props = {
  farmKey: FarmKey;
  location: FarmLocationRow | null | undefined;
  disabled?: boolean;
  compact?: boolean;
  onSaved?: () => void;
};

export function FarmAddressInput({
  farmKey,
  location,
  disabled = false,
  compact = false,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState(() => addressDraftFromLocation(location));
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(() => Boolean(location?.addressText));
  const [pending, startTransition] = useTransition();

  const runGeocode = useCallback(() => {
    const query = draft.addressText.trim();
    if (query.length < 4) {
      setVerified(false);
      setError(ERROR_LABEL.address_too_short);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await geocodeFarmAddressAction(query);
      if (!result.ok) {
        setVerified(false);
        setError(ERROR_LABEL[result.error] ?? "주소 검색에 실패했습니다.");
        return;
      }
      setDraft({
        addressText: result.addressText,
        lat: result.lat,
        lng: result.lng,
        sido: result.sido,
        sigungu: result.sigungu,
        addressDetail: result.addressDetail ?? "",
        geocodeSource: result.geocodeSource,
      });
      setVerified(true);
    });
  }, [draft.addressText]);

  const runSave = () => {
    const query = draft.addressText.trim();
    if (!query) {
      setVerified(false);
      setError(ERROR_LABEL.address_too_short);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveFarmAddressAction({
        lsindRegistNo: farmKey.lsindRegistNo,
        itemCode: farmKey.itemCode,
        address: query,
      });
      if (!result.ok) {
        setError(ERROR_LABEL[result.error ?? ""] ?? "저장에 실패했습니다.");
        return;
      }
      setVerified(true);
      onSaved?.();
    });
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <label className="block space-y-1.5">
        <span className={cn("font-medium", compact ? "text-xs" : dashboardUi.body)}>
          농장 주소
        </span>
        <input
          type="text"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          placeholder="예: 경기도 수원시 영통구 월드컵로 206"
          value={draft.addressText}
          disabled={disabled || pending}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              runGeocode();
            }
          }}
          onChange={(e) => {
            setVerified(false);
            setDraft((prev) => ({
              ...prev,
              addressText: e.target.value,
              lat: null,
              lng: null,
            }));
          }}
        />
      </label>

      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          <PageActionButton
            type="button"
            variant="outline"
            disabled={pending}
            className={compact ? "h-8 px-3 text-xs" : undefined}
            onClick={runGeocode}
          >
            {pending ? "검색 중…" : "주소 검색"}
          </PageActionButton>
          <PageActionButton
            type="button"
            variant="primary"
            disabled={pending}
            className={compact ? "h-8 px-3 text-xs" : undefined}
            onClick={runSave}
          >
            {pending ? "저장 중…" : "저장"}
          </PageActionButton>
        </div>
      ) : null}

      {error ? (
        <p className={cn("text-destructive", compact ? "text-xs" : dashboardUi.tableMeta)}>
          {error}
        </p>
      ) : verified && draft.addressText ? (
        <p className={cn("text-muted-foreground", compact ? "text-xs" : dashboardUi.tableMeta)}>
          주소를 확인했습니다.
        </p>
      ) : null}
    </div>
  );
}
