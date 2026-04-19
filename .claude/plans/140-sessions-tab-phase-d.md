---
todo: 140
title: Sessions 탭 Phase D — UX 통합 (단축키·색상 bar·검색·통합 Auto·섹션 접기)
status: completed
created: 2026-04-19
branch: claude/keen-ptolemy-45a01e
---

# Sessions 탭 UX 통합

## 스코프
- Cmd/Ctrl+Shift+S — Sessions 탭 토글 + 커맨드 팔레트 등록
- `--row-color` 를 Server Sessions·Running 행에도 주입
- 상단 검색 박스(연결명 / SQL fragment) — 4개 섹션 일괄 필터
- 통합 Auto-Refresh 토글(Pool+Server 동시, dismissable)
- 4개 섹션 접기/펼치기 + localStorage 저장

## 파일
- src/main/resources/static/js/app.js
- src/main/resources/static/css/app.css

## 실행 단계
1. SessionsTab 헤더(검색 박스 + 통합 Auto 토글) 추가
2. 섹션 접기 상태 + 4개 섹션 헤더 클릭 핸들러
3. 필터 로직: 연결명 substring + SQL fragment substring
4. Server/Running 행에 `--row-color` 주입
5. 단축키 Cmd/Ctrl+Shift+S 등록 + 커맨드 팔레트 항목 추가
6. CSS — 검색 input / 섹션 헤더 커서·아이콘
7. Verify + QA

## 사이드이펙트
- 기존 핸들러·레이아웃에 영향 없음(필터는 렌더 단계 한정)
- 기존 개별 Auto 버튼 제거 → 통합 토글이 과거 LS key 재사용해 초기 상태 복원
