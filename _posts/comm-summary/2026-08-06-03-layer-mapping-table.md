---
title: 03. 계층 대응표, 같은 개념 다른 이름
date: 2026-08-06 13:03:00 +0900
description: 여덟 개의 반복 패턴이 이 연재의 수확이다. 프로토콜 문법이 아니라 문제를 푸는 방식의 목록이다.
categories: [로봇 통신, 종합]
tags: [통신, 용어, 설계패턴, 비교]
---

> **기준 출처:** 앞 폴더들의 내용을 종합한 것 / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [02. 어느 것을 언제 고르나](/posts/02-protocol-selection-guide/) | 다음 → [04. 공통 실패 패턴 10가지](/posts/04-common-failure-patterns/)

## 1. 왜 이 표가 필요한가

[기초 01편](/posts/01-basics-what-comm-solves/)에서 프로토콜의 규칙들은 여섯 문제에 대한 서로 다른 답이라고 했다. 이제 그 답들을 한 표에 나란히 놓는다.

이 표를 익히면 처음 보는 프로토콜도 빠르게 읽힌다. "아, 이건 CAN의 SOF에 해당하는군" 하는 식이다.

## 2. 문제 ①에서 ⑥까지 대응표

### ① 도달, 전기적으로 닿기

| 개념 | I²C | SPI | RS-232 | RS-485 | CAN | EtherCAT |
| --- | --- | --- | --- | --- | --- | --- |
| 신호 형태 | 오픈 드레인 | 푸시풀 | 단선 ±12 V | 차동 A/B | 차동 CANH/CANL | 차동 (이더넷 쌍) |
| 논리 1 | HIGH (풀업) | HIGH | 음전압 (mark) | A>B | recessive | PHY가 처리 |
| 논리 0 | LOW (당김) | LOW | 양전압 (space) | A<B | dominant | |
| idle 상태 | HIGH | CS로 결정 | mark (음) | 페일세이프 필요 | 자동 recessive | 링크 유지 |
| 종단 | 풀업 저항 | 없다 | 없다 | 120 Ω × 2 | 120 Ω × 2 | 자동 (포트 닫힘) |

### ② 동기, 비트 경계 찾기

| 개념 | 동기식 | 비동기식 |
| --- | --- | --- |
| 클럭선을 준다 | SPI(SCLK), I²C(SCL), SSI/BiSS/EnDat | |
| 시작 표식으로 재정렬 | | UART(시작 비트), CAN(SOF) |
| 전이를 강제해 재동기 | | CAN(비트 스터핑 + SJW) |
| 인코딩으로 클럭 복원 | | 이더넷과 EtherCAT (4B/5B + PLL) |
| 오차 허용 | 무제한 | UART ±2%, CAN ±0.5% |

### ③ 경계, 메시지의 시작과 끝

| 방법 | 쓰는 곳 |
| --- | --- |
| 고정 길이 | SPI (CS가 경계) |
| 길이 필드 | 이더넷, CAN의 DLC, EtherCAT Datagram Len |
| 구분자와 이스케이프 | SLIP, PPP |
| 대역 밖 표식 | I²C(START/STOP), CAN(SOF/EOF + 스터핑 위반), SPI(CS) |
| 침묵 시간 | Modbus RTU (t3.5) |

### ④ 무결, 데이터가 맞는가

| 강도 | 방법 | 쓰는 곳 |
| --- | --- | --- |
| 없음 | | SPI |
| 매우 약함 | 수신 확인만 | I²C의 ACK (무결성이 아니다) |
| 약함 | 패리티 1비트 | UART 8E1 |
| 중간 | 체크섬 또는 LRC | Modbus ASCII |
| 강함 | CRC-6 | BiSS-C |
| 강함 | CRC-16 | Modbus RTU |
| 매우 강함 | CRC-15 + 4중 추가 검사 | CAN |
| 매우 강함 | CRC-32 + WKC + 포트 카운터 | EtherCAT |

### ⑤ 조정, 누가 언제 말하나

