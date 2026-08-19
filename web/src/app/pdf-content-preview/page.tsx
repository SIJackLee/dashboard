"use client";

import { useEffect, useRef } from "react";
import {
  renderDailyReportContentPreview,
  type DailyReportContentLayoutId,
} from "@/lib/report/build-daily-report-pdf";
import { dailyReportContentPreviewPayload } from "@/lib/report/daily-report-content-preview-fixture";

const LAYOUTS: {
  id: DailyReportContentLayoutId;
  title: string;
  pages: string;
  caption: string;
}[] = [
  {
    id: "brief",
    title: "A. 오늘 브리프",
    pages: "표지 1 + 축사 N",
    caption:
      "표지에는 오늘 판정·축사 목록·이상상황만. 축사는 24시간 차트와 컨트롤러 표. 첨부 없음.",
  },
  {
    id: "ops",
    title: "B. 운영 브리핑",
    pages: "표지 1 + 축사 N + 문제 장치만",
    caption:
      "표지에 농장 24시간. 축사는 24시간+7일. 통신 두절·수신 지연 장치만 첨부.",
  },
  {
    id: "archive",
    title: "C. 아카이브",
    pages: "표지 1 + 축사 N + 컨트롤러 전부",
    caption:
      "지금 다운로드와 같음. 24시간·7일·30일과 장치마다 첨부. 기록은 많지만 페이지가 깁니다.",
  },
];

function Column({
  id,
  title,
  pages,
  caption,
}: (typeof LAYOUTS)[number]) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.replaceChildren();
    const canvases = renderDailyReportContentPreview(
      id,
      dailyReportContentPreviewPayload(),
    );
    for (const canvas of canvases) {
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.display = "block";
      canvas.style.background = "#fff";
      canvas.style.border = "1px solid #e5e7eb";
      host.appendChild(canvas);
    }
  }, [id]);

  return (
    <section className="min-w-0">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-0.5 text-xs font-medium text-zinc-700">{pages}</p>
      <p className="mb-3 text-sm leading-6 text-zinc-600">{caption}</p>
      <div ref={ref} className="flex flex-col gap-3" />
    </section>
  );
}

export default function DailyReportContentPreviewPage() {
  return (
    <main className="min-h-full bg-zinc-100 px-5 py-7 text-zinc-900">
      <header className="mx-auto mb-8 max-w-[1400px]">
        <p className="text-xs font-medium tracking-wide text-zinc-500">
          오늘의 리포트 · 콘텐츠 시안
        </p>
        <h1 className="mt-1 text-2xl font-semibold">무엇을 넣을까</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          레터헤드는 공통입니다. 다른 점은 표지·축사·첨부에 넣는 내용입니다.
          다운로드는 아직 C안(현재)입니다. 고르신 뒤에 적용합니다.
        </p>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-3">
        {LAYOUTS.map((item) => (
          <Column key={item.id} {...item} />
        ))}
      </div>
    </main>
  );
}
