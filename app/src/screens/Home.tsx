import { Card, LevelPill, LineBadge, Page, SourceNote } from "../components";
import {
  DAY_NAMES,
  LEVEL_TEXT,
  dayTypeOf,
  forecastRoute,
  formatTime,
  nextServiceDate,
  parseTime,
  pickRoute,
  recommend,
  toDateKey,
} from "../lib/forecast";
import type { ForecastData, SavedRoute } from "../lib/types";
import type { Nav } from "../nav";

export function Home(props: { data: ForecastData; routes: SavedRoute[]; nav: Nav; now: Date }) {
  const { data, routes, nav, now } = props;
  const today = `${now.getMonth() + 1}월 ${now.getDate()}일 ${DAY_NAMES[now.getDay()]}요일`;

  return (
    <Page title="오늘의 지하철 예보" sub={today}>
      {routes.length === 0 && (
        <Card>
          <h2 className="card-title">등록한 경로가 없어요</h2>
          <p className="muted">자주 타는 경로를 등록하면 여기서 바로 혼잡도를 볼 수 있어요.</p>
          <button type="button" className="secondary" onClick={() => nav.push({ name: "edit" })}>
            경로 등록하기
          </button>
        </Card>
      )}

      {routes.map((r) => (
        <RouteCard key={r.id} data={data} route={r} now={now} onOpen={() => nav.push({ name: "detail", routeId: r.id, view: "time" })} />
      ))}

      {routes.length > 0 && routes.length < 5 && (
        <button type="button" className="text-button center" onClick={() => nav.push({ name: "edit" })}>
          + 경로 추가하기
        </button>
      )}

      <SourceNote data={data} />
    </Page>
  );
}

function RouteCard(props: { data: ForecastData; route: SavedRoute; now: Date; onOpen: () => void }) {
  const { data, route: saved, now } = props;
  const route = pickRoute(data, saved.origin, saved.dest, saved.line);
  const date = nextServiceDate(saved.days, now);
  const isToday = toDateKey(date) === toDateKey(now);
  const dayType = dayTypeOf(date, data.holidays);
  const board = parseTime(saved.time);
  const f = route ? forecastRoute(data, route, dayType, board) : null;
  const rec = route ? recommend(data, route, dayType, board) : null;
  const when = isToday ? "오늘" : `${date.getMonth() + 1}/${date.getDate()}(${DAY_NAMES[date.getDay()]})`;

  return (
    <Card onClick={props.onOpen} className="route-card">
      <div className="route-card-head">
        <span className="route-label">{saved.label}</span>
        <span className="muted">
          {when} {saved.time} 탑승
        </span>
      </div>
      <div className="route-card-title">
        {route && <LineBadge data={data} line={route.line} />} {saved.origin} → {saved.dest}
      </div>
      {f && f.level ? (
        <>
          <div className="route-card-level">
            <LevelPill level={f.level} value={f.max} />
          </div>
          <p className="muted small">
            {f.stops[f.maxIndex]?.name}→{f.stops[f.maxIndex + 1]?.name} 구간이 가장 붐벼요 · {LEVEL_TEXT[f.level].desc}
          </p>
          {rec && (
            <p className="recommend">
              {formatTime(rec.minutes)}에 타면 {LEVEL_TEXT[rec.level].label} ({rec.value}%)
            </p>
          )}
        </>
      ) : (
        <p className="muted">이 경로의 혼잡도 정보가 없어요.</p>
      )}
    </Card>
  );
}
