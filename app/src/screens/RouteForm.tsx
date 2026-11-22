import { useMemo, useState } from "react";
import { LineBadge, PrimaryButton, StationField } from "../components";
import { DAY_NAMES, MINUTES_PER_HOP, findRoutes, stationName } from "../lib/forecast";
import { newRouteId } from "../lib/storage";
import type { ForecastData, SavedRoute } from "../lib/types";

const LABELS = ["출근", "퇴근", "주말"];

export function RouteForm(props: {
  data: ForecastData;
  initial?: SavedRoute;
  submitText: string;
  onSubmit: (r: SavedRoute) => void;
  onDelete?: () => void;
}) {
  const { data, initial } = props;
  const [origin, setOrigin] = useState<string | null>(initial?.origin ?? null);
  const [dest, setDest] = useState<string | null>(initial?.dest ?? null);
  const [line, setLine] = useState<string | undefined>(initial?.line);
  const [days, setDays] = useState<number[]>(initial?.days ?? [1, 2, 3, 4, 5]);
  const [time, setTime] = useState(initial?.time ?? "08:00");
  const [label, setLabel] = useState(initial?.label ?? "출근");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const routes = useMemo(() => (origin && dest ? findRoutes(data, origin, dest) : []), [data, origin, dest]);
  const route = routes.find((r) => r.line === line) ?? routes[0];
  const noRoute = origin && dest && routes.length === 0;
  const valid = Boolean(route && days.length > 0 && /^\d{2}:\d{2}$/.test(time) && label.trim());

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  return (
    <>
      <div className="form">
        <StationField data={data} label="출발역" value={origin} placeholder="어디서 타나요?" onChange={setOrigin} exclude={dest} />
        <StationField data={data} label="도착역" value={dest} placeholder="어디서 내리나요?" onChange={setDest} exclude={origin} />

        {noRoute && (
          <p className="notice">
            지금은 갈아타지 않고 한 호선으로 가는 경로만 계산할 수 있어요. 환승 경로는 준비 중이에요.
          </p>
        )}

        {new Set(routes.map((r) => r.line)).size > 1 && (
          <div className="choice-row" role="radiogroup" aria-label="호선 선택">
            {[...new Set(routes.map((r) => r.line))].map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={route?.line === l}
                className={`chip ${route?.line === l ? "chip-on" : ""}`}
                onClick={() => setLine(l)}
              >
                <LineBadge data={data} line={l} /> {l}
              </button>
            ))}
          </div>
        )}

        {route && (
          <p className="route-hint">
            <LineBadge data={data} line={route.line} /> {route.line} {route.directionLabel} · {route.codes.length - 1}개 역 · 약{" "}
            {(route.codes.length - 1) * MINUTES_PER_HOP}분
            <br />
            <span className="muted">
              {stationName(data, route.line, route.codes[0])} → {stationName(data, route.line, route.codes[route.codes.length - 1])}
            </span>
          </p>
        )}

        <div className="field-group">
          <span className="field-label">타는 요일</span>
          <div className="choice-row">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                className={`chip chip-day ${days.includes(d) ? "chip-on" : ""}`}
                onClick={() => toggleDay(d)}
              >
                {DAY_NAMES[d]}
              </button>
            ))}
          </div>
        </div>

        <label className="field-group">
          <span className="field-label">타는 시각</span>
          <input className="input" type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
        </label>

        <div className="field-group">
          <span className="field-label">이름</span>
          <div className="choice-row">
            {LABELS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={label === l}
                className={`chip ${label === l ? "chip-on" : ""}`}
                onClick={() => setLabel(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <input
            className="input"
            maxLength={10}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="경로 이름 직접 입력"
          />
        </div>

        {props.onDelete &&
          (confirmDelete ? (
            <div className="confirm-box">
              <p>이 경로를 삭제할까요? 삭제하면 되돌릴 수 없어요.</p>
              <div className="choice-row">
                <button type="button" className="chip" onClick={() => setConfirmDelete(false)}>
                  취소
                </button>
                <button type="button" className="chip chip-danger" onClick={props.onDelete}>
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="danger-link" onClick={() => setConfirmDelete(true)}>
              이 경로 삭제하기
            </button>
          ))}
      </div>

      <PrimaryButton
        disabled={!valid}
        onClick={() => {
          if (!route || !origin || !dest) return;
          props.onSubmit({
            id: initial?.id ?? newRouteId(),
            label: label.trim(),
            origin,
            dest,
            line: route.line,
            days,
            time,
          });
        }}
      >
        {props.submitText}
      </PrimaryButton>
    </>
  );
}
