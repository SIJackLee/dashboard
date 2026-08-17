# 집 PC FARM01 LIVE 시뮬

회사 MQTT/RS/`Operation/simulator` 원본 없이, 이 저장소만으로 FARM01/P00 LIVE를 올린다.

## 무엇을 하는가

`simulator/sim_pilot_farm01.py --mqtt` 가 v0x0C 79바이트를 EC2 브로커(`54.116.16.1:1883`) `sungil/FARM01/P00/raw`로 보낸다. RS/C/command_ack는 클라우드가 처리한다. `/cmd`를 구독해 thermo를 덮어쓴 뒤 즉시 `/raw`를 한 번 더 올린다.

대상 컨트롤러(iot-cloud FARM01 실측): `SP02:01:01`, `SP03:01:01`~`06`, `SP05:01:01`~`06`.

실측 규격(전부 `wire_ver=12` / 79바이트 live):

| 항목 | FARM01 실데이터 |
|------|-----------------|
| topic | `sungil/FARM01/P00/raw` |
| tempsC | 프로브 4개 |
| Channel A | `EC03` + 출력 + thermo 25.0/2.0/10/80 |
| Channel B | `EC02` + 출력 + thermo 24.0/1.5/5/90 (`SP02`는 없음) |
| Channel C | 비움 |

## 실행

`web/.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 가 있어야 한다.

```bash
cd dashboard
python simulator/sim_pilot_farm01.py --self-test
python simulator/sim_pilot_farm01.py --mqtt          # 54.116.16.1:1883 /raw + /cmd
python simulator/sim_pilot_farm01.py --mqtt --once
```

확인: 로컬 `http://localhost:3000/farm?lsind=FARM01&item=P00` 또는 배포본.

## 영향

| 항목 | 내용 |
|------|------|
| DB | 운영 `iot-cloud` `iot_room_state_raw` INSERT + decode |
| MQTT/EC2 | 사용 안 함 |
| 명령 downlink | **없음** — MQTT `…/cmd` 미구독. 아래 파이프라인 참고 |
| 충돌 | 현장 모듈이 같은 FARM01을 올리면 값이 섞임. 현재 FARM01 raw는 2026-08-14 이후 끊김 |

`--write` 없이 실행하면 INSERT 하지 않는다.

## 명령 왕복 (미구현)

요청 경로: `로컬 시뮬 → MQTT → EC2(RS/C/command_ack) → DB → 대시보드`.

| 단계 | 담당 | 현재 집 시뮬 |
|------|------|----------------|
| `/raw` publish | 통신모듈 / sim | DB 직접 INSERT (EC2 RS 우회) |
| `/cmd` subscribe | sim_fleet | 없음 |
| pending→sent | EC2 C.py | 시뮬과 무관 |
| sent→applied | EC2 command_ack | uplink thermo 4값 일치 필요 |

FARM01 실측(2026-08-11): `SET_CHANNEL_THERMO` pending→sent ≈1.3s, sent→applied ≈4s. 채널 A=`EC03` / B=`EC02`. 지금은 pending/sent 0, raw도 8/14 이후 없음.

