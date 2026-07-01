# data.go.kr ServiceKey 발급 (기상특보 PoC)

## 1. 회원가입

[공공데이터포털](https://www.data.go.kr) 회원가입

## 2. 활용신청 (자동승인)

아래 **두 서비스** 모두 신청 (동일 마이페이지 ServiceKey 사용):

| 서비스 | URL | PoC 용도 |
|--------|-----|----------|
| 기상특보 조회 | [15000415](https://www.data.go.kr/data/15000415/openapi.do) | `getPwnStatus` 특보현황 |
| 예보구역정보 조회 | [15057111](https://www.data.go.kr/data/15057111/openapi.do) | `getFcstZoneCd` → REG_ID 매핑 |

- 개발계정 · 운영계정 모두 **자동승인**
- 일 트래픽 **10,000건** (PoC·10분 Cron 충분)

## 3. `.env.local` 설정

```env
# 서버 전용 — 절대 클라이언트 노출 금지
DATA_GO_KR_SERVICE_KEY=
```

Encoding: 포털에서 **Decoding** 키를 복사해 그대로 넣거나, 401 시 Encoding 키로 교체.

Query 파라미터는 **`serviceKey`** (소문자) — `ServiceKey`는 HTTP 401.

`getFcstZoneCd`는 **`regSp`**(지상코드) 필수 — 미지정 시 HTTP 403. PoC는 `regSp=A`(전체 구역) 사용.

## 4. PoC 실행

```bash
cd dashboard/web
node scripts/kma/build-wrn-reg-id-map.mjs
node scripts/kma/poc-kma-warn-status.mjs
```

## 5. 출처 표기 (공공누리 1유형)

UI 연동 시 **「출처: 기상청」** 표기 필수.
