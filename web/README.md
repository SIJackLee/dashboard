# 스마트 축사 IoT 대시보드

IoT 축사 모니터링·제어 (Next.js · Supabase).

> **문서 전부:** [`docs/README.md`](docs/README.md)  
> **배포:** [`docs/CLOUD_DEPLOY.md`](docs/CLOUD_DEPLOY.md) — `commit → push → main → Vercel`

## 시작

```bash
cd web   # 저장소 루트가 dashboard/ 인 경우
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

검증: `npm test` · `npm run verify:design` · `npm run build`

## 스택

Next.js 16 · TypeScript · Tailwind · Supabase Auth/DB

상세·스키마·ARIA·허브 URL·매뉴얼은 **`docs/`만** 본다.
