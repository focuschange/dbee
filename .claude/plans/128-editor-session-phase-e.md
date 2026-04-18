---
todo: 128
title: 에디터별 세션(연결) 독립화 Phase E
status: in_progress
created: 2026-04-19
branch: claude/editor-session-1
---

# 결과 패널 탭별 보관/복원 (tab.resultState)

## 목표
각 SQL 탭이 자기의 마지막 쿼리 결과(DOM + state) 를 기억하고,
탭 전환 시 복원한다. 세션 내 보관만 (localStorage 미사용).

## 범위
- src/main/resources/static/js/app.js

## 실행 단계
1. 초기 placeholder HTML 스냅샷 저장
2. captureResultPanelToTab / restoreResultPanelFromTab / clearResultPanel 헬퍼
3. switchTab 에서 prevTab 저장, 새 tab 복원
4. ERD 탭 skip

## 사이드이펙트
- 이벤트 핸들러는 DocumentFragment 이동으로 보존
- 메모리는 세션 범위만 (localStorage 저장 안 함)
