---
title: 14. 엔코더 인터페이스 둘 — BiSS-C
date: 2026-08-06 09:14:00 +0900
description: 하드웨어는 SSI 와 같은데 CRC 와 양방향 채널과 지연 보상을 얹었다. nE 와 nW 가 active low 라 코드에서 한 번만 뒤집어야 한다.
categories: [로봇 통신, 시리얼]
tags: [통신, biss-c, 엔코더, crc, rs422, cpp]
mermaid: true
math: true
---

> **기준 출처:** BiSS Interface 공식 사이트(iC-Haus)의 로열티 없는 개방 규격 문서와 프로토콜 설명, CRC 다항식, iC-Haus 의 BiSS 마스터와 슬레이브 IC 데이터시트(iC-MQ, iC-MB 등 공개 문서), 물리계층은 TIA/EIA-422-B / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [13. 엔코더 SSI](/posts/13-encoder-ssi/) | 다음 → [15. 엔코더 EnDat](/posts/15-encoder-endat/)

---

## 1. BiSS 가 SSI 에서 고친 것

[13편](/posts/13-encoder-ssi/)에서 SSI 의 문제 셋을 봤다. BiSS 는 그걸 정면으로 해결한다.

| SSI 의 문제 | BiSS-C 의 답 |
| --- | --- |
| 오류 검출이 없다 | CRC 를 프레임에 넣었다 |
| 단방향이라 엔코더에 명령을 못 보낸다 | 양방향 채널로 파라미터를 읽고 쓴다 |
| 왕복 지연을 보상하지 못한다 | 처리 시간과 지연을 보상한다 |
| 상태와 경고를 알려주지 못한다 | 에러와 경고 비트가 있다 |
| 규격이 없어 제조사마다 다르다 | 공개 규격이고 로열티가 없다 |

BiSS 는 Bidirectional Serial Synchronous 다. C 는 continuous mode 로 실시간 제어에 쓰는 형태다. B 모드도 있지만 실무에서는 C 가 표준이다.

개방 규격이라는 점이 학습에 유리하다. EnDat 은 HEIDENHAIN 사양이라 상세가 제한적인데 BiSS 는 프로토콜 문서를 무료로 볼 수 있다. 엔코더 프로토콜을 공부하려면 BiSS 부터 보는 게 낫다.

## 2. 선은 SSI 와 똑같다

```mermaid
flowchart LR
  M[마스터] -->|MA 쌍 Master Clock| S[슬레이브 엔코더]
  S -->|SLO 쌍 Slave Out| M
```

하드웨어가 SSI 와 호환된다. 같은 케이블에 같은 커넥터에 같은 RS-422 트랜시버를 쓴다. 달라진 건 그 위에 얹은 프로토콜뿐이다. 그래서 SSI 엔코더를 BiSS-C 로 교체하기가 상대적으로 쉽다. 배선은 그대로 두고 마스터 쪽 프로토콜만 바꾸면 된다. 다만 마스터 하드웨어가 BiSS 를 지원해야 한다.

양방향은 어떻게 되는가. SLO 는 슬레이브에서 마스터로 가는 한 방향인데, 마스터가 슬레이브에게 명령을 보내는 것은 MA 클럭 라인의 특정 구간을 데이터로 쓰는 방식으로 한다. 선을 추가하지 않고 양방향을 만든 것이다.

## 3. 프레임 구조

| 필드 | 비트 | 뜻 |
| --- | --- | --- |
| Ack | 가변 | 슬레이브가 준비될 때까지의 대기다. 길이가 가변이라 마스터가 Start 를 찾아야 한다 |
| Start | 1 | `1` 이고 여기부터 데이터가 시작된다 |
| CDS | 1 | Control Data Slave 로 양방향 레지스터 채널의 한 비트다 |
| 위치 데이터 | n (예를 들어 26) | MSB 부터 나간다 |
| nE (Error) | 1 | `0` 이 에러다. active low 다 |
| nW (Warning) | 1 | `0` 이 경고다 |
| CRC | 6 | 위치와 nE 와 nW 에 대한 CRC 이고 반전되어 전송된다 |
| Timeout | — | 다음 프레임 전 대기다. SSI 의 monoflop 에 해당한다 |

