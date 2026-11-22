import { useEffect, useState, type ReactElement } from "react";
import { BottomTabs, Page } from "./components";
import { loadForecast } from "./lib/data";
import { entryScreen } from "./lib/entry";
import { loadRoutes, saveRoutes } from "./lib/storage";
import type { ForecastData, SavedRoute } from "./lib/types";
import { useNav, type Tab } from "./nav";
import { Detail } from "./screens/Detail";
import { Favorites } from "./screens/Favorites";
import { Home } from "./screens/Home";
import { Onboarding } from "./screens/Onboarding";
import { Quick, QuickResult } from "./screens/Quick";
import { RouteForm } from "./screens/RouteForm";

const MAX_ROUTES = 5;

export default function App() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [routes, setRoutes] = useState<SavedRoute[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    Promise.all([loadForecast(), loadRoutes()])
      .then(([d, r]) => {
        setData(d);
        setRoutes(r);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "데이터를 불러오지 못했어요."));
    // 화면을 켜 둔 채 시간이 지나도 '지금' 기준이 맞도록 1분마다 갱신해요.
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (error) {
    return (
      <Page title="잠시 후 다시 시도해 주세요">
        <p className="muted">{error}</p>
      </Page>
    );
  }
  if (!data || !routes) {
    return (
      <Page>
        <p className="muted center">불러오는 중...</p>
      </Page>
    );
  }
  return <Main data={data} routes={routes} setRoutes={setRoutes} now={now} />;
}

function Main(props: {
  data: ForecastData;
  routes: SavedRoute[];
  setRoutes: (r: SavedRoute[]) => void;
  now: Date;
}) {
  const { data, routes, now } = props;
  const [entry] = useState(entryScreen);
  const nav = useNav(entry ? { name: entry } : routes.length === 0 ? { name: "onboarding" } : { name: "home" });
  const s = nav.screen;

  const update = (next: SavedRoute[]) => {
    const trimmed = next.slice(0, MAX_ROUTES);
    props.setRoutes(trimmed);
    void saveRoutes(trimmed);
  };
  const upsert = (r: SavedRoute) => {
    const exists = routes.some((x) => x.id === r.id);
    update(exists ? routes.map((x) => (x.id === r.id ? r : x)) : [...routes, r]);
  };

  let body: ReactElement;
  let tab: Tab | null = null;
  switch (s.name) {
    case "onboarding":
      body = (
        <Onboarding
          data={data}
          onDone={(r) => {
            upsert(r);
            nav.goTab("home");
          }}
          onSkip={() => nav.goTab("quick")}
        />
      );
      break;
    case "home":
      tab = "home";
      body = <Home data={data} routes={routes} nav={nav} now={now} />;
      break;
    case "quick":
      tab = "quick";
      body = <Quick data={data} routes={routes} nav={nav} />;
      break;
    case "favorites":
      tab = "favorites";
      body = <Favorites data={data} routes={routes} nav={nav} />;
      break;
    case "quickResult":
      body = <QuickResult data={data} origin={s.origin} dest={s.dest} line={s.line} now={now} />;
      break;
    case "detail": {
      const saved = routes.find((r) => r.id === s.routeId);
      body = saved ? (
        <Detail key={saved.id} data={data} saved={saved} view={s.view} now={now} nav={nav} />
      ) : (
        <Page title="경로를 찾지 못했어요">
          <p className="muted">즐겨찾기에서 경로를 확인해 주세요.</p>
        </Page>
      );
      break;
    }
    case "edit": {
      const saved = s.routeId ? routes.find((r) => r.id === s.routeId) : undefined;
      body = (
        <Page title={saved ? "경로 수정" : "경로 추가"}>
          <RouteForm
            key={saved?.id ?? "new"}
            data={data}
            initial={saved}
            submitText="저장하기"
            onSubmit={(r) => {
              upsert(r);
              nav.back();
            }}
            onDelete={
              saved
                ? () => {
                    update(routes.filter((x) => x.id !== saved.id));
                    nav.back();
                  }
                : undefined
            }
          />
        </Page>
      );
      break;
    }
  }

  return (
    <div className={tab ? "with-tabs" : ""}>
      {body}
      {tab && <BottomTabs current={tab} onChange={nav.goTab} />}
    </div>
  );
}
