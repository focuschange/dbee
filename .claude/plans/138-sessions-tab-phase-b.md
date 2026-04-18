---
todo: 138
title: Sessions 탭 Phase B — Pool Stats
status: in_progress
created: 2026-04-19
branch: claude/editor-session-1
---

# HikariCP 풀 메트릭 API + Sessions 탭 Pool Stats 섹션

## 목표
각 열린 연결의 HikariCP 풀 active/idle/total/awaiting 을 노출하고,
Sessions 탭에서 선택적 자동 새로고침(기본 off) 로 확인.

## 범위
- 백엔드: ConnectionManager/Service/Controller — `/api/connections/pool-stats`
- 프론트: SessionsTab 에 Pool Stats 섹션 + 폴링 토글

## 실행 단계
1. ConnectionManager.collectPoolStats()
2. ConnectionService 위임 + Controller GET
3. api.connections.poolStats() 프론트 클라이언트
4. Pool Stats 섹션 렌더 + auto-refresh 토글 + 수동 새로고침
5. 막대 그래프·awaiting 경고 배지 CSS

## 사이드이펙트
- 기존 엔드포인트 영향 없음
- 폴링은 Sessions 탭 active 동안만