### nE 와 nW 는 active low 다

`nE` 가 1 이면 정상이고 0 이면 에러다. 이름 앞의 `n` 이 negated 를 뜻한다.

코드에서 `if (error_bit) fault();` 라고 쓰면 정상일 때 항상 폴트가 난다. 반대로 `if (!error_bit)` 를 빼먹으면 에러를 영영 보지 못한다. 후자가 훨씬 위험하다.

```cpp
struct BissStatus {
    bool error;      // nE 가 0 이면 true 다
    bool warning;    // nW 가 0 이면 true 다
};
inline BissStatus decode_status(bool nE, bool nW) {
    return { !nE, !nW };      // 여기서 한 번만 뒤집고 나머지 코드는 정상 논리로 쓴다
}
```

Ack 길이가 가변이라는 것의 함의도 있다. 마스터는 Start 비트인 `1` 을 만날 때까지 클럭을 계속 주면서 SLO 를 읽어야 한다. 고정 길이 SPI 전송으로는 안 되고 비트 스트림을 훑어 Start 를 찾는 로직이 필요하다. 이 때문에 소프트웨어 SPI 흉내로 BiSS 를 구현하는 게 SSI 보다 훨씬 까다롭다.

## 4. CRC-6 이 BiSS 에 더한 것

| 항목 | 값 |
| --- | --- |
| 생성 다항식 | $x^6 + x + 1$ 이고 비트로는 `1000011` 이다 |
| 초기값 | 0 |
| 대상 | 위치 데이터와 nE 와 nW |
| 전송 | 반전되어 나간다 |

차수 $r$ 이 6 이므로 [기초 07편](/posts/07-basics-error-detection/)의 이론이 그대로 적용된다.

| 오류 | 검출 |
| --- | --- |
| 1비트 오류 | 전부 잡는다 |
| 길이 6 이하 버스트 | 전부 잡는다 |
| 무작위 오류 미검출 확률 | 약 $2^{-6}$ 으로 1/64, 곧 1.6% 다 |

CRC-16 이나 CRC-32 에 비하면 약하다. 6비트뿐이라 미검출 확률이 1.6% 다. 그런데 이건 이미 오류가 난 프레임 중에서 통과할 확률이다. 실제로는 이렇게 된다.

$$P_{\text{미검출}} = P_{\text{프레임 오류율}} \times 0.016$$

프레임 오류율이 $10^{-6}$ 이면 미검출은 $1.6\times10^{-8}$ 이다. 1 kHz 로 읽으면 평균 약 17시간에 한 번 꼴이다.

안전이 걸린 축이면 이걸로 부족할 수 있다. 그래서 안전 적용에서는 두 개의 독립 위치 채널을 비교하거나 상위에서 타당성 검사를 추가하거나 안전 등급 인코더를 쓴다. 안전 등급 인코더는 안전 CRC 와 이중 채널을 갖는다.

```cpp
// comm_serial/biss_crc.hpp
// BiSS CRC-6 는 poly x^6+x+1 에 init 0 이고 결과는 반전되어 전송된다.
// 대상은 위치 데이터와 nE 와 nW 를 이어 붙인 비트열이다.
constexpr std::uint8_t biss_crc6(std::uint64_t data, std::uint8_t nbits) noexcept {
    std::uint8_t crc = 0;
    for (int i = nbits - 1; i >= 0; --i) {
        const std::uint8_t in = static_cast<std::uint8_t>((data >> i) & 1);
        const std::uint8_t fb = static_cast<std::uint8_t>(((crc >> 5) & 1) ^ in);
        crc = static_cast<std::uint8_t>((crc << 1) & 0x3F);
        if (fb) crc ^= 0x03;                 // x^6+x+1 의 하위 항이다
    }
    return static_cast<std::uint8_t>((~crc) & 0x3F);   // 반전해서 전송값과 비교한다
}
```

