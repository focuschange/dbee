# DBee 🐝

브라우저 기반 SQL 클라이언트 애플리케이션입니다.

## 주요 기능

- **다중 데이터베이스 지원**: MySQL, PostgreSQL, Oracle, SQLite, SQL Server, Amazon Athena
- **SQL 편집기**: Monaco Editor 기반, 구문 강조, 탭 기반 멀티 에디터
- **스키마 탐색기**: 좌측 트리뷰로 스키마/테이블/컬럼/루틴/이벤트 탐색
- **SSH 터널**: 비밀번호 또는 개인 키 인증을 통한 SSH 터널 연결
- **결과 내보내기**: 쿼리 결과를 CSV 파일로 내보내기
- **노트**: Markdown WYSIWYG 에디터로 메모 작성 및 관리
- **테마**: Normal / Light / Dark 3가지 테마 지원

## 기술 스택

- **Backend**: Java 23, Spring Boot 3.4.4
- **Frontend**: HTML/CSS/JS SPA (Monaco Editor, Toast UI Editor)
- **커넥션 풀링**: HikariCP
- **SSH**: JSch 0.2.21
- **빌드**: Gradle (Kotlin DSL)

## 빌드 및 실행

```bash
# 빌드
./gradlew build

# 실행 (포트 8765)
./gradlew bootRun

# 테스트
./gradlew test
```

실행 후 http://localhost:8765 에서 접속할 수 있습니다.

## 프로젝트 구조

```
src/main/java/com/dbee/
├── config/          # 설정 (ConnectionConfig, SshTunnelConfig, NoteConfig)
├── controller/      # REST API 컨트롤러
├── db/              # JDBC 연결, 쿼리 실행, 메타데이터 읽기
│   └── dialect/     # 데이터베이스별 방언 (MySQL, PostgreSQL, Oracle 등)
├── export/          # CSV 내보내기
├── model/           # 데이터 모델
└── service/         # 비즈니스 로직

src/main/resources/
├── static/          # 프론트엔드 (index.html, app.js, app.css)
└── application.properties
```

## 데이터 저장

커넥션, SSH 터널, 노트 설정은 `~/.dbee/` 디렉토리에 JSON 파일로 저장됩니다.

- `connections.json` — DB 커넥션 정보
- `ssh-tunnels.json` — SSH 터널 설정
- `notes.json` — 노트 데이터

> **마이그레이션**: 기존 `~/.dbclient/` 디렉토리의 데이터는 앱 시작 시 자동으로 `~/.dbee/`로 복사됩니다.
