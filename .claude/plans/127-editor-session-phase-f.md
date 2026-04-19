---
todo: 127
title: 에디터별 세션(연결) 독립화 Phase F
status: completed
created: 2026-04-19
branch: claude/editor-session-1
---

# TX 공유 경고 + 탭 복제(상속) + 칩 색상 강화 + cascade 확인

## 목표
- 풀드 커넥션 환경에서 트랜잭션 경계가 이어지지 않음을 사용자에게 명시
- 현재 탭의 SQL + 연결을 그대로 복제하는 단축 경로 제공
- 연결 색상 칩 시각적 개선
- Phase A 의 cascade 동작 QA 재확인

## 범위
- app.js / app.css 만 수정
- HTML 변경 없음

## 실행 단계
1. duplicateActiveTab 함수 추가
2. Cmd/Ctrl+Shift+D 단축키 + 명령 팔레트 엔트리
3. TX 경고 배너 표시 로직 (executeTxn + executeQuery BEGIN 감지)
4. 세션당 한 번 dismiss 플래그
5. 칩 배경 틴트 CSS

## 사이드이펙트
- 브라우저 기본 Ctrl+Shift+D 차단 필요
- TX 경고는 dismiss 플래그로 중복 방지
- 색상 없는 연결은 기존 동작 유지
