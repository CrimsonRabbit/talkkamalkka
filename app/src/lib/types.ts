// 예측표(forecast.json) 형식이에요. analysis/build_forecast.py가 만들어요.

export type DayType = "w" | "sat" | "sun";

export interface Segment {
  /** 역번호를 운행 순서대로 나열해요. */
  codes: string[];
  /** codes 순서대로 갈 때의 상하구분 이름 (예: 내선, 하선) */
  forward: string;
  /** codes 반대 순서로 갈 때의 상하구분 이름 (예: 외선, 상선) */
  backward: string;
  /** 2호선 본선처럼 끝과 처음이 이어지는 순환선이면 true */
  circular?: boolean;
  /** 서울교통공사 구간 밖까지 운행할 때 실제 종착역 이름 (방면 표시용) */
  forwardTerminal?: string;
  backwardTerminal?: string;
  /** 6호선 응암순환처럼 한 방향(forward)으로만 다니면 true */
  oneway?: boolean;
  /**
   * 분기역에서는 같은 역이라도 어느 쪽으로 출발하는지에 따라 혼잡도가 달라요.
   * `${역번호}:${상하구분}` → 그 값을 담은 데이터 역번호 (예: 2호선 성수지선 "211:외선" → "9002")
   */
  alias?: Record<string, string>;
}

export interface LineInfo {
  color: string;
  segments: Segment[];
}

export interface StationInfo {
  line: string;
  code: string;
  name: string;
}

export interface ForecastData {
  /** 예측표를 만든 원본 데이터 설명 */
  source: string;
  generatedAt: string;
  /** 30분 칸 시작 시각 (05:30 ~ 00:30) */
  slots: string[];
  lines: Record<string, LineInfo>;
  /** 키: `${호선}:${역번호}` */
  stations: Record<string, StationInfo>;
  /** 키: `${호선}:${역번호}:${상하구분}` */
  values: Record<string, Partial<Record<DayType, number[]>>>;
  /** 일요일 혼잡도를 적용할 공휴일 (YYYY-MM-DD) */
  holidays: string[];
}

export interface SavedRoute {
  id: string;
  label: string;
  origin: string;
  dest: string;
  /** 여러 호선이 겹칠 때 고른 호선 */
  line: string;
  /** 0=일 ~ 6=토 */
  days: number[];
  /** "HH:MM" */
  time: string;
}
