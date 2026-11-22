// intoss://tkkmkk/quick, intoss://tkkmkk?screen=favorites 처럼 들어오면 그 화면을 먼저 열어요.
// 콘솔의 '주요 기능'에 등록한 주소가 여기로 연결돼요.
import { Environment } from "@apps-in-toss/web-framework";

export type EntryScreen = "home" | "quick" | "favorites" | null;

export function parseEntry(url: string): EntryScreen {
  const lower = url.toLowerCase();
  const query = lower.includes("?") ? lower.slice(lower.indexOf("?") + 1) : "";
  const screen = new URLSearchParams(query).get("screen");
  const path = lower.split("?")[0];
  const pick = (v: string | null | undefined): EntryScreen =>
    v === "quick" || v === "favorites" || v === "home" ? v : null;
  return pick(screen) ?? pick(path.split("/").filter(Boolean).pop());
}

export function entryScreen(): EntryScreen {
  let url = "";
  try {
    url = Environment.initialURL || "";
  } catch {
    url = "";
  }
  return parseEntry(url) ?? parseEntry(window.location.href);
}
