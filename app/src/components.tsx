import { useMemo, useState, type ReactNode } from "react";
import { LEVEL_TEXT, allStationNames, linesOf, searchStations, type Level } from "./lib/forecast";
import type { ForecastData } from "./lib/types";
import type { Tab } from "./nav";

export function LineBadge({ data, line }: { data: ForecastData; line: string }) {
  const color = data.lines[line]?.color ?? "#8b95a1";
  return (
    <span className="line-badge" style={{ background: color }} aria-label={line}>
      {parseInt(line)}
    </span>
  );
}

export function LevelPill({ level, value }: { level: Level | null; value?: number | null }) {
  if (!level) return <span className="pill pill-none">정보 없음</span>;
  return (
    <span className={`pill pill-${level}`}>
      <span className={`dot dot-${level}`} />
      {LEVEL_TEXT[level].label}
      {value !== undefined && value !== null ? ` · ${value}%` : ""}
    </span>
  );
}

export function Page({ title, sub, children }: { title?: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <main className="page">
      {title && <h1 className="page-title">{title}</h1>}
      {sub && <p className="page-sub">{sub}</p>}
      {children}
    </main>
  );
}

export function Card({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  if (onClick) {
    return (
      <button type="button" className={`card card-button ${className}`} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <section className={`card ${className}`}>{children}</section>;
}

export function PrimaryButton(props: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="bottom-cta">
      <button type="button" className="primary" onClick={props.onClick} disabled={props.disabled}>
        {props.children}
      </button>
    </div>
  );
}

export function BottomTabs({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "home", label: "홈" },
    { key: "quick", label: "빠른 조회" },
    { key: "favorites", label: "즐겨찾기" },
  ];
  return (
    <nav className="tabs" aria-label="주요 메뉴">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`tab ${current === t.key ? "tab-on" : ""}`}
          aria-current={current === t.key ? "page" : undefined}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function Legend() {
  return (
    <ul className="legend">
      <li>
        <span className="dot dot-easy" /> 여유 · 80% 미만
      </li>
      <li>
        <span className="dot dot-normal" /> 보통 · 80~130%
      </li>
      <li>
        <span className="dot dot-busy" /> 혼잡 · 130% 이상
      </li>
    </ul>
  );
}

/** 역 선택 칸. 누르면 검색 화면이 열려요. */
export function StationField(props: {
  data: ForecastData;
  label: string;
  value: string | null;
  placeholder: string;
  onChange: (name: string) => void;
  exclude?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="field" onClick={() => setOpen(true)}>
        <span className="field-label">{props.label}</span>
        {props.value ? (
          <span className="field-value">
            {props.value}
            <span className="badges">
              {linesOf(props.data, props.value).map((l) => (
                <LineBadge key={l} data={props.data} line={l} />
              ))}
            </span>
          </span>
        ) : (
          <span className="field-placeholder">{props.placeholder}</span>
        )}
      </button>
      {open && (
        <StationPicker
          data={props.data}
          title={props.label}
          exclude={props.exclude}
          onClose={() => setOpen(false)}
          onPick={(n) => {
            props.onChange(n);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function StationPicker(props: {
  data: ForecastData;
  title: string;
  exclude?: string | null;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const names = useMemo(() => allStationNames(props.data), [props.data]);
  const results = useMemo(
    () => searchStations(names, q).filter((n) => n !== props.exclude).slice(0, 60),
    [names, q, props.exclude],
  );
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`${props.title} 검색`}>
      <div className="sheet-head">
        <input
          className="search"
          autoFocus
          placeholder="역 이름 검색 (초성도 돼요)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="text-button" onClick={props.onClose}>
          닫기
        </button>
      </div>
      <ul className="station-list">
        {results.map((n) => (
          <li key={n}>
            <button type="button" className="station-row" onClick={() => props.onPick(n)}>
              <span>{n}</span>
              <span className="badges">
                {linesOf(props.data, n).map((l) => (
                  <LineBadge key={l} data={props.data} line={l} />
                ))}
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="empty">찾는 역이 없어요. 서울교통공사 1~8호선 역만 있어요.</li>}
      </ul>
    </div>
  );
}

export function SourceNote({ data }: { data: ForecastData }) {
  return (
    <p className="source-note">
      서울교통공사 공개 혼잡도 자료({data.source})로 계산한 평균 예측이에요. 실시간 혼잡도와 다를 수 있어요.
    </p>
  );
}
