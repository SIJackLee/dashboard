import { FarmContentSkeleton } from "@/components/common/loading-skeletons";

/** /farm segment 로딩 — ScopeBar·탭 chrome은 layout 유지, 콘텐츠 슬롯만 skeleton */
export default function FarmLoading() {
  return <FarmContentSkeleton />;
}
