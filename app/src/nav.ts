// 화면 이동을 브라우저 history와 맞춰요.
// 토스 앱 내비게이션 바의 뒤로가기(와 Android 뒤로가기)가 이전 화면으로 돌아가도록 하려는 거예요.
import { useCallback, useEffect, useState } from "react";

export type Tab = "home" | "quick" | "favorites";

export type Screen =
  | { name: Tab }
  | { name: "onboarding" }
  | { name: "edit"; routeId?: string }
  | { name: "detail"; routeId: string; view: "time" | "section" }
  | { name: "quickResult"; origin: string; dest: string; line?: string };

export interface Nav {
  screen: Screen;
  push: (s: Screen) => void;
  replace: (s: Screen) => void;
  back: () => void;
  /** 탭을 바꿀 때: 쌓인 화면 없이 그 탭으로 */
  goTab: (t: Tab) => void;
}

export function useNav(initial: Screen): Nav {
  const [stack, setStack] = useState<Screen[]>([initial]);

  useEffect(() => {
    window.history.replaceState({ depth: 0 }, "");
    const onPop = () => {
      setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const push = useCallback((s: Screen) => {
    setStack((prev) => {
      window.history.pushState({ depth: prev.length }, "");
      return [...prev, s];
    });
    window.scrollTo(0, 0);
  }, []);

  const replace = useCallback((s: Screen) => {
    setStack((prev) => [...prev.slice(0, -1), s]);
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    window.history.back();
  }, []);

  const goTab = useCallback((t: Tab) => {
    setStack((prev) => {
      // 쌓여 있던 화면만큼 history도 되돌려요.
      const extra = prev.length - 1;
      if (extra > 0) window.history.go(-extra);
      return [{ name: t }];
    });
    window.scrollTo(0, 0);
  }, []);

  return { screen: stack[stack.length - 1], push, replace, back, goTab };
}
