// 번들에 들어 있는 예측표를 불러와요. (서버 없음)
import type { ForecastData } from "./types";

let cache: Promise<ForecastData> | null = null;

export function loadForecast(): Promise<ForecastData> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}data/forecast.json`).then((res) => {
      if (!res.ok) throw new Error(`예측표를 불러오지 못했어요 (${res.status})`);
      return res.json() as Promise<ForecastData>;
    });
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}
