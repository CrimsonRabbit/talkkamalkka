import { useState } from "react";
import { Card, Legend, LevelPill, LineBadge, Page, SourceNote } from "../components";
import {
  DAY_NAMES,
  LEVEL_TEXT,
  dayTypeOf,
  forecastRoute,
  formatTime,
  levelOf,
  nextServiceDate,
  parseTime,
  pickRoute,
  recommend,
  timeline,
} from "../lib/forecast";
import type { ForecastData, SavedRoute } from "../lib/types";
import type { Nav } from "../nav";

export function Detail(props: {
  data: ForecastData;
  saved: SavedRoute;
  view: "time" | "section";
  now: Date;
  nav: Nav;
}) {
  const { data, saved, now, nav } = props;
  const route = pickRoute(data, saved.origin, saved.dest, saved.line);
  const date = nextServiceDate(saved.days, now);
  const dayType = dayTypeOf(date, data.holidays);
  const baseBoard = parseTime(saved.time);
  // '오늘만 이 시각으로 보기' — 저장된 경로는 바꾸지 않아요.
  const [board, setBoard] = useState(baseBoard);

  if (!route) {
    return (
      <Page title="경로를 찾지 못했어요">
        <p className="muted">즐겨찾기에서 경로를 다시 설정해 주세요.</p>
      </Page>
    );
  }

  const f = forecastRoute(data, route, dayType, board);
  const rec = recommend(data, route, dayType, baseBoard);
  const dateText = `${date.getMonth() + 1}월 ${date.getDate()}일 ${DAY_NAMES[date.getDay()]}요일`;

  return (
    <Page
      title={`${saved.origin} → ${saved.dest}`}
      sub={
        <>
          <LineBadge data={data} line={route.line} /> {route.line} {route.directionLabel} · {dateText}
        </>
      }
    >
      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={props.view === "time"}
          className={props.view === "time" ? "seg-on" : ""}
          onClick={() => nav.replace({ name: "detail", routeId: saved.id, view: "time" })}
        >
          시간대별
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={props.view === "section"}
          className={props.view === "section" ? "seg-on" : ""}
          onClick={() => nav.replace({ name: "detail", routeId: saved.id, view: "section" })}
        >
          구간별
        </button>
      </div>

      <Card>
        <p className="muted">{formatTime(board)} 탑승하면</p>
        <div className="big-value">
          <LevelPill level={f.level} value={f.max} />
        </div>
        {f.level && <p className="muted small">{LEVEL_TEXT[f.level].desc}</p>}
        {board !== baseBoard && (
          <button type="button" className="text-button" onClick={() => setBoard(baseBoard)}>
            원래 시각({saved.time})으로 돌아가기
          </button>
        )}
      </Card>

      {props.view === "time" ? (
        <TimeView data={data} route={route} dayType={dayType} baseBoard={baseBoard} board={board} onPick={setBoard} rec={rec} />
      ) : (
        <SectionView f={f} />
      )}

      <Legend />
      <SourceNote data={data} />
    </Page>
  );
}

function TimeView(props: {
  data: ForecastData;
  route: NonNullable<ReturnType<typeof pickRoute>>;
  dayType: ReturnType<typeof dayTypeOf>;
  baseBoard: number;
  board: number;
  onPick: (m: number) => void;
  rec: ReturnType<typeof recommend>;
}) {
  const rows = timeline(props.data, props.route, props.dayType, props.baseBoard);
  const maxValue = Math.max(160, ...rows.map((r) => r.value ?? 0));
  return (
    <Card>
      <h2 className="card-title">시간대별 예보</h2>
      {props.rec ? (
        <p className="recommend">
          {formatTime(props.rec.minutes)}에 타면 {LEVEL_TEXT[props.rec.level].label} ({props.rec.value}%)
        </p>
      ) : (
        <p className="muted small">앞뒤 시간대도 혼잡 단계가 비슷해요.</p>
      )}
      <ul className="timeline">
        {rows.map((r) => (
          <li key={r.offset}>
            <button
              type="button"
              className={`timeline-row ${r.minutes === props.board ? "timeline-on" : ""}`}
              onClick={() => props.onPick(r.minutes)}
              aria-label={`${formatTime(r.minutes)} 탑승 ${r.value ?? "정보 없음"}%`}
            >
              <span className="timeline-time">
                {formatTime(r.minutes)}
                {r.offset === 0 && <span className="tag">평소</span>}
              </span>
              <span className="bar-track">
                {r.value !== null && (
                  <span className={`bar bar-${levelOf(r.value)}`} style={{ width: `${Math.min(100, (r.value / maxValue) * 100)}%` }} />
                )}
              </span>
              <span className="timeline-value">{r.value === null ? "-" : `${r.value}%`}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small">시각을 누르면 위 카드와 구간별 혼잡도가 그 시각 기준으로 바뀌어요.</p>
    </Card>
  );
}

function SectionView({ f }: { f: ReturnType<typeof forecastRoute> }) {
  return (
    <Card>
      <h2 className="card-title">
        구간별 혼잡도 · {f.stops.length - 1}개 역 · 약 {f.travelMinutes}분
      </h2>
      <p className="muted small">각 역을 출발할 때의 예상 혼잡도예요.</p>
      <ol className="stops">
        {f.stops.map((s, i) => (
          <li key={s.code} className={i === f.maxIndex ? "stop-max" : ""}>
            <span className={`stop-dot ${s.value === null ? "" : `dot-${levelOf(s.value)}`}`} />
            <span className="stop-name">{s.name}</span>
            <span className="stop-time">{formatTime(s.minutes)}</span>
            <span className="stop-value">{s.value === null ? (i === f.stops.length - 1 ? "도착" : "-") : `${s.value}%`}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
