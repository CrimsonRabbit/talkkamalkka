// 경로 계산과 혼잡도 예측 로직이에요. 화면과 분리해 두어 테스트하기 쉽게 했어요.
import type { DayType, ForecastData, Segment } from "./types";

/** 역 사이 평균 소요 시간(분). 계획서 가정과 같아요. */
export const MINUTES_PER_HOP = 2;
/** 신호등 기준 (%) */
export const LEVEL_EASY_MAX = 80;
export const LEVEL_BUSY_MIN = 130;
/** 추천 후보: 원래 시각 기준 앞뒤 (분) */
export const RECOMMEND_OFFSETS = [-40, -30, -20, -10, 10, 20];

export type Level = "easy" | "normal" | "busy";

export const LEVEL_TEXT: Record<Level, { label: string; short: string; desc: string }> = {
  easy: { label: "여유로워요", short: "여유", desc: "서서 가도 공간이 넉넉해요" },
  normal: { label: "조금 붐벼요", short: "보통", desc: "서서 가면 옆 사람과 어깨가 닿는 정도예요" },
  busy: { label: "많이 붐벼요", short: "혼잡", desc: "몸이 서로 닿을 만큼 빽빽해요" },
};

export function levelOf(value: number): Level {
  if (value < LEVEL_EASY_MAX) return "easy";
  if (value < LEVEL_BUSY_MIN) return "normal";
  return "busy";
}

const LEVEL_RANK: Record<Level, number> = { easy: 0, normal: 1, busy: 2 };

// ---------- 시간 ----------

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 새벽 시간(05시 전)은 전날 운행의 연장으로 봐요. */
function normalizeServiceMinutes(minutes: number): number {
  const m = ((minutes % 1440) + 1440) % 1440;
  return m < 300 ? m + 1440 : m;
}

/** 30분 칸 값을 칸 시작 시각 기준으로 선형 보간해요. 08:00=135, 08:30=156 이면 08:10=142 */
export function valueAt(series: number[], slots: string[], minutes: number): number | null {
  if (!series || series.length === 0) return null;
  const t = normalizeServiceMinutes(minutes);
  const starts = slots.map((s) => normalizeServiceMinutes(parseTime(s)));
  if (t <= starts[0]) return series[0];
  const last = starts.length - 1;
  if (t >= starts[last]) return series[last];
  for (let i = 0; i < last; i++) {
    if (t >= starts[i] && t < starts[i + 1]) {
      const ratio = (t - starts[i]) / (starts[i + 1] - starts[i]);
      return series[i] + (series[i + 1] - series[i]) * ratio;
    }
  }
  return null;
}

// ---------- 날짜 ----------

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 공휴일은 일요일 혼잡도를 써요. */
export function dayTypeOf(date: Date, holidays: string[]): DayType {
  if (holidays.includes(toDateKey(date)) || date.getDay() === 0) return "sun";
  if (date.getDay() === 6) return "sat";
  return "w";
}

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// ---------- 경로 ----------

export interface Route {
  line: string;
  /** 상하구분 (예: 외선, 하선) — 예측표 키에 써요 */
  direction: string;
  /** 화면에 보여 줄 방향 (예: 외선순환, 남태령 방면) */
  directionLabel: string;
  /** 출발역부터 도착역까지 역번호 */
  codes: string[];
  /** 분기역 혼잡도를 읽을 데이터 역번호 */
  alias?: Record<string, string>;
}

function pathOnSegment(seg: Segment, from: number, to: number, forward: boolean): string[] {
  const n = seg.codes.length;
  const out: string[] = [];
  let i = from;
  out.push(seg.codes[i]);
  while (i !== to) {
    i = forward ? i + 1 : i - 1;
    if (seg.circular) i = (i + n) % n;
    if (i < 0 || i >= n) return [];
    out.push(seg.codes[i]);
  }
  return out;
}

function codeByName(data: ForecastData, line: string, name: string): string | null {
  for (const st of Object.values(data.stations)) {
    if (st.line === line && st.name === name) return st.code;
  }
  return null;
}

export function stationName(data: ForecastData, line: string, code: string): string {
  return data.stations[`${line}:${code}`]?.name ?? code;
}

/** 역 이름이 있는 호선 목록 */
export function linesOf(data: ForecastData, name: string): string[] {
  const set = new Set<string>();
  for (const st of Object.values(data.stations)) if (st.name === name) set.add(st.line);
  return sortLines([...set]);
}

export function sortLines(lines: string[]): string[] {
  return [...lines].sort((a, b) => parseInt(a) - parseInt(b));
}

