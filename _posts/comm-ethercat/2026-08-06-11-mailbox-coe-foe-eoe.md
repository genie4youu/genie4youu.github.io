---
title: 11. 메일박스 프로토콜, CoE와 FoE와 EoE와 SoE
date: 2026-08-06 12:11:00 +0900
description: 하나의 메일박스로 여러 프로토콜을 나른다. EoE는 케이블 하나로 제어와 IP 통신을 함께 하지만 사이클을 갉아먹는다.
categories: [로봇 통신, EtherCAT]
tags: [통신, ethercat, CoE, FoE, EoE, SDO, 메일박스]
---

> **기준 출처:** [ETG EtherCAT Technology](https://www.ethercat.org/en/technology.html) · ETG.1000 계열, ETG.5003 · [SOEM](https://github.com/OpenEtherCATsociety/SOEM) `ethercatcoe.c`, `ethercatfoe.c`, `ethercateoe.c`, `ethercatsoe.c` / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [10. 프로세스 데이터와 PDO 매핑](/posts/10-process-data-pdo-mapping/) | 다음 → [12. CiA 402 드라이브 기동 절차](/posts/12-coe-cia402-bringup/)

## 1. 주기와 비주기의 분리

07편에서 SyncManager가 두 모드였던 이유가 여기 있다.

| | 프로세스 데이터 | 메일박스 |
| --- | --- | --- |
| SM 모드 | 버퍼(3버퍼) | 메일박스(1버퍼 + 핸드셰이크) |
| 주기 | 매 사이클 | 필요할 때 |
| 확인 | 없다 (WKC만) | 있다 |
| 유실 | 허용. 최신값이 온다 | 불가 |
| 용도 | 위치, 명령, 상태 | 설정, 진단, 펌웨어 |

[CAN 12편](/posts/12-canopen-sdo-pdo/)의 SDO와 PDO 분리와 완전히 같은 발상이다. 확인이 필요한 것과 제때 와야 하는 것을 나눈다.

차이는 EtherCAT가 같은 프레임 안에서 둘을 함께 나른다는 것이다. 04편의 `M`(More) 비트로 Datagram을 이어 붙인다.

## 2. 메일박스 헤더

길이 2바이트, 주소 2바이트, 우선순위와 타입 2바이트 뒤에 프로토콜별 데이터가 온다. Type 필드가 어떤 프로토콜인지 구분한다.

| Type | 프로토콜 | 무엇 |
| --- | --- | --- |
| 1 | AoE | ADS over EtherCAT (Beckhoff 계열) |
| 2 | EoE | Ethernet over EtherCAT, TCP/IP 터널링 |
| 3 | CoE | CANopen over EtherCAT, SDO와 PDO와 EMCY |
| 4 | FoE | File over EtherCAT, 펌웨어 업데이트 |
| 5 | SoE | Servo Drive Profile over EtherCAT |
| 15 | VoE | Vendor specific |

하나의 메일박스로 여러 프로토콜을 나르고 Type 필드가 구분한다. 슬레이브가 어떤 프로토콜을 지원하는지는 ESI 파일이나 레지스터로 확인한다. SOEM은 `ec_slave[i].mbx_proto` 에 비트마스크로 넣어준다.

## 3. CoE, 가장 많이 쓴다

CANopen을 EtherCAT 메일박스 위에 얹은 것이다. CAN 폴더의 지식이 그대로 온다.

| CoE 서비스 | CAN 폴더 대응 |
| --- | --- |
| SDO 다운로드와 업로드 | 파라미터 읽기와 쓰기 |
| PDO 매핑 | `0x1600` / `0x1A00` |
| Emergency (EMCY) | 슬레이브가 오류를 먼저 알린다 |
| SDO Information | 객체 사전을 통째로 조회. CANopen에는 없던 기능 |
| 장치 프로파일 (CiA 402) | 12편 |

### SDO 사용

```cpp
// 읽기
std::uint16_t statusword{};
int size = sizeof(statusword);
int wkc = ec_SDOread(slave, 0x6041, 0x00, FALSE,
                     &size, &statusword, EC_TIMEOUTRXM);

// 쓰기
std::uint8_t mode = 8;   // CSP
wkc = ec_SDOwrite(slave, 0x6060, 0x00, FALSE,
                  sizeof(mode), &mode, EC_TIMEOUTRXM);

// wkc <= 0 이면 실패. abort 코드는 SOEM 의 ec_elist 에 쌓인다
if (wkc <= 0) {
    while (EcatError) log_error("%s", ec_elist2string());
}
```

`ec_elist2string()` 이 abort 코드를 문자열로 준다. CAN 12편의 abort 코드 표가 그대로 적용된다. 그리고 제어 루프 안에서 SDO를 호출하지 않는다. 여러 사이클이 걸린다.

### SDO Information

CANopen에는 없던 기능이다. 슬레이브에게 "네가 가진 객체 목록을 달라" 고 물을 수 있다.

```cpp
ec_ODlistt od_list{};
ec_OElistt oe_list{};
if (ec_readODlist(slave, &od_list) > 0) {
    for (int i = 0; i < od_list.Entries; ++i) {
        ec_readODdescription(i, &od_list);
        ec_readOE(i, &od_list, &oe_list);
        log_info("0x%04X: %s", od_list.Index[i], od_list.Name[i]);
    }
}
```

처음 보는 슬레이브를 파악할 때 아주 유용하다. ESI 파일이 없거나 매뉴얼이 부실할 때 장비가 스스로 자기 객체 목록을 알려준다. 시간이 오래 걸리므로 부팅 시 한 번이나 진단 도구에서만 쓴다.

## 4. FoE, 펌웨어 업데이트

파일을 통째로 전송한다. TFTP를 아주 단순화한 형태다. BOOT 상태에서만 동작하고 Read와 Write로 조각을 순서대로 보낸다. 펌웨어, 설정 파일, 로그 회수에 쓴다.

절차는 PREOP로 내리고, BOOT 상태로 전이하고, FoE로 펌웨어 파일을 전송하고, 슬레이브가 자체 검증 후 플래시에 쓰고, INIT으로 리셋해서 새 펌웨어로 부팅하는 순서다.

전원이 끊기면 벽돌이 된다. 대부분의 슬레이브가 이중 뱅크나 롤백을 갖지만 없는 제품도 있다. 업데이트 중 전원 안정성을 확보한다.

네트워크에 여러 슬레이브가 있어도 하나씩 업데이트한다. BOOT 상태에서는 프로세스 데이터가 안 도니 시스템 전체가 멈춘다.

## 5. EoE, TCP/IP를 터널링한다

[이더넷 03편](/posts/03-ip-tcp-udp-guarantees/)에서 예고한 것이다. EtherCAT 케이블 위로 일반 이더넷 프레임을 실어 나른다.

PC 마스터가 EtherCAT(`0x88A4`)로 슬레이브들과 통신하는 그 케이블 위에, 웹서버를 내장한 드라이브의 TCP/IP 트래픽이 EoE로 터널링된다. PC 브라우저로 그 드라이브의 설정 화면에 접속할 수 있다.

| 용도 | |
| --- | --- |
| 슬레이브의 웹 설정 화면 접속 | |
| 진단 도구 (제조사 전용 소프트웨어) | |
| 원격 디버깅 | |
| 별도 네트워크 배선 없이 IP 통신 | 케이블 하나로 두 세계 |

이더넷 03편의 결론을 실현하는 방법이다. EtherCAT로 제어하고 EoE로 TCP/IP를 터널링해서 설정과 진단을 하며 물리 배선을 하나로 유지한다.

주의할 점은 EoE 프레임이 대역폭과 사이클을 차지한다는 것이다. 웹 페이지를 로딩하는 동안 제어 사이클에 지터가 생길 수 있다. 대응은 셋이다. 운전 중에는 EoE를 안 쓰거나, 마스터가 EoE 프레임을 별도 사이클로 분리하거나, 대역폭을 제한한다. 안전이 걸린 시스템에서는 운전 중 EoE를 막는 게 안전하다.

## 6. SoE

CiA 402(CoE) 대신 쓰는 서보 프로파일이다. SERCOS 계열에서 왔다.

| | CoE + CiA 402 | SoE |
| --- | --- | --- |
| 파라미터 식별 | 인덱스와 서브인덱스 (`0x6040`) | IDN (S-0-0134 등) |
| 출신 | CANopen | SERCOS |
| 널리 쓰이나 | 훨씬 많다 | 일부 제조사 |

어느 쪽인지는 슬레이브가 정한다. ESI 파일이나 매뉴얼에서 확인한다. 대부분의 산업용 드라이브는 CoE와 CiA 402를 쓴다. 일부 드라이브는 둘 다 지원하는데 그때는 CoE를 고르는 게 이식성이 좋다.

## 7. AoE와 VoE

AoE는 Beckhoff의 ADS 프로토콜을 터널링하는 것이고 TwinCAT 환경에서 쓴다. VoE는 제조사가 자기 프로토콜을 정의한 것이라 이식성이 없다. VoE를 쓰는 기능에 의존하면 그 제조사에 묶인다. 대안이 있으면 CoE를 쓴다.

## 8. 메일박스가 사이클에 미치는 영향

메일박스도 프레임에 실린다. 프로세스 데이터와 같은 프레임에 Datagram으로 붙거나 별도 프레임으로 간다.

| 상황 | 영향 |
| --- | --- |
| 메일박스 폴링 (내용 없음) | 작다. 상태 확인 Datagram 몇 바이트 |
| SDO 하나 진행 중 | 요청과 응답이 여러 사이클에 걸친다 |
| FoE 펌웨어 전송 | BOOT 상태라 프로세스 데이터가 아예 안 돈다 |
| EoE 트래픽 | 프레임이 커지고 사이클이 흔들린다 |

마스터가 메일박스를 어떻게 처리하는지 확인한다. SOEM은 별도 스레드에서 처리하는 게 관례다. 제어 루프와 분리한다.

```cpp
// 제어 루프(고우선순위)와 메일박스(저우선순위)를 분리
void control_thread() {   // SCHED_FIFO 80, 1 kHz
    ec_send_processdata();
    ec_receive_processdata(EC_TIMEOUTRET);
    // 제어 연산
}
void mailbox_thread() {   // SCHED_OTHER 또는 낮은 RT 우선순위, 100 Hz
    check_slave_states();     // ec_readstate()
    process_pending_sdo();
    handle_emergency();
}
```

## 9. 진단

| 증상 | 원인 |
| --- | --- |
| SDO가 타임아웃 | 메일박스 SM 설정 오류, 슬레이브가 PREOP 이상이 아님, 상대가 응답 안 함 |
| SDO abort | `ec_elist2string()` 으로 이유 확인 |
| SDO가 가끔 실패 | 메일박스가 안 비었다. 재시도 간격을 둔다 |
| FoE 실패 | BOOT 상태가 아니다, 파일 형식, 슬레이브가 FoE 미지원 |
| EoE를 켰더니 사이클이 흔들린다 | 정상이다. 대역폭을 나눠 쓴다. 운전 중에는 끈다 |
| 슬레이브가 메일박스를 지원 안 함 | 단순 I/O 모듈. `ec_slave[i].mbx_l == 0` |

## 정리

- 메일박스는 비주기 통신 채널이고 프로세스 데이터와 같은 프레임에 함께 실린다
- CAN 12편의 SDO와 PDO 분리와 같은 발상이다
- 메일박스 헤더의 Type 필드로 프로토콜을 구분한다. AoE, EoE, CoE, FoE, SoE, VoE
- CoE가 주력이다. CANopen을 그대로 얹었고 SDO, PDO 매핑, EMCY, CiA 402를 쓴다
- `ec_elist2string()` 으로 abort 이유를 문자열로 얻는다
- SDO Information으로 객체 사전을 통째로 조회할 수 있다. 처음 보는 슬레이브 파악에 유용하다
- FoE는 펌웨어 업데이트용이고 BOOT 상태에서만 되며 그동안 시스템 전체가 멈춘다. 전원 안정성이 필수다
- EoE는 TCP/IP 터널링이다. 케이블 하나로 제어와 IP 통신을 함께 하지만 대역폭과 사이클을 차지하므로 운전 중에는 막는 게 안전하다
- SoE는 SERCOS 계열 서보 프로파일이고 대부분은 CoE와 CiA 402를 쓴다
- VoE에 의존하면 제조사에 묶인다
- 메일박스 처리를 제어 루프와 분리한다. 별도 저우선순위 스레드를 쓴다

## 참고

- [ETG — EtherCAT Technology](https://www.ethercat.org/en/technology.html)
- [SOEM — Simple Open EtherCAT Master](https://github.com/OpenEtherCATsociety/SOEM)
