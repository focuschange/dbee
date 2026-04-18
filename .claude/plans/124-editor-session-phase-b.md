---
todo: 124
title: 에디터별 세션(연결) 독립화 Phase B
status: in_progress
created: 2026-04-19
branch: claude/editor-session-1
---

# 탭 UI 연결 칩/드롭다운 + Ctrl+Shift+K 단축키

## 목표
각 탭이 자기 연결을 가진다는 Phase A 모델을 **사용자 UI 로 노출**한다.
탭 레이블 옆에 현재 연결을 칩으로 보여주고, 클릭하면 드롭다운으로
전환 가능하게 한다. 단축키 Cmd/Ctrl+Shift+K 로도 동일한 드롭다운 호출.

## 범위
- 프론트엔드 전용: `src/main/resources/static/js/app.js`, `css/app.css`
- 백엔드/HTML 변경 없음

## 실행 단계
1. `renderTabs()` 확장 — tab-conn-chip span 추가, 연결 상태에 따라 스타일 분기
2. 드롭다운 함수 추가 — `showTabConnectionMenu`, `hideTabConnectionMenu`
3. 자동 connect 경로 — 미연결 연결 선택 시 `api.connections.connect()` 후 할당
4. 단축키 바인딩 — Monaco 및 document-level 둘 다에 Cmd/Ctrl+Shift+K
5. CSS — chip·menu 스타일 추가

## 사이드이펙트
- 탭 rename(double-click)과 충돌 금지 (칩은 tab-label 밖에 배치)
- ERD 탭은 readonly 칩 (conn 고정)
- 기존 탭 가로 스크롤 유지
