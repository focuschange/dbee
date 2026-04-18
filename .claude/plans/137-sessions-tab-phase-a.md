---
todo: 137
title: 우측 패널 Sessions 탭 Phase A (MVP)
status: in_progress
created: 2026-04-19
branch: claude/editor-session-1
---

# RightPanel 에 Sessions 탭 추가 — Active / Tab Map / Running

## 목표
우측 패널에 연결·탭·실행 상태를 한눈에 보여주는 Sessions 탭을 추가.
프론트 전용, state 기반 렌더 + 이벤트 훅으로 즉시 갱신 (폴링 없음).

## 범위
- app.js, app.css

## 실행 단계
1. SessionsTab IIFE 모듈 추가 (render + 3섹션)
2. RightPanel.registerTab({id:'sessions', ...}) 등록
3. refreshSessionsTabIfVisible + 라이프사이클 훅 삽입
4. Running Queries 섹션 경과시간 tick (섹션 visible 동안만)
5. CSS

## 사이드이펙트
- 기존 탭 영향 없음
- setInterval 은 active 동안만