| 방식 | 원리 | 쓰는 곳 |
| --- | --- | --- |
| 마스터 독점 | 마스터가 클럭과 CS로 결정 | SPI, SSI/BiSS/EnDat |
| 주소 지명과 폴링 | 마스터가 부른 노드만 답한다 | I²C, Modbus |
| 프로토콜 규율 | "물어봐야 답한다" 를 소프트웨어가 지킨다 | RS-485 (전기적으로 못 푼다) |
| 비파괴 중재 | 와이어드 AND와 ID 우선순위 | CAN (I²C도 원리는 같다) |
| 충돌 후 재시도 | 랜덤 백오프 | 옛 이더넷 (CSMA/CD) |
| 큐잉 | 스위치가 순서를 정한다 | 표준 이더넷 |
| 전면 스케줄 | 프레임이 하나뿐이라 경쟁이 없다 | EtherCAT |

### ⑥ 시간, 언제까지 오나

| 수준 | 방법 | 쓰는 곳 |
| --- | --- | --- |
| 보장 없음 | | UART, I²C, 표준 이더넷 |
| 마스터가 결정 | 클럭을 직접 준다 | SPI (지터 ns) |
| 래치 시점 확정 | 첫 클럭 엣지에 값 고정 | SSI, BiSS, EnDat |
| 지연 보상 | 왕복 시간을 측정해 보정 | BiSS-C, EnDat 2.2 |
| 우선순위 기반 계산 | 블로킹과 간섭 | CAN |
| 거친 동기 | 동기 메시지 방송 | CANopen SYNC (수십에서 수백 µs) |
| 하드웨어 시각 동기 | 클럭 자체를 맞춘다 | EtherCAT DC (1 µs 미만), IEEE 1588 |

## 3. 같은 개념, 다른 이름

같은 것을 프로토콜마다 다르게 부른다. 이걸 알면 문서를 훨씬 빨리 읽는다.

| 개념 | I²C | SPI | UART | CAN | CANopen | EtherCAT |
| --- | --- | --- | --- | --- | --- | --- |
| 프레임 시작 | START 조건 | CS 하강 | 시작 비트 | SOF | | 프리앰블+SFD |
| 프레임 끝 | STOP 조건 | CS 상승 | 정지 비트 | EOF | | FCS + IFG |
| 주소 | 7비트 슬레이브 주소 | CS 핀 | Modbus 주소 | ID가 곧 메시지 내용 | COB-ID | 위치/설정/논리 주소 |
| 오류 검출 | 없다 | 없다 | 패리티 | CRC-15 + 4종 | CAN 그대로 | CRC-32 + WKC |
| 수신 확인 | ACK 비트 | 없다 | 없다 | ACK 슬롯 | CAN 그대로 | WKC |
| 흐름 제어 | 클럭 스트레칭 | 없다 | RTS/CTS | 중재가 대신 | | 메일박스 WKC |
| 상태 관리 | 없다 | 없다 | 없다 | 오류 FSM | NMT | ESM |
| 주기 데이터 | | | | 직접 설계 | PDO | PDO (프로세스 데이터) |
| 비주기 데이터 | | | | 직접 설계 | SDO | 메일박스 (CoE SDO) |
| 장비 명세 파일 | | | | | EDS, DCF | ESI, ENI |
| 동기 신호 | | | | | SYNC 객체 | SYNC0 (DC) |
| 워치독 | | | | 하트비트 | Heartbeat | SM 워치독 |
| 긴급 알림 | | | | | EMCY | EMCY (CoE) |

CANopen 열과 EtherCAT 열이 거의 같다. CoE가 CANopen을 그대로 얹었기 때문이다. CAN 폴더를 배우면 EtherCAT 폴더의 절반을 아는 셈이라고 한 이유가 이 표에 있다.

## 4. 반복해서 나타난 설계 패턴

서로 다른 프로토콜에서 같은 발상이 계속 나왔다. 이게 이 연재의 가장 가치 있는 수확이다.

### ① 와이어드 AND, "0이 이긴다"

I²C의 오픈 드레인은 충돌해도 안 타고 중재가 공짜다. CAN의 dominant와 recessive는 같은 원리를 차동 위에서 구현한 것이고, CAN의 Error Frame은 6비트 dominant로 모두에게 오류를 전파한다.

### ② 3버퍼, "읽는 쪽과 쓰는 쪽이 안 겹친다"

