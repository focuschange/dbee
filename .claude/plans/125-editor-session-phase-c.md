---
todo: 125
title: 에디터별 세션(연결) 독립화 Phase C
status: completed
created: 2026-04-19
branch: claude/editor-session-1
---

# 스키마 트리 컨텍스트 메뉴 재편 + 다중 탭 사용 연결 표시

## 목표
스키마 트리에서 탭 중심 워크플로우를 직관화한다:
- 우클릭 메뉴: Open in New Tab / Assign to Current Tab
- 연결 tree node 에 탭 사용 배지 + 활성 탭 연결 강조

## 범위
- index.html context-menu 항목 변경
- app.js 컨텍스트 액션 + 배지 업데이트 헬퍼
- app.css 배지/강조 스타일

## 실행 단계
1. context-menu: Connect 제거, Open in New Tab + Assign to Current Tab 추가
2. handleContextAction 확장 (두 액션 처리, auto-connect + 스키마 로드)
3. createConnectionNode: tab-usage 배지 span 슬롯
4. refreshTreeConnectionBadges 헬퍼 — 배지·active 하이라이트 갱신
5. 탭 라이프사이클 훅(addEditorTab/closeTab/setActiveTabConnection/switchTab/detachConnectionFromTabs/loadConnections) 에서 호출
6. CSS 스타일 추가

## 사이드이펙트
- 기존 Connect 버튼 semantics 동일 (레이블만 재편)
- 트리 re-render 없이 DOM 부분 업데이트
