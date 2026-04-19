---
todo: 126
title: 에디터별 세션(연결) 독립화 Phase D
status: completed
created: 2026-04-19
branch: claude/editor-session-1
---

# 자동완성 캐시 Map<connId,…>화 + LLM 탭별 컨텍스트

## 목표
자동완성 캐시를 전역 단일에서 connId 단위 Map 으로 바꿔 탭 전환 시
이전 연결의 테이블/컬럼이 잘못 제안되는 문제를 해결한다.
LLM 호출은 Phase A 에서 이미 활성 탭 connId 로 라우팅되도록 처리됨.

## 범위
- app.js 단일 파일
- 백엔드/HTML/CSS 무변경

## 실행 단계
1. state.autocompleteCache 를 Map 으로 전환
2. loadAutoCompleteCache / clearAutoCompleteCache / getAutocompleteCache 재구현
3. completion provider·dot completion 소비 지점 업데이트
4. switchTab 에서 활성 탭 conn 의 캐시 예열
5. detachConnectionFromTabs + disconnect/delete cascade 의 캐시 clear 를 connId 단위로 좁힘
6. 캐시 상태 참조 지점 (칩·드롭다운·Confluence·exportSchemaDoc) 업데이트

## 사이드이펙트
- 메모리 사용은 커넥션당 1 entry (수십개 수준)
- localStorage 에 캐시 저장 안 함 → 세션 복원 영향 없음
