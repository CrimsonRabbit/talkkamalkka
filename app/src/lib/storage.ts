// 즐겨찾기 경로를 토스 앱 저장소(Storage)에 보관해요. 앱을 종료해도 유지돼요.
// 토스 앱 밖(일반 브라우저 개발 환경)에서는 localStorage로 대신해요.
import { Storage } from "@apps-in-toss/web-framework";
import type { SavedRoute } from "./types";

const KEY_ROUTES = "tkkmkk.routes.v1";
const KEY_QUICK = "tkkmkk.quickOrigin.v1";

async function getRaw(key: string): Promise<string | null> {
  try {
    return await Storage.getItem(key);
  } catch {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

async function setRaw(key: string, value: string): Promise<void> {
  try {
    await Storage.setItem(key, value);
  } catch {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 저장할 수 없는 환경이면 이번 실행 동안만 유지돼요.
    }
  }
}

export async function loadRoutes(): Promise<SavedRoute[]> {
  const raw = await getRaw(KEY_ROUTES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedRoute[]) : [];
  } catch {
    return [];
  }
}

export async function saveRoutes(routes: SavedRoute[]): Promise<void> {
  await setRaw(KEY_ROUTES, JSON.stringify(routes));
}

export async function loadQuickOrigin(): Promise<string | null> {
  return getRaw(KEY_QUICK);
}

export async function saveQuickOrigin(name: string): Promise<void> {
  await setRaw(KEY_QUICK, name);
}

export function newRouteId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
