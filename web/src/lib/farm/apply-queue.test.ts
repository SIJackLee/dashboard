import assert from "node:assert/strict";
import {
  applyQueueGauge,
  applyQueueHandleLabel,
  applyQueueShouldAutoCollapse,
  applyQueueStage,
  applyQueueCaption,
  applyQueueStageCounts,
  isApplyQueueInWindow,
  isApplyQueueWatchStatus,
  selectApplyQueueCommands,
  formatApplyQueueTargetLine,
  formatApplyQueueTargetParts,
} from "./apply-queue";

{
  assert.equal(
    applyQueueStage({ status: "pending", liveConfirmed: false }),
    "접수",
  );
  assert.equal(
    applyQueueStage({ status: "sent", liveConfirmed: false }),
    "전송",
  );
  assert.equal(
    applyQueueStage({ status: "applied", liveConfirmed: false }),
    "수신",
  );
  assert.equal(
    applyQueueStage({ status: "applied", liveConfirmed: true }),
    "확인",
  );
  assert.equal(
    applyQueueStage({ status: "failed", liveConfirmed: false }),
    "실패",
  );
}

{
  assert.deepEqual(applyQueueGauge({ status: "pending", liveConfirmed: false }), {
    filled: 0,
    current: 1,
    rest: 3,
    fail: false,
  });
  assert.deepEqual(applyQueueGauge({ status: "sent", liveConfirmed: false }), {
    filled: 1,
    current: 1,
    rest: 2,
    fail: false,
  });
  assert.deepEqual(applyQueueGauge({ status: "applied", liveConfirmed: true }), {
    filled: 4,
    current: 0,
    rest: 0,
    fail: false,
  });
  assert.deepEqual(applyQueueGauge({ status: "failed", liveConfirmed: false }), {
    filled: 0,
    current: 1,
    rest: 3,
    fail: true,
  });
}

{
  assert.equal(applyQueueHandleLabel([]), "적용 큐 · 최근 1시간");
}

{
  const tickets = [
    { status: "pending" as const, liveConfirmed: false },
    { status: "applied" as const, liveConfirmed: true },
  ];
  assert.equal(applyQueueHandleLabel(tickets), "적용 2 · 접수");
  assert.equal(applyQueueShouldAutoCollapse(tickets, false), false);
  assert.deepEqual(applyQueueStageCounts(tickets), {
    접수: 1,
    전송: 0,
    수신: 0,
    확인: 1,
    실패: 0,
  });
}

{
  const done = [
    { status: "applied" as const, liveConfirmed: true },
    { status: "sent" as const, liveConfirmed: true },
  ];
  assert.equal(applyQueueHandleLabel(done), "적용 2 · 확인");
  assert.equal(applyQueueShouldAutoCollapse(done, false), true);
  assert.equal(applyQueueShouldAutoCollapse(done, true), false);
}

{
  const mixed = [
    { status: "applied" as const, liveConfirmed: true },
    { status: "failed" as const, liveConfirmed: false },
  ];
  assert.equal(applyQueueHandleLabel(mixed), "적용 2 · 실패 1");
  assert.equal(applyQueueShouldAutoCollapse(mixed, false), false);
}

{
  const parts = formatApplyQueueTargetParts({
    stallTyCode: "SP07",
    stallNo: "01",
    eqpmnNo: "01",
    channel: "A",
  });
  assert.equal(parts.stall, "비육사 1번 축사");
  assert.equal(parts.unit, "1번 컨트롤러");
  assert.equal(parts.channel, "채널 A");
  assert.equal(/SP\d{2}/.test(parts.stall), false);
  assert.equal(
    formatApplyQueueTargetLine({
      stallTyCode: "SP07",
      stallNo: "01",
      eqpmnNo: "01",
      channel: "A",
    }),
    "비육사 1번 축사 · 1번 컨트롤러 · 채널 A",
  );
  assert.equal(
    applyQueueCaption({ status: "sent", liveConfirmed: false }),
    "전송 · 2/4",
  );
}

{
  assert.equal(isApplyQueueWatchStatus("pending"), true);
  assert.equal(isApplyQueueWatchStatus("sent"), true);
  assert.equal(isApplyQueueWatchStatus("applied"), true);
  assert.equal(isApplyQueueWatchStatus("failed"), false);
  assert.equal(isApplyQueueWatchStatus("cancelled"), false);

  const farm = { lsindRegistNo: "A", itemCode: "B" };
  const other = { lsindRegistNo: "C", itemCode: "D" };
  const ctrl = { moduleUid: 1, controllerKey: "barn:01:01" };
  const nowMs = Date.parse("2026-01-01T00:30:00Z");
  const selected = selectApplyQueueCommands(
    [
      {
        id: "1",
        status: "pending" as const,
        createdAt: "2026-01-01T00:00:02Z",
        farmKey: farm,
        ...ctrl,
        channel: "A" as const,
      },
      {
        id: "2",
        status: "cancelled" as const,
        createdAt: "2026-01-01T00:00:03Z",
        farmKey: farm,
        ...ctrl,
        channel: "A" as const,
      },
      {
        id: "3",
        status: "sent" as const,
        createdAt: "2026-01-01T00:00:01Z",
        farmKey: other,
        ...ctrl,
        channel: "A" as const,
      },
      {
        id: "4",
        status: "applied" as const,
        createdAt: "2026-01-01T00:00:04Z",
        farmKey: farm,
        ...ctrl,
        channel: "A" as const,
      },
      {
        id: "5",
        status: "failed" as const,
        createdAt: "2026-01-01T00:00:05Z",
        farmKey: farm,
        ...ctrl,
        channel: "A" as const,
      },
      {
        id: "6",
        status: "pending" as const,
        createdAt: "2026-01-01T00:00:03Z",
        farmKey: farm,
        ...ctrl,
        channel: "B" as const,
      },
    ],
    farm,
    16,
    nowMs,
  );
  assert.deepEqual(
    selected.map((row) => row.id),
    ["4", "6"],
  );
}

{
  const farm = { lsindRegistNo: "A", itemCode: "B" };
  const ctrl = { moduleUid: 1, controllerKey: "barn:01:01" };
  const nowMs = Date.parse("2026-09-10T04:00:00Z");
  assert.equal(isApplyQueueInWindow("2026-09-10T03:00:00Z", nowMs), true);
  assert.equal(isApplyQueueInWindow("2026-09-10T02:59:59Z", nowMs), false);
  const windowed = selectApplyQueueCommands(
    [
      {
        id: "fresh",
        status: "applied" as const,
        createdAt: "2026-09-10T03:10:00Z",
        farmKey: farm,
        ...ctrl,
        channel: "A" as const,
      },
      {
        id: "old",
        status: "applied" as const,
        createdAt: "2026-09-10T02:50:00Z",
        farmKey: farm,
        ...ctrl,
        channel: "B" as const,
      },
    ],
    farm,
    16,
    nowMs,
  );
  assert.deepEqual(
    windowed.map((row) => row.id),
    ["fresh"],
  );
}
