---
todo: 123
title: 에디터별 세션(연결) 독립화 Phase A
status: completed
created: 2026-04-19
branch: claude/editor-session-1
---

# 탭별 connectionId 데이터 모델 + getActiveConnectionId() 헬퍼 + 전역 참조 일괄 교체

## 목표
`state.activeConnectionId` (단일 전역) → `tab.connId` (탭별) 로 이관하고
`getActiveConnectionId()` 헬퍼를 통해 ~28개 읽기 지점을 일괄 교체한다.
UI(칩/드롭다운/단축키)는 Phase B(#124) 범위이므로 본 Phase 는 동작 보존.

## 범위
- 프론트엔드 단일 파일: `src/main/resources/static/js/app.js`
- 백엔드/HTML/CSS 변경 없음

## 실행 단계
1. SQL 탭 데이터 모델에 `connId`, `connName` 필드 추가 (신규 탭은 현재 활성 탭의 연결을 상속)
2. `getActiveTab()`, `getActiveConnectionId()`, `setActiveTabConnection()` 헬퍼 추가
3. `state.activeConnectionId` 읽기 지점 28개를 `getActiveConnectionId()` 로 교체
4. `activateConnection()` 에서 현재 탭에 connId 할당, 전역은 호환용 유지
5. 연결 삭제 cascade 에서 모든 탭의 연결 레퍼런스 정리
6. `saveEditorSession` / `restoreEditorSession` 직렬화 확장

## 사이드이펙트
- 기존 동작 보존 (단일 탭 유저 동일 경험)
- localStorage 구 세션은 connId=null 로 복원 → 기존 "No active connection" 흐름
