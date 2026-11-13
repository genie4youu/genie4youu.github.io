---
title: 00. 다중 모드 제어 — 시리즈 목차
date: 2026-11-12 14:00:00 +0900
description: 제어기를 여러 개 두고 갈아타는 구조를 형식, 전환 순간, 안정성, 모드 논리의 설계와 검증, 고장 모드까지 차례로 정리한다.
categories: [제어 이론, 목차]
tags: [목차, fsm, stateflow, 제어]
mermaid: true
---

> **기준 출처:** 각 편의 출처를 따른다. 이 글은 연재의 지도다 / 확인일 2026-11-12

## 이 연재가 답하는 질문

제어기 하나로 모든 상황을 감당할 수 없을 때 제어기를 여러 개 두고 갈아탄다. 그러면 새 문제가 생긴다. 언제 갈아타는가, 갈아타는 순간 입력이 튀지 않게 하려면 무엇을 넘겨주는가, 각 모드가 안정해도 전환이 전체를 불안정하게 만들 수 있는가, 모드를 고르는 논리 자체는 어떻게 설계하고 검증하는가. 이 연재는 그 질문을 순서대로 다룬다.

```mermaid
flowchart LR
    A["왜와 형식<br/>01~02"] --> B["전환 순간<br/>03~06"]
    B --> C["접촉 작업<br/>07"]
    C --> D["모드 논리<br/>08~10"]
    D --> E["고장 모드<br/>11"]
```

## 읽는 순서

### 1부. 왜, 그리고 형식

| # | 글 | 무엇을 얻나 |
| --- | --- | --- |
| 01 | [왜 제어기 하나로 안 되는가](/posts/01-why-multiple-modes/) | 게인 스케줄링의 한계, 불확실성, 접촉, 고장에서 모드가 생기는 이유 |
| 02 | [switched system 과 hybrid automaton](/posts/02-switched-hybrid-automaton/) | guard, domain, reset map 과 하이브리드 시간, Zeno 실행 |

### 2부. 전환 순간

| # | 글 | 무엇을 얻나 |
| --- | --- | --- |
| 03 | [**무충격 전환**](/posts/03-bumpless-transfer/) | 갈아타는 순간 입력이 튀는 원인과 세 가지 처방 |
| 04 | [채터링](/posts/04-chattering-hysteresis-dwell/) | 히스테리시스, 최소 체류시간, 평균 체류시간 |
| 05 | [전환 안정성](/posts/05-switching-stability/) | 공통 Lyapunov 함수와 다중 Lyapunov 함수, 평균 체류시간 하한 |
| 06 | [전환 순간의 상태](/posts/06-state-reset-at-switch/) | 적분기, 관측기, 타이머를 이월할지 리셋할지 |

### 3부. 접촉 작업

| # | 글 | 무엇을 얻나 |
| --- | --- | --- |
| 07 | [위치제어와 힘제어](/posts/07-hybrid-position-force/) | 방향마다 위치와 힘을 나눠 거는 구조 |

### 4부. 모드를 고르는 논리

| # | 글 | 무엇을 얻나 |
| --- | --- | --- |
| 08 | [감독제어와 이산사건 시스템](/posts/08-supervisory-control-des/) | 제어 가능 사건, controllability, 비봉쇄 |
| 09 | [**Stateflow 로 모드 표현하기**](/posts/09-stateflow-modes/) | 계층, 병렬 분해, History Junction 이 줄여 주는 것 |
| 10 | [모드 전환의 검증](/posts/10-mode-switch-verification/) | 도달 불가능, 빠져나올 수 없음, 비결정성 |

### 5부. 고장도 모드다

| # | 글 | 무엇을 얻나 |
| --- | --- | --- |
| 11 | [고장 모드도 모드다](/posts/11-fault-modes-fdir/) | FDIR, fail-safe, fail-degraded, fail-operational |

**급하면** 03, 05, 09 세 편으로 전환 순간, 전환 안정성, 모드 논리를 한 바퀴 돈다.

## 다른 연재와 만나는 곳

- **제어기 하나 쪽:** 모드 하나 안의 연속 제어기는 [ADRC 연재](/posts/00-adrc-series/)가 다룬다.
- **축이 여럿일 때:** 제어 대상이 여러 개인 문제는 [다축 제어 연재](/posts/00-multiaxis-series/)가 다룬다. 부분 고장과 축소 운전은 그쪽 12편과 이어진다.
- **FSM 을 그래프로:** 모드 논리를 개체 그래프로 적는 쪽은 [FSM 과 온톨로지](/posts/15-state-machine-ontology/)에 있다.

## 참고

- [MathWorks Stateflow 문서](https://www.mathworks.com/help/stateflow/)
- [MathWorks Simulink PID Controller 블록](https://www.mathworks.com/help/simulink/slref/pidcontroller.html)