구현이 맞는지 반드시 실제 엔코더로 검증한다. 정지 상태에서 수백 프레임을 읽어 CRC 불일치가 0 인지 확인하는 게 가장 확실하다. 불일치가 나오면 비트 정렬, 반전 여부, CRC 대상 범위 순으로 의심한다.

## 5. 지연 보상이 제어에서 중요하다

[13편](/posts/13-encoder-ssi/)에서 본 왕복 지연 문제를 BiSS 는 규격 안에서 다룬다. 마스터가 클럭 엣지를 내면 케이블 편도 지연 뒤에 엔코더가 클럭을 받아 데이터를 내고, 다시 편도 지연 뒤에 마스터에 도착한다.

마스터가 이 지연을 측정해서 샘플링 시점을 옮기거나 더 높은 클럭을 쓸 수 있게 한다.

제어 관점에서 더 중요한 것은 위치가 언제 래치됐는지를 정확히 알 수 있다는 점이다. [기초 10편](/posts/10-basics-realtime-jitter/)의 지연 예산에서 이 항목이 추정이 아니라 측정값이 된다.

그리고 이걸 알면 외삽 보상도 가능하다.

$$\hat\theta(t_{\text{now}}) = \theta_{\text{측정}} + \hat\omega \times t_{\text{지연}}$$

속도 추정치로 지연만큼 앞당긴다. 지연이 정확히 알려져 있어야 쓸 수 있는 기법이다.

BiSS-C 는 최대 약 10 MHz 클럭을 지원한다. 케이블 길이에 따라 제한된다. SSI 보다 훨씬 빠르다. 26비트 위치에 오버헤드 약 15비트를 더해 41비트를 5 MHz 로 읽으면 8.2 µs 다. 1 kHz 루프의 0.8% 로 SSI 의 46 µs 보다 5배 이상 낫다.

## 6. 구현은 하드웨어 지원이 있으면 쓴다

BiSS 는 SSI 보다 구현이 까다롭다. 가변 Ack 와 CRC 와 양방향 때문이다.

| 방법 | 설명 | 언제 쓰나 |
| --- | --- | --- |
| 전용 마스터 IC | iC-Haus 등의 BiSS 마스터 칩을 쓴다 | 가장 확실하다. 부품비가 추가된다 |
| MCU 내장 주변장치 | 일부 모터 제어 MCU 가 BiSS 나 EnDat 인터페이스를 내장한다 | 있으면 최선이다 |
| SPI 와 소프트웨어 | 넉넉히 클럭을 주고 비트열을 파싱한다 | 저속이거나 개발용이다 |

```cpp
// comm_serial/biss_c_master.hpp — SPI 기반 소프트웨어 구현의 뼈대
class BissCMaster {
public:
    struct Frame {
        std::uint32_t position;
        bool error;      // nE 가 0 이다
        bool warning;    // nW 가 0 이다
        bool crc_ok;
    };

    std::optional<Frame> read() {
        // Ack 길이가 가변이므로 넉넉하게 클럭을 준다.
        // 필요 비트는 Ack 최대에 Start 1, CDS 1, 데이터 n, nE nW 2, CRC 6 을 더한 값이다
        std::array<std::uint8_t, 16> tx{}, rx{};
        const std::size_t n_bytes = (max_ack_bits_ + 2 + cfg_.data_bits + 8 + 7) / 8;
        if (!spi_.transfer({tx.data(), n_bytes}, {rx.data(), n_bytes})) return std::nullopt;

        // 비트열에서 Start 비트인 첫 1 을 찾아 정렬한다. 여기가 SSI 와 다른 부분이다
        const auto bits  = to_bitstream(rx, n_bytes * 8);
        const auto start = find_first_one(bits);
        if (!start) { ++stats_.no_start; return std::nullopt; }

        std::size_t p = *start + 1;               // Start 다음부터다
        const bool cds = bits[p++];  (void)cds;
        const std::uint32_t pos = take_bits(bits, p, cfg_.data_bits); p += cfg_.data_bits;
        const bool nE = bits[p++];
        const bool nW = bits[p++];
        const std::uint8_t crc_rx = static_cast<std::uint8_t>(take_bits(bits, p, 6));

        // CRC 대상은 위치와 nE 와 nW 다
        const std::uint64_t crc_input =
            (static_cast<std::uint64_t>(pos) << 2) | (nE << 1) | nW;
        const bool ok = (biss_crc6(crc_input, cfg_.data_bits + 2) == crc_rx);
        if (!ok) ++stats_.crc_errors;             // 이 카운터가 물리계층 품질 지표다

        const auto st = decode_status(nE, nW);
        return Frame{ pos, st.error, st.warning, ok };
    }
private:
    ISpiBus& spi_;
    struct { std::uint8_t data_bits; } cfg_;
    std::size_t max_ack_bits_{8};
    struct { std::uint32_t no_start{}, crc_errors{}; } stats_;
};
```

