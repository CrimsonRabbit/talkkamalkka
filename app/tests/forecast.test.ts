// 계산 로직 테스트: node --test tests/  (Node 24 이상)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dayTypeOf,
  findRoutes,
  forecastRoute,
  levelOf,
  recommend,
  searchStations,
  valueAt,
} from "../src/lib/forecast.ts";
import type { ForecastData } from "../src/lib/types.ts";

const data: ForecastData = JSON.parse(readFileSync(new URL("../public/data/forecast.json", import.meta.url), "utf-8"));
const names = (line: string, codes: string[]) => codes.map((c) => data.stations[`${line}:${c}`]?.name);

test("30분 칸 사이를 선형 보간해요 (계획서 예: 08:00=135, 08:30=156 → 08:10=142)", () => {
  const slots = ["08:00", "08:30"];
  assert.equal(Math.round(valueAt([135, 156], slots, 8 * 60 + 10)!), 142);
  assert.equal(valueAt([135, 156], slots, 7 * 60), 135);
  assert.equal(valueAt([135, 156], slots, 9 * 60), 156);
});

test("신호등 기준은 80% 미만 / 130% 미만 / 130% 이상", () => {
  assert.equal(levelOf(79), "easy");
  assert.equal(levelOf(80), "normal");
  assert.equal(levelOf(129), "normal");
  assert.equal(levelOf(130), "busy");
});

test("공휴일과 일요일은 일요일 혼잡도를 써요", () => {
  assert.equal(dayTypeOf(new Date(2026, 11, 25), ["2026-12-25"]), "sun"); // 금요일 성탄절
  assert.equal(dayTypeOf(new Date(2026, 10, 28), []), "sat");
  assert.equal(dayTypeOf(new Date(2026, 10, 27), []), "w");
});

test("2호선 영등포구청 → 강남은 외선순환 14개 역 (신도림·사당 경유)", () => {
  const [r] = findRoutes(data, "영등포구청", "강남");
  assert.equal(r.line, "2호선");
  assert.equal(r.direction, "외선");
  assert.equal(r.codes.length - 1, 14);
  const n = names(r.line, r.codes);
  assert.ok(n.includes("신도림") && n.includes("사당"));
});

test("2호선 영등포구청 → 합정은 내선순환 2개 역", () => {
  const [r] = findRoutes(data, "영등포구청", "합정");
  assert.equal(r.line, "2호선");
  assert.equal(r.direction, "내선");
  assert.equal(r.codes.length - 1, 2);
});

test("2호선 순환선은 짧은 쪽으로 가요 (충정로 → 시청 1개 역)", () => {
  const [r] = findRoutes(data, "충정로", "시청");
  assert.equal(r.line, "2호선");
  assert.equal(r.codes.length - 1, 1);
});

test("2호선 성수지선: 성수 → 신설동은 용답·신답·용두 경유, 성수 출발 값은 지선 값", () => {
  const routes = findRoutes(data, "성수", "신설동").filter((x) => x.line === "2호선");
  assert.ok(routes.length > 0);
  const r = routes[0];
  assert.deepEqual(names(r.line, r.codes), ["성수", "용답", "신답", "용두", "신설동"]);
  assert.equal(r.alias?.["211:외선"], "9002");
});

test("5호선 마천지선: 강동 → 마천", () => {
  const [r] = findRoutes(data, "강동", "마천");
  assert.equal(r.line, "5호선");
  assert.equal(names(r.line, r.codes)[1], "둔촌동");
});

test("1호선 동대문 → 신설동은 동묘앞을 지나요", () => {
  const [r] = findRoutes(data, "동대문", "신설동");
  assert.equal(r.line, "1호선");
  assert.deepEqual(names(r.line, r.codes), ["동대문", "동묘앞", "신설동"]);
});

test("8호선 복정 → 산성은 남위례를 지나요", () => {
  const [r] = findRoutes(data, "복정", "산성");
  assert.deepEqual(names(r.line, r.codes), ["복정", "남위례", "산성"]);
});

test("6호선 응암순환은 한 방향만: 역촌 → 새절은 되고 새절 → 역촌은 안 돼요", () => {
  assert.ok(findRoutes(data, "역촌", "새절").some((r) => r.line === "6호선"));
  assert.ok(!findRoutes(data, "새절", "역촌").some((r) => r.line === "6호선"));
});

test("환승이 필요한 경로는 찾지 않아요 (방화 → 장암)", () => {
  assert.equal(findRoutes(data, "방화", "장암").length, 0);
});

test("모든 역 쌍 중 같은 호선 경로는 모든 정차역에 예측값이 있어요 (평일 08:00)", () => {
  let checked = 0;
  for (const line of Object.keys(data.lines)) {
    const stations = Object.values(data.stations).filter((s) => s.line === line);
    for (const a of stations) {
      for (const b of stations) {
        if (a.name === b.name) continue;
        const r = findRoutes(data, a.name, b.name).find((x) => x.line === line);
        if (!r) continue;
        const f = forecastRoute(data, r, "w", 8 * 60);
        const missing = f.stops.slice(0, -1).filter((s) => s.value === null);
        assert.equal(missing.length, 0, `${line} ${a.name}→${b.name}: ${missing.map((m) => m.name).join(",")}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 1000);
});

test("추천 시각은 원래보다 신호등 단계가 낮아요", () => {
  const [r] = findRoutes(data, "방배", "강남");
  for (let t = 6 * 60; t <= 10 * 60; t += 10) {
    const base = forecastRoute(data, r, "w", t);
    const rec = recommend(data, r, "w", t);
    if (rec && base.level) {
      const rank = { easy: 0, normal: 1, busy: 2 };
      assert.ok(rank[rec.level] < rank[base.level]);
      assert.ok(Math.abs(rec.offset) <= 40);
    }
  }
});

test("역 이름 검색은 초성도 돼요", () => {
  const all = [...new Set(Object.values(data.stations).map((s) => s.name))];
  assert.ok(searchStations(all, "ㄱㄴ").includes("강남"));
  assert.ok(searchStations(all, "강남역").includes("강남"));
});

test("5호선 방화 → 마천 직통 경로 (강동에서 마천 쪽 값 사용)", () => {
  const r = findRoutes(data, "방화", "마천").find((x) => x.line === "5호선");
  assert.ok(r);
  const n = names(r.line, r.codes);
  assert.ok(n.includes("강동") && n.includes("둔촌동") && !n.includes("길동"));
  assert.equal(r.alias?.["2549:하선"], "9005");
});

test("방면 표시는 실제 종착역 이름을 써요", () => {
  assert.equal(findRoutes(data, "노원", "혜화")[0].directionLabel, "오이도 방면");
  assert.equal(findRoutes(data, "혜화", "노원")[0].directionLabel, "진접 방면");
});

test("주요 기능 주소로 들어오면 해당 화면을 열어요", async () => {
  const { parseEntry } = await import("../src/lib/entry.ts").catch(() => ({ parseEntry: null }));
  if (!parseEntry) return; // SDK를 불러올 수 없는 환경에서는 건너뛰어요.
  assert.equal(parseEntry("intoss://tkkmkk/quick"), "quick");
  assert.equal(parseEntry("intoss://tkkmkk?screen=favorites"), "favorites");
  assert.equal(parseEntry("intoss-private://appsintoss/quick?_deploymentId=x"), "quick");
  assert.equal(parseEntry("intoss://tkkmkk"), null);
});
