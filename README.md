# 탈까말까

공공데이터로 미리 보는 요일·시간대별 지하철 혼잡도 예보 (서울교통공사 1~8호선)

## 폴더 구조

| 폴더 | 내용 |
| --- | --- |
| `analysis/` | 전처리·예측 모델 파이썬 코드 (`requirements.txt`) |
| `data/raw/` | 내려받은 원본 데이터 (GitHub에 올리지 않음) |
| `data/processed/` | 전처리 결과, 앱에서 쓸 예측표(JSON) |
| `setup/` | 개발 환경 점검·설치 스크립트 |
| `app/` | 앱인토스 미니앱 (React + TypeScript + Vite, SDK 3.10.0, appName `tkkmkk`) |
| `release/` | 콘솔에 올릴 로고·스크린샷과 붙여넣기 문구(`출시정보.md`) |

## 시작하기 (Windows)

### 1. 개발 환경 점검·설치

`setup\run-setup.bat`을 더블클릭합니다.

- Git, Node.js 24 이상, Python 3, 코드 편집기(VS Code 또는 Cursor)를 확인하고 없는 것만 설치합니다. 설치 전에 항상 물어봅니다.
- Git 이름·이메일 설정, Git 저장소 생성, Python 가상환경(`.venv`)과 분석 패키지 설치까지 진행합니다.
- 결과는 `setup\setup-result.txt`에 저장됩니다.
- 설치 중 Windows 관리자 승인 창이 뜨면 직접 승인해 주세요.

### 2. API 인증키

`.env.example`을 복사해 `.env`로 이름을 바꾸고 인증키를 넣습니다.

### 3. 미니앱 실행 (`app` 폴더, appName: tkkmkk)

VS Code 터미널에서 실행합니다.

```bash
cd app
npm install
npm run dev
```

- 브라우저에서 `http://localhost:5173`을 열면 첫 화면이 보입니다. 오른쪽 아래 `AIT` 버튼으로 앱인토스 환경을 흉내 내 테스트할 수 있습니다.
- 빌드: `npm run build` → `app/tkkmkk.ait` 생성 → 콘솔 '앱 출시'에 업로드해 토스 앱 QR 테스트
- `apps-in-toss.config.ts`의 `appName`은 콘솔에 등록한 `tkkmkk`와 같아야 업로드할 수 있습니다.
- 토스 디자인 시스템(선택): 공식 문서는 `npm install @toss/tds-mobile @toss/tds-mobile-ait @emotion/react@^11 react@^18 react-dom@^18`로 안내합니다. 이 프로젝트는 React 19이므로, TDS를 쓰려면 React 버전을 문서에 맞춥니다.

### 4. 예측표 갱신 (분기마다)

1. 공공데이터포털에서 새 `서울교통공사_지하철혼잡도정보_YYYYMMDD.csv`를 받아 `data\raw`에 넣어요.
2. 예측표를 다시 만들어요. 최근 4개 분기를 0.4·0.3·0.2·0.1로 가중평균해요.

```powershell
.venv\Scripts\python analysis\build_forecast.py
```

3. `app\public\data\forecast.json`이 바뀌면 앱을 다시 빌드해 콘솔에 올려요.

```bash
cd app
npm test
npm run build
```

- `.env`에 `DATA_GO_KR_SERVICE_KEY`를 넣으면 설·추석 같은 음력 공휴일도 특일 API로 받아요. 없으면 양력 공휴일과 대체공휴일만 넣어요.
- 스크립트가 출력하는 '방향 확인'이 모두 OK인지 확인해 주세요.

### 5. 앱 구조

| 파일 | 역할 |
| --- | --- |
| `src/lib/forecast.ts` | 경로 찾기, 30분 칸 보간, 신호등 단계, 추천 시각 계산 |
| `src/lib/storage.ts` | 즐겨찾기를 토스 앱 저장소(Storage)에 저장 |
| `src/lib/entry.ts` | `intoss://tkkmkk?screen=quick` 같은 주소로 들어올 때 첫 화면 |
| `src/screens/` | 온보딩, 홈, 경로 상세(시간대별·구간별), 빠른 조회, 즐겨찾기, 경로 편집 |
| `tests/forecast.test.ts` | 실제 예측표로 경로·계산을 검사 (`npm test`) |

알림 기능은 2차 버전 예정이에요. 이번 버전은 서버 없이 동작해요.

### 6. Python 가상환경 사용

```powershell
.venv\Scripts\activate
python analysis\your_script.py
```

## 데이터 출처

- 서울교통공사 지하철혼잡도정보 (서울 열린데이터광장 OA-12928)
- 서울교통공사 역별 일별 시간대별 승하차인원 (OA-12921)
- 한국천문연구원 특일 정보 (공공데이터포털 오픈 API)
- 기상청 지상(종관, ASOS) 시간자료 (공공데이터포털 오픈 API)

## 참고

- 앱인토스 개발자센터: https://developers-apps-in-toss.toss.im/
- 앱인토스 콘솔: https://apps-in-toss.toss.im/
- 공식 예제: https://github.com/toss/apps-in-toss-examples
