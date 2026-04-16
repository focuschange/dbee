# 작업 내역

## DBee 리브랜딩

프로젝트를 "휴넷 DB 클라이언트"에서 **DBee** 🐝로 리브랜딩했습니다.

### 변경 사항

| 항목 | 이전 | 이후 |
|------|------|------|
| 프로젝트명 | 휴넷 DB 클라이언트 | DBee |
| Java 패키지 | `com.dbclient` | `com.dbee` |
| 메인 클래스 | `DbClientApplication` | `DBeeApplication` |
| 설정 디렉토리 | `~/.dbclient/` | `~/.dbee/` |
| Gradle group | `com.dbclient` | `com.dbee` |
| localStorage 키 | `dbclient-*` | `dbee-*` |

### 꿀벌 마스코트

- `favicon.svg`: 꿀벌 + DB 모티프 SVG 아이콘
- `index.html`: 애니메이션이 포함된 인라인 꿀벌 로고
- 브랜드 컬러: 꿀 노란색 (#F5A623, #F7C948) 계열

### 자동 마이그레이션

기존 `~/.dbclient/` 디렉토리의 데이터(connections.json, ssh-tunnels.json, notes.json)는 앱 시작 시 자동으로 `~/.dbee/`로 복사됩니다.

---

## Notes 기능 추가

Markdown WYSIWYG 에디터 기반의 노트 기능을 추가했습니다.

### Backend

| 파일 | 설명 |
|------|------|
| `model/NoteInfo.java` | 노트 모델 (id, title, content, createdAt, updatedAt) |
| `config/NoteConfig.java` | `~/.dbee/notes.json`에 노트 영구 저장 |
| `service/NoteService.java` | 노트 CRUD 비즈니스 로직 |
| `controller/NoteController.java` | REST API 엔드포인트 (`/api/notes`) |
| `DBeeApplication.java` | NoteConfig 빈 등록 추가 |

### Frontend

| 파일 | 설명 |
|------|------|
| `index.html` | 툴바에 Notes 버튼 추가, Notes 모달 다이얼로그 추가, Toast UI Editor CDN 추가 |
| `js/app.js` | Notes API 클라이언트, 노트 목록/생성/수정/삭제, Toast UI WYSIWYG 에디터 연동, Ctrl+S 저장 |
| `css/app.css` | Notes 모달 스타일 (1200px 너비), Toast UI Editor 테마 오버라이드 (다크/라이트) |

### API 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/notes` | 노트 목록 조회 |
| GET | `/api/notes/{id}` | 노트 상세 조회 |
| POST | `/api/notes` | 노트 생성 |
| PUT | `/api/notes/{id}` | 노트 수정 |
| DELETE | `/api/notes/{id}` | 노트 삭제 |

### 주요 특징

- **WYSIWYG 편집**: Toast UI Editor를 사용하여 마크다운을 렌더링된 형태로 직접 편집
- **툴바**: Heading, Bold, Italic, Strike, HR, Quote, UL/OL, Task List, Table, Link, Code, Code Block
- **다크/라이트 테마**: 앱 테마에 맞춰 에디터 테마 자동 전환
- **저장 형식**: 내부적으로 Markdown 포맷으로 저장 (호환성 유지)
- **단축키**: `Ctrl+S`로 저장
- **영구 저장**: `~/.dbee/notes.json`에 JSON으로 저장

---

## 문서 정리

| 파일 | 설명 |
|------|------|
| `CLAUDE.md` | 프로젝트 빌드/실행 명령, 아키텍처 설명 (Claude Code용) |
| `README.md` | 프로젝트 소개, 주요 기능, 기술 스택, 빌드 방법, 구조 설명 |
| Notes 등록 | README 내용을 앱 내 Notes에 "DBee README" 제목으로 등록 |
