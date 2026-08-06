---
title: 06. FMMU, 논리 주소를 접는다
date: 2026-08-06 12:06:00 +0900
description: CPU의 MMU와 같은 발상을 하드웨어로. 비트 단위 매핑 덕에 디지털 I/O를 낭비 없이 채우고, 마스터 코드에서 통신이 사라진다.
categories: [로봇 통신, EtherCAT]
tags: [통신, ethercat, FMMU, IOmap, PDO, C++]
---

> **기준 출처:** [ETG EtherCAT Technology](https://www.ethercat.org/en/technology.html) · ESC 데이터시트 공개 사양 · [SOEM](https://github.com/OpenEtherCATsociety/SOEM) `ethercatconfig.c` / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [05. 주소 지정](/posts/05-addressing-auto-fixed-logical/) | 다음 → [07. SyncManager](/posts/07-syncmanager-buffer-mailbox/)

## 1. FMMU가 푸는 문제

05편에서 논리 주소의 이득을 봤다. 그런데 슬레이브 입장에서는 문제가 있다.

프레임이 지나갈 때 슬레이브는 "논리 주소 0x00001010부터 0x00001017이 내 물리 메모리 0x1200부터 0x1207이다" 를 알아야 한다. 그리고 그 판단을 비트가 흘러가는 80 ns 안에 해야 한다.

FMMU(Fieldbus Memory Management Unit)가 이 변환을 하드웨어로 한다. 이름 그대로 CPU의 MMU와 같은 발상이다. 가상 주소를 물리 주소로 옮긴다.

## 2. 구조

각 슬레이브의 ESC는 FMMU 엔트리를 여러 개(대개 4~8개) 갖는다. 하나가 이렇게 생겼다.

| 필드 | 크기 | 뜻 |
| --- | --- | --- |
| 논리 시작 주소 | 32비트 | 이 매핑이 담당하는 논리 주소 |
| 길이 | 16비트 | 몇 바이트 |
| 논리 시작 비트 | 3비트 | 비트 단위 정밀도 |
| 논리 끝 비트 | 3비트 | |
| 물리 시작 주소 | 16비트 | ESC 안의 메모리 주소 |
| 물리 시작 비트 | 3비트 | |
| 타입 | 1비트 | 읽기(입력) 또는 쓰기(출력) |
| 활성 | 1비트 | |

### 비트 단위 매핑이 왜 필요한가

디지털 I/O 모듈을 생각하면 명확하다. 8채널 디지털 입력 모듈 4개를 붙이면 각각 1바이트씩 4바이트다. 그런데 2채널 모듈이 섞여 있으면 2비트짜리를 바이트 경계에 맞출 때 6비트가 낭비된다.

FMMU가 비트 단위로 매핑하니 낭비 없이 촘촘하게 채운다. 8채널 다음에 2채널이 바로 이어지고 그다음 8채널이 이어지는 식으로 바이트 경계와 무관하게 배치된다.

디지털 I/O가 수백 채널인 시스템에서 이 절약이 실제로 의미가 있다. 프로세스 이미지가 작아지면 프레임이 짧아지고 사이클이 빨라진다.

대신 마스터 코드에서 비트 추출이 필요하다. SOEM은 `ec_slave[i].Ibits` 와 `Obits` 로 비트 수를 알려주고, 바이트 경계에 안 맞으면 직접 시프트해야 한다.

## 3. 어떻게 LRW 하나로 전부 처리되나

마스터가 논리 주소 0x00001000, 길이 96바이트짜리 LRW Datagram을 보낸다고 하자.

슬레이브 1의 FMMU[0]이 "논리 0x1000부터 0x1007은 물리 0x1200, 읽기" 이고 FMMU[1]이 "논리 0x1008부터 0x100F는 물리 0x1300, 쓰기" 라면, 그 슬레이브는 프레임의 0~7번째 바이트에 자기 입력을 써 넣고 8~15번째 바이트를 자기 출력으로 가져간다. 그리고 WKC를 3 올린다(읽기 1 + 쓰기 2).

슬레이브 2는 논리 0x1010부터를 담당하니 16~23번째 바이트를 처리한다. 나머지 바이트는 그대로 통과시킨다.

각 슬레이브가 "프레임의 어느 바이트가 내 것인지" 를 FMMU로 안다. 마스터는 슬레이브의 물리 메모리 배치를 전혀 몰라도 된다. 어떤 칩은 0x1000부터, 어떤 칩은 0x1200부터일 수 있는데 FMMU가 그 차이를 흡수한다.

### FMMU 개수가 제약이 된다

슬레이브당 FMMU가 4~8개뿐이고 보통 이렇게 쓴다.

| FMMU | 용도 |
| --- | --- |
| 0 | 프로세스 데이터 출력 (RxPDO) |
| 1 | 프로세스 데이터 입력 (TxPDO) |
| 2 | 메일박스 상태 (선택) |
| 3 이상 | 여분 |

프로세스 데이터가 여러 조각으로 흩어지면 FMMU가 모자랄 수 있다. 그래서 마스터는 연속된 블록으로 배치하려 애쓴다. SOEM의 `ec_config_map()` 이 이 배치를 자동으로 한다. 슬레이브를 순서대로 훑으며 논리 주소를 연속으로 할당하고 FMMU를 채운다.

## 4. 마스터에서 실제로 보이는 것

```cpp
static std::array<std::uint8_t, 4096> io_map;

void configure() {
    ec_config_init(FALSE);          // 05편의 ①②: 스캔 + 주소 배정
    // (여기서 PDO 매핑 등 CoE 설정 — 10·12편)
    ec_config_map(io_map.data());   // FMMU 설정 + IOmap 배치

    for (int i = 1; i <= ec_slavecount; ++i) {
        log_info("슬레이브 %d: %s", i, ec_slave[i].name);
        log_info("  입력 %d 바이트 @ IOmap+%td",
                 ec_slave[i].Ibytes, ec_slave[i].inputs  - io_map.data());
        log_info("  출력 %d 바이트 @ IOmap+%td",
                 ec_slave[i].Obytes, ec_slave[i].outputs - io_map.data());
    }
    log_info("전체 프로세스 이미지: %d 바이트",
             ec_slave[0].Obytes + ec_slave[0].Ibytes);
}
```

`ec_slave[i].inputs` 와 `.outputs` 가 io_map 내부를 가리키는 포인터다. 제어 루프는 이 포인터로 메모리를 읽고 쓸 뿐 FMMU도 논리 주소도 안 본다.

### 타입 안전하게 감싸기

날 포인터를 그대로 쓰면 오프셋 실수가 난다. 구조를 씌운다.

```cpp
// comm_ethercat/axis_io.hpp
// 기초 09편의 원칙 — 구조체를 memcpy 하지 않고 명시적 오프셋으로 접근
class AxisIo {
public:
    AxisIo(const std::uint8_t* in, std::uint8_t* out) : in_{in}, out_{out} {}

    // 입력 (TxPDO: 슬레이브 → 마스터)
    std::uint16_t statusword()      const { return get_u16_le(in_ + 0); }
    std::int32_t  position_actual() const { return get_i32_le(in_ + 2); }
    std::int32_t  velocity_actual() const { return get_i32_le(in_ + 6); }

    // 출력 (RxPDO: 마스터 → 슬레이브)
    void set_controlword(std::uint16_t v)    { put_u16_le(out_ + 0, v); }
    void set_target_position(std::int32_t v) { put_i32_le(out_ + 2, v); }

    // PDO 매핑과 이 오프셋이 일치해야 한다. 상수로 못박고 검증한다
    static constexpr std::size_t kInputBytes  = 10;
    static constexpr std::size_t kOutputBytes = 6;

private:
    const std::uint8_t* in_;
    std::uint8_t*       out_;
};

// 부팅 시 검증 — 크기가 안 맞으면 매핑이 예상과 다르다
bool verify_io_size(int slave) {
    return ec_slave[slave].Ibytes == AxisIo::kInputBytes
        && ec_slave[slave].Obytes == AxisIo::kOutputBytes;
}
```

`verify_io_size()` 가 중요하다. PDO 매핑이 예상과 다르면 `AxisIo` 의 오프셋이 전부 틀린다. 그러면 Statusword 자리에서 위치 값의 일부를 읽게 되고 상태 판별이 엉망이 된다. 크기 검증 하나로 이 부류가 통째로 걸러진다. [CAN 12편](/posts/12-canopen-sdo-pdo/)에서 CANopen PDO 매핑 검증을 넣은 것과 같은 이유다.

## 5. 입력과 출력은 논리 주소가 겹칠 수 있다

의외의 사실이다. 입력용 FMMU와 출력용 FMMU는 같은 논리 주소를 쓸 수 있다.

`LRW` 명령은 읽기와 쓰기를 동시에 한다. 프레임의 그 자리를 슬레이브가 읽어가고(출력) 동시에 자기 값을 써 넣는다(입력). 마스터로 돌아온 바이트는 슬레이브의 입력이 된다.

같은 자리를 쓰니 프로세스 이미지가 절반이 된다. 입출력 크기가 같은 장치에서 유용하다.

다만 SOEM을 포함한 여러 마스터는 입력과 출력을 분리된 영역에 두는 게 기본이다. 다루기 쉽고 크기가 다른 슬레이브가 많아서다. 설정에 따라 다르니 `ec_slave[i].inputs` 와 `.outputs` 포인터를 확인한다.

## 6. 진단

| 증상 | 원인 |
| --- | --- |
| `ec_config_map()` 후 크기가 예상과 다르다 | PDO 매핑이 예상과 다르다 (10편) |
| 엉뚱한 값이 읽힌다 | 오프셋 불일치. `verify_io_size()` 로 잡는다 |
| 특정 슬레이브만 데이터가 안 온다 | FMMU가 안 설정됐다. `FPRD` 로 FMMU 레지스터 확인 |
| `ec_config_map()` 이 실패 | IOmap 버퍼가 작다, FMMU 부족, SM 설정 오류 |
| WKC가 기대보다 작다 | FMMU 없는 슬레이브는 LRW를 처리하지 않아 WKC가 안 오른다 |

FMMU 설정을 직접 읽어 확인할 수 있다. `FPRD` 로 FMMU 레지스터 영역을 읽으면 논리와 물리 주소가 나온다. 마스터 라이브러리가 잘못 설정했는지 확인하는 최후 수단이다.

## 정리

- FMMU는 논리 주소를 물리 메모리로 변환한다. CPU의 MMU와 같은 발상을 하드웨어로 구현한 것이다
- 이것 덕에 `LRW` 하나가 모든 슬레이브를 처리한다. 마스터는 슬레이브의 물리 배치를 몰라도 된다
- 비트 단위 정밀도로 디지털 I/O를 바이트 경계 낭비 없이 촘촘하게 채운다. 대신 마스터 코드에서 비트 추출이 필요할 수 있다
- FMMU 개수가 4~8개로 제한되니 프로세스 데이터를 연속 블록으로 배치해야 하고 마스터가 자동으로 한다
- 마스터에서는 `io_map` 안을 가리키는 포인터로만 보인다. 제어 루프 코드에 통신이 안 보인다
- 날 포인터를 그대로 쓰지 말고 타입으로 감싸고, `verify_io_size()` 로 부팅 시 크기를 검증한다
- 매핑이 예상과 다르면 오프셋이 전부 틀려 Statusword 자리에서 엉뚱한 값을 읽는다
- `LRW` 는 같은 자리를 읽고 쓸 수 있어 입출력 논리 주소가 겹치면 이미지가 절반이 된다. 다만 마스터 설정에 따라 다르다
- WKC가 부족하면 FMMU 미설정 슬레이브를 의심한다

## 참고

- [ETG — EtherCAT Technology](https://www.ethercat.org/en/technology.html)
- [SOEM — Simple Open EtherCAT Master](https://github.com/OpenEtherCATsociety/SOEM)
