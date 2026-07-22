/** Shared Playwright helpers for farm/ops UI audits. */

export const ACK_PATTERNS = [
  /명령을 등록했습니다/,
  /통신모듈/,
  /장치 ACK/,
  /현장 반영 확인/,
  /현장 반영 완료/,
  /LIVE 설정값/,
  /LIVE 설정온도/,
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

export async function waitAck(page, timeoutMs = 20000) {
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

/** 목록 — 컨트롤러 카드 설정 패널 열기 */
export async function openListControllerSettings(page) {
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 30000,
  });
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

/** 설정 패널 scope 내에서 setpoint 변경 후 적용 */
export async function applyFromSettingsPanel(page, scope = page) {
  const setpointInput = scope.getByLabel("설정온도").first();
  await setpointInput.waitFor({ state: "visible", timeout: 15000 });

  const raw = await setpointInput.inputValue();
  const current = parseFloat(raw.replace(/[^\d.-]/g, ""));
  const next = Number.isFinite(current)
    ? Math.min(35, Math.max(15, current + 0.5))
    : 25;
  await setpointInput.fill(String(next));
  await setpointInput.press("Tab");

  const applyBtn = scope.getByRole("button", { name: "적용", exact: true }).first();
  await applyBtn.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(
    () => {
      const el = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "적용"
      );
      return el && !el.disabled;
    },
    null,
    { timeout: 20000 }
  );

  await applyBtn.click();
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
