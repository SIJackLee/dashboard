# 음성 AI 리포팅 PoC

## 목적
차트 화면(`view=chart`) 우측 하단 AI 버튼으로 **단일 농장** 환경 요약을  
마이크 질문 → STT → 권한 스코프 분석 → 요약 → TTS 음성 안내.

## 사용
1. `.env.local`에 `OPENAI_API_KEY` 설정
2. 농장 차트 탭 → 우측 하단 AI
3. **말하기** (최대 15초) 또는 텍스트 입력
4. 자막 + (옵션) 음성 재생

질문 예: `오늘 농장 상황 어때?` / `FARM02 상황 어때?`  
농장 미지정 시 URL 현재 농장. **한 요청 = 농장 1개**.

패널 내 **사운드 체크**(비프) / **마이크 테스트**(2초 녹음·재생)로  
스피커·자동재생·마이크 권한을 API 호출 없이 점검할 수 있습니다.

AI facts에는 축사유형 집계 + **활성 알람별 컨트롤러 식별**(`alarmItems`, 위험 우선 최대 24건)이 포함됩니다.  
「상황 어때?」→ 알람 건수, 「어느 컨트롤러?」→ `alarmItems`로 답합니다.

## API
- `POST /api/voice-report/ask`
  - JSON: `{ question, currentLsind, currentItem, withTts? }`
  - multipart: `audio`, `currentLsind`, `currentItem`, `durationSec`, `withTts`
- `GET /api/voice-report/usage`

## 모델 (기본)
- STT: `gpt-4o-mini-transcribe` (실패 시 `whisper-1`)
- Chat: `gpt-4o-mini`
- TTS: `tts-1` / voice `alloy` (`VOICE_TTS_VOICE`로 변경 가능)

키 없이 텍스트만 요청하면 **템플릿 요약**(과금 0). 음성 STT는 키 필수.

## 한도
- 월 soft $20 / hard $24 (메모리, 재시작 리셋)
- 녹음 ≤15초, 질문 ≤200자, 답변 ≤250자
- 분당 10 / 시간 60 / 쿨다운 2초

## 롤백
`VOICE_REPORT_ENABLED=false` 또는 FAB·API 제거. DB migration 없음.
