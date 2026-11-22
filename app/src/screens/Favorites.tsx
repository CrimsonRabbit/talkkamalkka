import { Card, LineBadge, Page } from "../components";
import { DAY_NAMES, pickRoute } from "../lib/forecast";
import type { ForecastData, SavedRoute } from "../lib/types";
import type { Nav } from "../nav";

function daysText(days: number[]): string {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (sorted.join() === "1,2,3,4,5") return "평일";
  if (sorted.join() === "6,0") return "주말";
  if (sorted.length === 7) return "매일";
  return sorted.map((d) => DAY_NAMES[d]).join("·");
}

export function Favorites(props: { data: ForecastData; routes: SavedRoute[]; nav: Nav }) {
  const { data, routes, nav } = props;
  return (
    <Page title="즐겨찾기" sub="경로는 이 기기의 토스 앱에만 저장돼요.">
      {routes.map((r) => {
        const route = pickRoute(data, r.origin, r.dest, r.line);
        return (
          <Card key={r.id} onClick={() => nav.push({ name: "edit", routeId: r.id })}>
            <div className="route-card-head">
              <span className="route-label">{r.label}</span>
              <span className="muted">
                {daysText(r.days)} {r.time}
              </span>
            </div>
            <div className="route-card-title">
              {route && <LineBadge data={data} line={route.line} />} {r.origin} → {r.dest}
            </div>
            <p className="muted small">눌러서 수정하거나 삭제할 수 있어요.</p>
          </Card>
        );
      })}
      {routes.length === 0 && <p className="muted">아직 저장한 경로가 없어요.</p>}
      {routes.length < 5 ? (
        <button type="button" className="secondary" onClick={() => nav.push({ name: "edit" })}>
          + 경로 추가하기
        </button>
      ) : (
        <p className="muted small">경로는 5개까지 저장할 수 있어요.</p>
      )}
    </Page>
  );
}
