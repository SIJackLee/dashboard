/** Shared Playwright helpers for farm/ops UI audits. */

export const ACK_PATTERNS = [
  /명령을 등록했습니다/,
  /명령 등록/,
  /통신모듈/,
  /장치 ACK/,
  /ACK 대기/,
  /현장 확인/,
  /현장 반영 확인/,
  /현장 반영 완료/,
  /LIVE 설정값/,
  /LIVE 설정온도/,
  /전송 대기/,
  /pending|sent|applied/i,
];

export async function login(page, { base, email, password }) {
  await page.context().clearCookies();
  await page.goto(`${base}/login`, { waitUntil: "load" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 30000,
  });
}

export async function waitAck(page, timeoutMs = 35000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText();
    if (ACK_PATTERNS.some((re) => re.test(body))) {
      return (
        body
          .split("\n")
          .find((line) => ACK_PATTERNS.some((re) => re.test(line)))
          ?.trim() ?? "ACK"
      );
    }
    await page.waitForTimeout(500);
  }
  throw new Error("ACK 배너/토스트 문구를 찾지 못했습니다.");
}

/** 목록 summary 로드 — 부하 직후 flake 대비 재시도 */
export async function waitBarnListReady(page, { timeoutMs = 45000 } = {}) {
  const summary = page.locator('[data-audit-region="barn-list-summary"]');
  await summary.first().waitFor({ state: "visible", timeout: timeoutMs });
  return summary;
}

/** 목록 — 컨트롤러 카드 설정 패널 열기 */
export async function openListControllerSettings(page) {
  await waitBarnListReady(page, { timeoutMs: 45000 });
  await page.waitForSelector('[data-tour-id="controller-gauge-metrics"]', {
    timeout: 45000,
  });

  const panel = page.locator('[data-audit-region="barn-list-accordion-panel"]').first();
  const settingsPill = page
    .locator(
      '[data-audit-region="barn-list-summary"] [data-tour-id="panel-pills"] button'
    )
    .filter({ hasText: /^설정$/ })
    .first();
  if (await settingsPill.isVisible().catch(() => false)) {
    await settingsPill.click();
  }
  await panel.waitFor({ state: "visible", timeout: 45000 });
}

/** @deprecated use openListControllerSettings */
export async function waitListSettingsPanel(page) {
  return openListControllerSettings(page);
}

/** 접힌 제어 섹션을 펼쳐 설정온도 입력이 클릭 가능하게 한다. */
export async function ensureControlSectionExpanded(scope) {
  const controlToggle = scope
    .locator('button[aria-expanded="false"]')
    .filter({ hasText: /^제어/ })
    .first();
  if (await controlToggle.isVisible().catch(() => false)) {
    await controlToggle.click();
  }
}

/** 설정 패널 scope 내에서 setpoint 변경 후 적용 */
export async function applyFromSettingsPanel(page, scope = page) {
  await ensureControlSectionExpanded(scope);

  // exact — range의 "설정온도 25℃"와 텍스트 입력 "설정온도"를 구분
  const setpointInput = scope.getByLabel("설정온도", { exact: true }).first();
  await setpointInput.waitFor({ state: "visible", timeout: 15000 });

  const readLiveSetpoint = async () => {
    const text = await scope.innerText();
    const m = text.match(/현재\s*([\d.]+)\s*℃/);
    return m ? parseFloat(m[1]) : null;
  };

  const pickNext = (draft, live, attempt) => {
    const base = Number.isFinite(live)
      ? live
      : Number.isFinite(draft)
        ? draft
        : 25;
    // 편차가 있으면 설정온도 상한 < 40 — 높은 값부터 고르면 clamp되어 dirty 미발생
    const deltas =
      base >= 30
        ? [-1, -0.5, -2, -3, 1, 0.5, 2]
        : [1, -1, 0.5, -0.5, 2, -2];
    const rotated = [
      ...deltas.slice(attempt - 1),
      ...deltas.slice(0, attempt - 1),
    ];
    const candidates = rotated
      .map((d) => Math.min(35, Math.max(15, Math.round((base + d) * 2) / 2)))
      .filter((v) => v !== base);
    return candidates[0] ?? (base >= 25 ? Math.max(15, base - 1) : Math.min(35, base + 1));
  };

  const applyBtn = scope.getByRole("button", { name: "적용", exact: true }).first();
  await applyBtn.waitFor({ state: "visible", timeout: 15000 });

  let next = 25;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const raw = await setpointInput.inputValue();
    const draft = parseFloat(raw.replace(/[^\d.-]/g, ""));
    const live = await readLiveSetpoint();
    next = pickNext(draft, live, attempt);
    // 모바일 viewport + sticky 헤더에서 click이 viewport 밖으로 실패할 수 있음
    await setpointInput.scrollIntoViewIfNeeded().catch(() => {});
    await setpointInput.focus();
    await setpointInput.fill("");
    await setpointInput.pressSequentially(String(next), { delay: 20 });
    await setpointInput.press("Tab");
    await page.waitForTimeout(500);

    const afterRaw = await setpointInput.inputValue();
    const after = parseFloat(afterRaw.replace(/[^\d.-]/g, ""));
    const liveAfter = await readLiveSetpoint();
    const enabled = await applyBtn.isEnabled().catch(() => false);
    if (
      enabled &&
      Number.isFinite(after) &&
      (liveAfter == null || after !== liveAfter)
    ) {
      break;
    }
    if (attempt === 5) {
      throw new Error(
        `Apply 버튼이 활성화되지 않음 (tried→${next}, after=${after}, live=${liveAfter})`,
      );
    }
  }

  await applyBtn.click({ timeout: 15000 });
  const ack = await waitAck(page);
  return { ack, setpoint: next };
}

/** 데스크톱 그리드 — 히트맵 → detail → 컨트롤러 → 설정 → 적용 */
export async function applyFromMapDetailPanel(page, mapPath, base) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}${mapPath}`, { waitUntil: "load" });
  await page.waitForSelector('[data-tour-id="heatmap"]', { timeout: 30000 });

  await page.locator('[data-tour-id="heatmap"] button').first().click();
  await page.waitForSelector('[data-tour-id="detail-panel"]', { timeout: 15000 });
  await page.locator('[data-tour-id="detail-panel-charts"] button').first().click();

  const settingsBtn = page
    .locator('[data-tour-id="detail-panel"]')
    .getByRole("button", { name: /^설정$/ })
    .first();
  await settingsBtn.waitFor({ state: "visible", timeout: 15000 });
  await settingsBtn.click();

  const panel = page.locator('[data-audit-region="barn-list-accordion-panel"]').first();
  await panel.waitFor({ state: "visible", timeout: 15000 });
  return applyFromSettingsPanel(page, panel);
}