`crc_errors` 카운터가 이 인터페이스의 최대 이득이다. SSI 에서는 값이 이상한 것 같다로만 남던 것이 정확한 숫자가 된다. [기초 08편](/posts/08-basics-flow-control/)의 원칙대로 재전송 대신 감지에 투자하는 것이다. 그리고 CRC 가 틀린 프레임은 버리고 직전 값을 유지한다. 제어 루프에서 재전송할 시간은 없다.

## 7. 양방향 채널

프레임마다 1비트씩 흘려보내는 저속 부가 채널이다. 여러 프레임에 걸쳐 레지스터 읽기와 쓰기 명령을 실어 보낸다.

| 용도 | 예 |
| --- | --- |
| 엔코더 파라미터 읽기 | 분해능, 제조사, 시리얼 번호 |
| 설정 쓰기 | 영점 설정, 방향 반전 |
| 상세 진단 | 온도, 신호 품질, 오류 이력 |

제어 루프를 방해하지 않는다는 게 설계의 묘미다. 주기 데이터인 위치는 매 프레임 그대로 오고 비주기 데이터는 1비트씩 조금씩 흐른다. 이 발상이 EtherCAT 의 주기 데이터와 비주기 메일박스 분리와 같다. 규모만 다르다.

## 정리

- BiSS-C 는 SSI 의 문제를 정면으로 고쳤다. CRC 와 양방향과 지연 보상과 개방 규격이다.
- 하드웨어는 SSI 와 같다. RS-422 2쌍인 MA 와 SLO 이고 프로토콜만 다르다.
- 프레임은 가변 Ack, Start 1, CDS 1, 위치 n, nE 1, nW 1, CRC 6 이다.
- nE 와 nW 는 active low 라 0 이 에러와 경고다. 코드에서 한 번만 뒤집고 나머지는 정상 논리로 쓴다.
- Ack 길이가 가변이라 마스터가 비트열에서 Start 를 찾아 정렬해야 한다. SSI 보다 구현이 까다롭다.
- CRC-6 은 $x^6+x+1$ 이고 반전 전송이며 대상은 위치와 nE 와 nW 다. 6비트 버스트까지 100% 검출하고 미검출 확률은 약 1.6% 다.
- 안전 적용에는 CRC-6 만으로 부족할 수 있다. 이중 채널이나 타당성 검사나 안전 등급 인코더를 쓴다.
- 지연 보상으로 래치 시점을 정확히 안다. 지연 예산이 추정이 아니라 측정값이 되고 외삽 보상도 가능해진다.
- 최대 약 10 MHz 다. 26비트 프레임을 5 MHz 로 읽으면 8.2 µs 로 SSI 의 46 µs 보다 5배 이상 빠르다.
- 구현은 전용 IC 나 MCU 내장이나 SPI 와 소프트웨어 셋 중에서 고른다.
- `crc_errors` 카운터가 최대 이득이다. 이상한 것 같다가 숫자가 된다.
- 양방향 채널이 제어 루프를 방해하지 않으며 파라미터를 나른다. EtherCAT 의 PDO 와 메일박스 분리와 같은 발상이다.

## 참고

- [BiSS Interface — 개방 규격 (iC-Haus)](https://www.biss-interface.com/)
- [TI SLLA272 — The RS-485 Design Guide](https://www.ti.com/lit/an/slla272d/slla272d.pdf)
