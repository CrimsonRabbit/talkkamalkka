import { useEffect, useState } from "react";
import { Card, LevelPill, LineBadge, Page, PrimaryButton, SourceNote, StationField } from "../components";
import { LEVEL_TEXT, dayTypeOf, findRoutes, forecastRoute, formatTime, pickRoute } from "../lib/forecast";
import { loadQuickOrigin, saveQuickOrigin } from "../lib/storage";
import type { ForecastData, SavedRoute } from "../lib/types";
import type { Nav } from "../nav";

export function Quick(props: { data: ForecastData; routes: SavedRoute[]; nav: Nav }) {
  const { data, routes, nav } = props;
  const [origin, setOrigin] = useState<string | null>(null);
  const [dest, setDest] = useState<string | null>(null);

  // 출발역은 마지막으로 조회한 역, 없으면 첫 번째 즐겨찾기의 출발역으로 채워요.
  useEffect(() => {
    loadQuickOrigin().then((o) => setOrigin((prev) => prev ?? o ?? routes[0]?.origin ?? null));
  }, [routes]);

  const noRoute = origin && dest && findRoutes(data, origin, dest).length === 0;

  return (
    <Page title="빠른 조회" sub="도착역만 고르면 지금 출발할 때의 혼잡도를 보여 줘요.">
      <div className="form">
        <StationField data={data} label="출발역" value={origin} placeholder="어디서 타나요?" onChange={setOrigin} exclude={dest} />
        <StationField data={data} label="도착역" value={dest} placeholder="어디서 내리나요?" onChange={setDest} exclude={origin} />
        {noRoute && <p className="notice">지금은 한 호선으로 가는 경로만 계산할 수 있어요. 환승 경로는 준비 중이에요.</p>}
      </div>
      <PrimaryButton
        disabled={!origin || !dest || Boolean(noRoute)}
        onClick={() => {
          if (!origin || !dest) return;
          saveQuickOrigin(origin);
          nav.push({ name: "quickResult", origin, dest });
        }}
      >
        혼잡도 보기
      </PrimaryButton>
    </Page>
  );
}

export function QuickResult(props: { data: ForecastData; origin: string; dest: string; line?: string; now: Date }) {
  const { data, origin, dest, now } = props;
  const route = pickRoute(data, origin, dest, props.line);
  if (!route) {
    return (
      <Page title="경로를 찾지 못했어요">
        <p className="muted">한 호선으로 가는 경로만 계산할 수 있어요.</p>
      </Page>
    );
  }
  const dayType = dayTypeOf(now, data.holidays);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const items = [0, 10, 20].map((offset) => ({ offset, f: forecastRoute(data, route, dayType, nowMin + offset) }));

  return (
    <Page
      title={`${origin} → ${dest}`}
      sub={
        <>
          <LineBadge data={data} line={route.line} /> {route.line} {route.directionLabel} · {route.codes.length - 1}개 역 · 약{" "}
          {items[0].f.travelMinutes}분
        </>
      }
    >
      {items.map(({ offset, f }) => (
        <Card key={offset}>
          <p className="muted">
            {offset === 0 ? "지금 출발하면" : `${offset}분 뒤 출발하면`} · {formatTime(nowMin + offset)}
          </p>
          <div className="big-value">
            <LevelPill level={f.level} value={f.max} />
          </div>
          {f.level && <p className="muted small">{LEVEL_TEXT[f.level].desc}</p>}
        </Card>
      ))}
      <SourceNote data={data} />
    </Page>
  );
}