소프트웨어로는 [기초 08편](/posts/08-basics-flow-control/)의 `LatestValue` 이고, 하드웨어로는 [EtherCAT 07편](/posts/07-syncmanager-buffer-mailbox/)의 SyncManager 버퍼 모드다.

### ③ 동시 래치, "받는 시점과 반영 시점을 분리"

| 어디서 | 규모 |
| --- | --- |
| SPI 데이지 체인 | 보드 안, 약 30 µs |
| ADC의 CONVST 핀 | 보드 안 |
| CANopen SYNC | 네트워크, 수십에서 수백 µs |
| EtherCAT DC | 네트워크, 1 µs 미만 |

### ④ 비대칭 필터, "나빠지는 건 빠르게, 좋아지는 건 천천히"

CAN 오류 카운터는 오류에 +8, 성공에 −1을 하고, RTS/CTS 히스테리시스는 high와 low watermark를 다르게 두고, Bus Off는 지수 백오프를 쓴다.

### ⑤ 지연 보상, "거리를 알면 보정할 수 있다"

BiSS-C의 처리 시간 보상, EnDat 2.2의 전파 지연 보상, EtherCAT DC의 전파 지연 측정이 같은 발상이다.

### ⑥ 구조가 곧 검사, 계산 없이 검증

CAN의 Form Error는 고정 필드에 정해진 값이 안 오면 오류로 판정하고, 비트 스터핑 위반(6비트 연속)은 불가능한 패턴이라 오류 신호로 재활용된다. EnDat의 모드 명령 반전 중복, I²C의 START와 STOP(데이터로 만들 수 없는 신호)도 같은 부류다.

### ⑦ 주기 전송과 감지, "재전송 대신"

원칙은 기초 08편에서 나왔고, CANopen의 PDO와 Heartbeat, EtherCAT의 프로세스 데이터와 WKC와 SM 워치독이 그 구현이다.

### ⑧ 계층 FSM, "어느 상태에서든 폴트로"

CAN 오류 FSM, CiA 402 드라이브, EtherCAT ESM이 같은 구조다.

이 여덟 패턴이 "통신을 안다" 의 실체다. 프로토콜 문법이 아니라 문제를 푸는 방식의 목록이다. 새 프로토콜을 만나면 이 중 무엇을 어떻게 조합했는지 보면 된다.

## 5. 새 프로토콜을 만났을 때 읽는 순서

1. 물리계층은 무엇인가 (단선, 차동, 광, 거리, 절연) → ① 도달
2. 클럭선이 있나. 없으면 어떻게 동기하나 → ② 동기
3. 프레임 경계를 어떻게 정하나 → ③ 경계
4. 오류 검출은 무엇인가 (없음, 패리티, 체크섬, CRC, 다중) → ④ 무결
5. 여럿일 때 누가 언제 말하나 → ⑤ 조정
6. 최악 지연을 계산할 수 있나. 동시성 장치가 있나 → ⑥ 시간
7. 무엇을 중요하게 여겼고 그러느라 무엇을 포기했나

7번이 마지막 질문이다. 완벽한 프로토콜은 없고 어떤 맞교환을 했는지가 그 프로토콜의 정체다.

## 정리

- 같은 개념이 프로토콜마다 다른 이름을 갖는다. 대응표를 익히면 문서가 빨리 읽힌다
- CANopen과 EtherCAT CoE의 용어가 거의 같다. CAN 폴더가 EtherCAT 폴더의 절반이다
- 여덟 개의 반복 패턴이 이 연재의 수확이다. 와이어드 AND, 3버퍼, 동시 래치, 비대칭 필터, 지연 보상, 구조가 곧 검사, 주기 전송과 감지, 계층 FSM
- 새 프로토콜을 읽는 순서는 여섯 칸을 채우고 "무엇을 포기했나" 를 묻는 것이다

## 참고

- [NXP UM10204 — I²C-bus specification](https://www.nxp.com/docs/en/user-guide/UM10204.pdf)
- [Bosch CAN Specification 2.0](https://www.bosch-semiconductors.com/media/ip_modules/pdf_2/can2spec.pdf)
- [ETG — EtherCAT Technology](https://www.ethercat.org/en/technology.html)
