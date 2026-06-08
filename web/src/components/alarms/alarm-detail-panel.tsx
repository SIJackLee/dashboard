import { SectionCard } from "@/components/common/section-card";

const rows = [
  "알람 유형",
  "발생 시간",
  "축사",
  "컨트롤러",
  "메시지",
  "심각도",
  "상태",
];

const actionRows = ["담당자", "조치 내용", "조치 시간"];

export function AlarmDetailPanel() {
  return (
    <SectionCard title="알람 상세 정보">
      <dl className="space-y-3">
        {rows.map((label) => (
          <div key={label} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right">--</dd>
          </div>
        ))}
      </dl>

      <div className="my-4 border-t" />
      <p className="mb-2 text-sm font-medium">조치 정보</p>
      <dl className="space-y-3">
        {actionRows.map((label) => (
          <div key={label} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right">--</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-2">
        <button className="w-full rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          확인
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-md border py-2 text-sm hover:bg-muted">
            해제
          </button>
          <button className="rounded-md border py-2 text-sm hover:bg-muted">
            이력 보기
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
