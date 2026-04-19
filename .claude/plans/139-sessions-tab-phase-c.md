---
todo: 139
title: Sessions 탭 Phase C — Server Sessions + Kill (MVP Postgres/MySQL)
status: in_progress
created: 2026-04-19
branch: claude/editor-session-1
---

# ApmQueries 레지스트리 스켈레톤 + Server Sessions 섹션 + Kill

## 스코프 (MVP)
Postgres + MySQL 만 지원. 나머지는 "not supported" 안내.
APM #130 에서 본격 확장할 수 있는 공통 인터페이스를 먼저 세팅.

## 파일
### Backend (신규)
- db/apm/ApmQueries.java (interface)
- db/apm/ServerSession.java (record)
- db/apm/ApmQueriesRegistry.java
- db/apm/PostgresApmQueries.java
- db/apm/MySQLApmQueries.java
- service/ApmService.java
- controller/ApmController.java

### Frontend
- app.js — api.apm, SessionsTab Server Sessions 섹션
- app.css — Kill 버튼·행 스타일

## 실행 단계
1. ServerSession record + ApmQueries interface
2. Postgres/MySQL 구현 + Registry
3. ApmService + ApmController
4. 프론트 섹션 추가 + Kill confirm + 토스트
5. Verify + QA

## 사이드이펙트
- 기존 라우트 영향 없음
- 미지원 dialect = 안내 메시지