/** 같은 호선으로 갈 수 있는 경로 후보 (역 수가 적은 순) */
export function findRoutes(data: ForecastData, origin: string, dest: string): Route[] {
  if (origin === dest) return [];
  const candidates: Route[] = [];
  for (const line of linesOf(data, origin)) {
    if (!linesOf(data, dest).includes(line)) continue;
    const o = codeByName(data, line, origin);
    const d = codeByName(data, line, dest);
    const info = data.lines[line];
    if (!o || !d || !info) continue;
    for (const seg of info.segments) {
      const io = seg.codes.indexOf(o);
      const id = seg.codes.indexOf(d);
      if (io < 0 || id < 0) continue;
      const options: boolean[] = seg.circular ? [true, false] : [id > io];
      if (seg.oneway && !seg.circular && id < io) continue;
      for (const forward of options) {
        const codes = pathOnSegment(seg, io, id, forward);
        if (codes.length < 2) continue;
        const direction = forward ? seg.forward : seg.backward;
        const terminal = forward ? seg.codes[seg.codes.length - 1] : seg.codes[0];
        const directionLabel = seg.circular
          ? `${direction}순환`
          : `${(forward ? seg.forwardTerminal : seg.backwardTerminal) ?? stationName(data, line, terminal)} 방면`;
        candidates.push({ line, direction, directionLabel, codes, alias: seg.alias });
      }
    }
  }
  candidates.sort((a, b) => a.codes.length - b.codes.length);
  // 같은 호선·방향 중복 제거
  const seen = new Set<string>();
  return candidates.filter((r) => {
    const k = `${r.line}|${r.codes.join(",")}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function pickRoute(data: ForecastData, origin: string, dest: string, line?: string): Route | null {
  const routes = findRoutes(data, origin, dest);
  if (routes.length === 0) return null;
  return routes.find((r) => r.line === line) ?? routes[0];
}

// ---------- 예측 ----------

export interface StopForecast {
  code: string;
  name: string;
  minutes: number;
  /** 이 역을 출발하는 열차의 예상 혼잡도 (도착역은 null) */
  value: number | null;
}

export interface RouteForecast {
  stops: StopForecast[];
  /** 내 구간에서 가장 붐비는 값 */
  max: number | null;
  /** 가장 붐비는 구간의 출발역 위치 */
  maxIndex: number;
  level: Level | null;
  travelMinutes: number;
}

export function forecastRoute(
  data: ForecastData,
  route: Route,
  dayType: DayType,
  boardMinutes: number,
): RouteForecast {
  const stops: StopForecast[] = route.codes.map((code, i) => {
    const minutes = boardMinutes + i * MINUTES_PER_HOP;
    const isLast = i === route.codes.length - 1;
    const valueCode = route.alias?.[`${code}:${route.direction}`] ?? code;
    const series = data.values[`${route.line}:${valueCode}:${route.direction}`]?.[dayType];
    const raw = isLast || !series ? null : valueAt(series, data.slots, minutes);
    return {
      code,
      name: stationName(data, route.line, code),
      minutes,
      value: raw === null ? null : Math.round(raw),
    };
  });
  let max: number | null = null;
  let maxIndex = -1;
  stops.forEach((s, i) => {
    if (s.value !== null && (max === null || s.value > max)) {
      max = s.value;
      maxIndex = i;
    }
  });
  return {
    stops,
    max,
    maxIndex,
    level: max === null ? null : levelOf(max),
    travelMinutes: (route.codes.length - 1) * MINUTES_PER_HOP,
  };
}

export interface Recommendation {
  minutes: number;
  offset: number;
  value: number;
  level: Level;
}

/** 원래보다 신호등 단계가 낮은 시각 중 가장 가까운 시각을 골라요. 같으면 이른 쪽. */
export function recommend(
  data: ForecastData,
  route: Route,
  dayType: DayType,
  boardMinutes: number,
): Recommendation | null {
  const base = forecastRoute(data, route, dayType, boardMinutes);
  if (base.level === null || base.level === "easy") return null;
  const options: Recommendation[] = [];
  for (const offset of RECOMMEND_OFFSETS) {
    const f = forecastRoute(data, route, dayType, boardMinutes + offset);
    if (f.max === null || f.level === null) continue;
    if (LEVEL_RANK[f.level] < LEVEL_RANK[base.level]) {
      options.push({ minutes: boardMinutes + offset, offset, value: f.max, level: f.level });
    }
  }
  options.sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset) || a.offset - b.offset);
  return options[0] ?? null;
}

/** 시간대별 예보: 원래 시각 앞뒤로 10분 간격 */
export function timeline(
  data: ForecastData,
  route: Route,
  dayType: DayType,
  boardMinutes: number,
): { minutes: number; offset: number; value: number | null; level: Level | null }[] {
  const offsets = [-40, -30, -20, -10, 0, 10, 20];
  return offsets.map((offset) => {
    const f = forecastRoute(data, route, dayType, boardMinutes + offset);
    return { minutes: boardMinutes + offset, offset, value: f.max, level: f.level };
  });
}

/** 다음 이용일 (오늘 포함) */
export function nextServiceDate(days: number[], from: Date): Date {
  for (let i = 0; i < 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (days.includes(d.getDay())) return d;
  }
  return from;
}

// ---------- 검색 ----------

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

function initials(s: string): string {
  return [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0) - 0xac00;
      return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
    })
    .join("");
}

/** 역 이름 검색. 초성(예: ㄱㄴ → 강남)도 돼요. */
export function searchStations(names: string[], query: string): string[] {
  const q = query.replace(/\s/g, "").replace(/역$/, "");
  if (!q) return names;
  const isInitials = [...q].every((ch) => CHO.includes(ch));
  return names
    .filter((n) => (isInitials ? initials(n).includes(q) : n.includes(q)))
    .sort((a, b) => Number(!a.startsWith(q) && !initials(a).startsWith(q)) - Number(!b.startsWith(q) && !initials(b).startsWith(q)) || a.localeCompare(b, "ko"));
}

export function allStationNames(data: ForecastData): string[] {
  return [...new Set(Object.values(data.stations).map((s) => s.name))].sort((a, b) => a.localeCompare(b, "ko"));
}
