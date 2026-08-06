---
title: 13. ESI와 ENI 설정 파일
date: 2026-08-06 12:13:00 +0900
description: 슬레이브가 자기를 설명하는 EEPROM 덕에 마스터가 파일 없이 뜬다. "도구에서는 되는데 내 코드는 안 된다" 의 답은 대개 초기화 SDO 시퀀스다.
categories: [로봇 통신, EtherCAT]
tags: [통신, ethercat, ESI, ENI, SII, EEPROM, 버전관리]
---

> **기준 출처:** [ETG EtherCAT Technology](https://www.ethercat.org/en/technology.html) · ETG.2000(ESI), ETG.2100(ENI) 개요 · ESC 데이터시트의 SII/EEPROM 영역 설명 · [SOEM](https://github.com/OpenEtherCATsociety/SOEM) `ethercatmain.c` / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [12. CiA 402 드라이브 기동 절차](/posts/12-coe-cia402-bringup/) | 다음 → [14. 마스터 구현, SOEM 코드로 읽기](/posts/14-soem-master-implementation/)

## 1. 세 가지를 구분한다

이름이 비슷해서 헷갈리는데 누가 만들고 어디에 있는지가 다르다.

| | ESI | SII / EEPROM | ENI |
| --- | --- | --- | --- |
| 전체 이름 | EtherCAT Slave Information | Slave Information Interface | EtherCAT Network Information |
| 만드는 이 | 제조사 | 제조사 (출고 시 기록) | 설정 도구 |
| 형식 | XML 파일 | 슬레이브 안의 EEPROM 바이너리 | XML 파일 |
| 어디에 | 마스터 PC | 슬레이브 자신 | 마스터 PC |
| 내용 | 그 장비 종류의 전체 명세 | 그 명세의 일부 | 네트워크 전체 구성 + 마스터의 사이클 명령 |
| CANopen 대응 | EDS | 없음 | DCF에 가깝다 |

차이는 이렇다. ESI와 SII는 이 장비가 무엇을 할 수 있는지(능력)를 말하고, ENI는 이 시스템을 어떻게 돌릴 것인지(설정)를 말한다.

## 2. ESI, 제조사가 주는 XML

```xml
<!-- 구조만 보이기 위한 예시. 실제 파일은 훨씬 길다 -->
<EtherCATInfo>
  <Vendor>
    <Id>#x00000002</Id>
    <Name>Example Vendor</Name>
  </Vendor>
  <Descriptions>
    <Devices>
      <Device>
        <Type ProductCode="#x00001234" RevisionNo="#x00010000">EX-SERVO-01</Type>

        <!-- SyncManager 정의 (07편) -->
        <Sm StartAddress="#x1000" ControlByte="#x26" DefaultSize="128">MBoxOut</Sm>
        <Sm StartAddress="#x1400" ControlByte="#x22" DefaultSize="128">MBoxIn</Sm>
        <Sm StartAddress="#x1800" ControlByte="#x24">Outputs</Sm>
        <Sm StartAddress="#x1C00" ControlByte="#x20">Inputs</Sm>

        <!-- PDO 정의 (10편) -->
        <TxPdo Fixed="0" Sm="3">
          <Index>#x1A00</Index>
          <Name>Position feedback</Name>
          <Entry><Index>#x6041</Index><SubIndex>0</SubIndex><BitLen>16</BitLen>
                 <Name>Statusword</Name></Entry>
          <Entry><Index>#x6064</Index><SubIndex>0</SubIndex><BitLen>32</BitLen>
                 <Name>Position actual value</Name></Entry>
        </TxPdo>

        <!-- DC 설정 (09편) -->
        <Dc>
          <OpMode>
            <Name>DC-Synchron</Name>
            <AssignActivate>#x0300</AssignActivate>
            <CycleTimeSync0 Factor="1">0</CycleTimeSync0>
          </OpMode>
        </Dc>

        <!-- 메일박스 지원 프로토콜 (11편) -->
        <Mailbox>
          <CoE SdoInfo="true" PdoAssign="true" PdoConfig="true"/>
          <FoE/>
        </Mailbox>
      </Device>
    </Devices>
  </Descriptions>
</EtherCATInfo>
```

| 항목 | 어디서 쓰이나 |
| --- | --- |
| Vendor ID와 Product Code | 구성 검증 (05편) |
| SyncManager 정의 | SM 설정 (07편) |
| PDO 정의 (`Fixed` 속성 포함) | 매핑 (10편). 고정과 가변 여부도 여기 |
| DC OpMode | DC 설정 (09편). `AssignActivate` 값이 중요 |
| 메일박스 프로토콜 | 11편 |
| 객체 사전 (일부) | SDO 접근 |
| 초기화 명령 시퀀스 | 부팅 시 자동 실행할 SDO 목록 |

`AssignActivate` 값이 DC 설정에 필수다. 이 값을 레지스터 `0x0981` 에 써야 SYNC0이 동작한다. ESI 없이 손으로 하려면 데이터시트에서 이 값을 찾아야 한다. SOEM은 ESI를 읽지 않으므로 DC를 쓸 때 `ec_dcsync0()` 가 표준값을 쓴다. 슬레이브가 특수한 값을 요구하면 직접 써야 한다.

## 3. SII와 EEPROM, 슬레이브 자신이 갖고 있는 정보

ESI의 일부가 슬레이브의 EEPROM에 기록되어 있다.

| 카테고리 | 내용 |
| --- | --- |
| 헤더 | PDI 설정, ESC 설정 |
| General | Vendor ID, Product Code, Revision, Serial Number |
| SyncManager | SM 기본 설정 |
| FMMU | FMMU 개수와 용도 |
| TxPDO / RxPDO | PDO 정의 (있는 경우) |
| 문자열 | 이름 |

이것 덕에 마스터가 ESI 파일 없이도 슬레이브를 파악할 수 있다. 부팅하면서 `APRD` 로 각 슬레이브의 EEPROM을 읽어 Vendor ID와 Product Code와 SM/FMMU 정보를 얻고, CoE의 SDO Information으로 PDO 매핑을 읽으면 설정이 끝난다.

SOEM이 정확히 이 방식으로 동작한다. ESI 파일이 없어도 `ec_config_init()` 과 `ec_config_map()` 만으로 네트워크가 뜬다. 오픈소스 마스터가 가볍게 만들어질 수 있는 이유다.

### SII는 ESI의 부분집합이다

| SII에 있다 | SII에 없다 |
| --- | --- |
| Vendor, Product, Revision | 사람이 읽는 상세 설명 |
| SM과 FMMU 기본값 | 초기화 명령 시퀀스 |
| PDO 정의 (있으면) | DC OpMode 세부 설정 |
| | 객체 사전 전체 |

그래서 복잡한 슬레이브는 ESI가 필요할 수 있다. 특히 부팅 시 자동으로 써야 하는 SDO 시퀀스가 있는 장비는 ESI 없이 손으로 재현해야 한다. ESI의 `<InitCmds>` 나 `<Mailbox><CoE><InitCmd>` 절을 보면 부팅 시 무엇을 쓰는지 나온다. 그걸 코드로 옮긴다.

## 4. ENI, 네트워크 설정 파일

설정 도구가 ESI들과 실제 네트워크 스캔 결과와 사용자 설정을 조합해 만든다. 마스터는 그 파일을 읽어 동작한다.

| 항목 | |
| --- | --- |
| 슬레이브 목록과 순서 | |
| 각 슬레이브의 설정 명령 (SM, FMMU, 초기화 SDO) | |
| 사이클 명령 목록 | 매 사이클 어떤 Datagram을 어떤 순서로 보낼지 |
| 프로세스 이미지 배치 | 논리 주소 할당 |
| DC 설정 | |

ENI에서 실제로 쓰이는 것은 사이클 명령 목록이다. 마스터가 런타임에 계산하지 않고 미리 만들어진 명령을 그대로 실행한다. 결정적이고 빠르다.

### ENI를 쓰는 마스터와 안 쓰는 마스터

| | ENI 기반 (TwinCAT 등) | 런타임 스캔 (SOEM 등) |
| --- | --- | --- |
| 설정 | 도구로 미리 생성 | 부팅 때 스캔 |
| 유연성 | 구성이 바뀌면 재생성 | 자동 적응 |
| 시작 시간 | 빠르다 | 스캔 시간이 든다 |
| 결정성 | 명령이 고정 | 스캔 후엔 같다 |
| 복잡한 슬레이브 | ESI의 모든 기능 활용 | 손으로 보완 |
| 개발 편의 | 도구 필요 | 코드만으로 |

학습과 포트폴리오에는 SOEM이 낫다. 파일 없이 코드만으로 동작하고 무슨 일이 일어나는지 코드에서 다 보인다. 실무 시스템에서는 ENI 기반이 흔하다. 특히 복잡한 슬레이브가 섞였거나 인증이 필요한 경우다.

## 5. 버전 관리, 흔한 사고

| 문제 | 무슨 일 |
| --- | --- |
| ESI 버전과 슬레이브 펌웨어 버전이 다르다 | 객체가 없거나 매핑이 달라 SDO abort, SAFEOP 실패 |
| Revision Number 불일치 | 마스터가 슬레이브를 인식 못 하거나 경고 |
| 슬레이브 펌웨어를 올렸는데 ESI는 그대로 | 새 기능을 못 쓰거나 오작동 |
| ESI를 여러 버전 갖고 있다 | 도구가 엉뚱한 걸 고른다 |

Revision Number를 어떻게 다룰지가 실무의 골칫거리다. 엄격하게 비교하면 펌웨어를 올릴 때마다 ENI를 재생성해야 하고, 느슨하게 하면 실제로 다른 장비가 들어와도 모른다. 05편의 구성 검증에서 Revision을 어디까지 볼지 정책을 정한다.

```cpp
// 정책 예: Vendor 와 Product 는 엄격, Revision 은 하위 16비트만 무시
bool device_matches(int slave, const ExpectedSlave& e) {
    if (ec_slave[slave].eep_man != e.vendor_id)    return false;
    if (ec_slave[slave].eep_id  != e.product_code) return false;
    // Revision 상위 16비트(메이저)만 비교
    return (ec_slave[slave].eep_rev >> 16) == (e.revision >> 16);
}
```

그리고 실제 Revision을 반드시 로그에 남긴다. 나중에 "그때 어떤 펌웨어였나" 를 알 수 있어야 한다.

## 6. 실무 팁

### ESI 파일 관리

```
프로젝트/
├── esi/                          ← 버전 관리에 넣는다
│   ├── VendorA_ServoDrive_v1.2.xml
│   └── VendorB_IOModule_v3.0.xml
├── config/
│   └── expected_slaves.yaml      ← 05편의 구성 검증 데이터
└── src/
```

ESI를 소스 저장소에 함께 넣는다. 재현성은 "그때 어떤 ESI로 만들었나" 에 달려 있다. 제조사 웹사이트에서 다시 받으면 버전이 달라져 있을 수 있다.

### 슬레이브를 처음 만났을 때

1. ESI 파일을 구한다 (제조사 웹사이트 또는 문의)
2. SOEM의 slaveinfo 예제로 스캔한다. Vendor, Product, Revision, SM/FMMU, PDO 목록이 나온다
3. SDO Information으로 객체 사전을 조회한다
4. ESI와 대조한다. 일치하는가
5. 매뉴얼에서 필수 초기화 파라미터를 찾는다
6. 코드로 옮긴다

2번과 3번이 ESI 없이도 상당히 멀리 간다. 슬레이브가 자기를 설명해주기 때문이다. ESI는 사람이 읽을 설명과 초기화 시퀀스를 위해 주로 필요하다.

### EEPROM을 고칠 수 있나

가능하지만 위험하다. SII와 EEPROM을 잘못 쓰면 슬레이브가 인식 안 되는 상태가 될 수 있고 일부 ESC는 EEPROM이 깨지면 부팅 자체를 못 한다. 꼭 필요한 경우(예: Station Alias 설정, 제조사 지시)에만 원본을 백업한 뒤에 한다. SOEM의 `eepromtool` 예제가 읽기와 쓰기를 제공한다.

## 7. 진단

| 증상 | 원인 |
| --- | --- |
| 슬레이브 이름이 이상하게 나온다 | ESI가 없거나 SII만 읽었다. 정상일 수 있다 |
| Revision 불일치 경고 | 펌웨어와 ESI 버전 차이 |
| SDO abort `0x06020000` (객체 없음) | ESI와 펌웨어 버전 불일치 |
| SAFEOP 실패인데 매핑은 맞다 | 초기화 SDO 시퀀스를 안 보냈다. ESI의 InitCmds 확인 |
| 도구에서는 되는데 내 코드는 안 된다 | 도구가 ESI의 초기화 명령을 보내고 있다 |
| EEPROM을 쓴 뒤 슬레이브가 안 보인다 | EEPROM 손상. 제조사 문의 |

"도구에서는 되는데 내 코드는 안 된다" 가 이 편의 대표 증상이다. 답은 대개 ESI의 초기화 명령 시퀀스다. ESI XML에서 `InitCmd` 를 검색하면 어느 전이(IP, PS, SO)에서 어떤 객체에 무엇을 쓰는지가 나온다. 그걸 12편의 B 단계에 옮긴다.

## 정리

- 세 가지를 구분한다. ESI(제조사 XML, 장비 명세), SII/EEPROM(슬레이브 안에 기록된 정보), ENI(설정 도구가 만든 네트워크 구성)
- CANopen의 EDS와 DCF와 같은 역할이다
- ESI에는 SM, PDO, DC, 메일박스, 초기화 명령이 들어 있다. `AssignActivate` 값이 DC 설정에 필수다
- SII 덕에 마스터가 ESI 없이도 슬레이브를 파악할 수 있다. SOEM이 파일 없이 동작하는 이유다
- SII는 ESI의 부분집합이라 초기화 SDO 시퀀스와 DC 세부 설정이 빠져 있다
- ENI에는 사이클 명령 목록이 들어 있다. 마스터가 런타임 계산 없이 미리 만들어진 명령을 실행한다
- 학습과 포트폴리오는 SOEM이 낫고 실무는 ENI 기반이 흔하다
- 버전 불일치가 흔한 사고다. Revision을 어디까지 비교할지 정책을 정하고 실제 값을 로그에 남긴다
- ESI 파일을 소스 저장소에 함께 넣는다
- "도구에서는 되는데 내 코드는 안 된다" 면 ESI의 초기화 명령 시퀀스를 찾아 옮긴다
- EEPROM 쓰기는 위험하다. 꼭 필요할 때만 백업 후에 한다

## 참고

- [ETG — EtherCAT Technology](https://www.ethercat.org/en/technology.html)
- [SOEM — Simple Open EtherCAT Master](https://github.com/OpenEtherCATsociety/SOEM)
