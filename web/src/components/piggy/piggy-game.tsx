"use client";

import Script from "next/script";
import { AppNavLink } from "@/components/layout/app-nav-link";
import "./piggy-game.css";

declare global {
  interface Window {
    __PIGGY_CONFIG__?: {
      playerId?: string;
      fixedPlayer?: boolean;
      requireSettingsId?: boolean;
      settingsUrl?: string;
    };
  }
}

type Props = {
  playerId?: string;
  fixedPlayer?: boolean;
  requireSettingsId?: boolean;
  settingsUrl?: string;
};

export function PiggyGame({
  playerId,
  fixedPlayer = false,
  requireSettingsId = false,
  settingsUrl = "/settings?tab=dashboard",
}: Props) {
  const configJson = JSON.stringify({
    playerId,
    fixedPlayer,
    requireSettingsId,
    settingsUrl,
  });

  const hidePlayerField = fixedPlayer || requireSettingsId;

  return (
    <div className="piggy-root">
      <div className="piggy-root__hud" aria-live="polite">
        <div className="piggy-root__brand">
          <span className="piggy-root__title">Piggy Jump</span>
          <span className="piggy-root__subtitle">
            {fixedPlayer && playerId
              ? `아이디: ${playerId}`
              : "돼지 점프 · IoT Board 오락"}
          </span>
        </div>
        <div className="piggy-root__scores">
          <div className="piggy-root__score-item">
            <span className="piggy-root__score-label">SCORE</span>
            <span id="score">0</span>
          </div>
          <div className="piggy-root__score-item">
            <span className="piggy-root__score-label">BEST</span>
            <span id="best">0</span>
          </div>
        </div>
      </div>

      <div className="piggy-root__stage">
        <canvas
          id="game"
          width={1350}
          height={540}
          aria-label="돼지 점프 게임 화면"
          role="img"
        />

        <section id="startScreen" className="start" aria-label="시작 화면">
          <div
            className="start__card"
            role="dialog"
            aria-modal="true"
            aria-label="게임 시작"
          >
            <div className="start__header">
              <h2 id="startTitle" className="start__title">
                Piggy Jump
              </h2>
              <p id="startSubtitle" className="start__subtitle">
                돼지는 달리고, 진흙은 튀고, BLEON은 씻어줍니다.
              </p>
              <div className="start__desc">
                <p>장애물은 점프!</p>
                <p>진흙은 BLEON으로 샤워!</p>
                <p>새끼돼지와 금화는 냉큼 획득!</p>
                <p>환풍기를 밟으면 잠깐 무적!</p>
              </div>
              <p id="startHint" className="start__hint">
                <strong>SPACE</strong> 또는 <strong>터치</strong>로 시작
              </p>
            </div>

            {requireSettingsId ? (
              <p id="settingsPrompt" className="start__settings-prompt">
                게임 아이디가 설정되어 있지 않습니다.{" "}
                <AppNavLink href={settingsUrl} message="설정 페이지로 이동 중…">
                  설정 페이지
                </AppNavLink>에서 아이디를 등록한 뒤
                다시 시작해 주세요.
              </p>
            ) : null}

            <div className="start__controls">
              <label className="field field--compact">
                <span className="field__label">테마</span>
                <select
                  id="theme"
                  className="field__input"
                  aria-label="게임 테마 선택"
                  defaultValue="farm"
                >
                  <option value="farm">Farm</option>
                  <option value="space">Space</option>
                  <option value="factory">Factory</option>
                  <option value="candy">Candy</option>
                </select>
              </label>

              <label className="field field--compact">
                <span className="field__label">랜덤</span>
                <span className="toggle">
                  <input id="randomTheme" type="checkbox" defaultChecked />
                  <span className="toggle__pill" aria-hidden="true" />
                  <span className="toggle__text">테마 랜덤</span>
                </span>
              </label>

              {!hidePlayerField ? (
                <label className="field start__player">
                  <span className="field__label">아이디(닉네임)</span>
                  <input
                    id="playerId"
                    className="field__input"
                    maxLength={20}
                    placeholder="예: piggy_01"
                    defaultValue={playerId ?? ""}
                  />
                </label>
              ) : (
                <input
                  id="playerId"
                  type="hidden"
                  defaultValue={playerId ?? ""}
                  readOnly
                  aria-hidden
                  tabIndex={-1}
                />
              )}

              <button
                id="startBtn"
                className="btn"
                type="button"
                disabled={requireSettingsId}
              >
                시작하기
              </button>
            </div>

            <p id="boardMsg" className="muted" aria-live="polite" />

            <div className="start__board">
              <div className="start__boardTitle">전체 등수</div>
              <ol id="leaderboard" className="board" aria-label="전체 등수 목록" />
            </div>
          </div>
        </section>

        <section className="help" aria-label="조작 안내">
          <div className="help__row">
            <span className="kbd">SPACE</span> / <span className="kbd">↑</span> /{" "}
            <span className="kbd">터치</span>
            <span className="help__text">점프</span>
            <span className="kbd">P</span>
            <span className="help__text">일시정지</span>
            <span className="kbd">R</span>
            <span className="help__text">재시작</span>
          </div>
        </section>
      </div>

      <Script
        id="piggy-config"
        key={`piggy-cfg-${playerId ?? "none"}-${requireSettingsId ? "req" : "ok"}`}
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.__PIGGY_CONFIG__=${configJson};`,
        }}
      />
      <Script src="/piggy/game.js" strategy="afterInteractive" />
    </div>
  );
}
