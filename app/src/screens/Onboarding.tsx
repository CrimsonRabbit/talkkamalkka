import { useState } from "react";
import { Legend, Page, PrimaryButton } from "../components";
import type { ForecastData, SavedRoute } from "../lib/types";
import { RouteForm } from "./RouteForm";

export function Onboarding(props: { data: ForecastData; onDone: (r: SavedRoute) => void; onSkip: () => void }) {
  const [step, setStep] = useState<"intro" | "form">("intro");

  if (step === "intro") {
    return (
      <Page>
        <div className="hero">
          <p className="eyebrow">탈까말까</p>
          <h1 className="hero-title">
            타기 전에 보는
            <br />
            지하철 혼잡도
          </h1>
          <p className="page-sub">
            자주 타는 경로를 등록하면 요일·시간대별 예상 혼잡도를 신호등으로 보여 주고, 덜 붐비는 시각을 추천해 드려요.
          </p>
        </div>
        <Legend />
        <button type="button" className="text-button center" onClick={props.onSkip}>
          경로 없이 둘러볼게요
        </button>
        <PrimaryButton onClick={() => setStep("form")}>경로 등록하기</PrimaryButton>
      </Page>
    );
  }

  return (
    <Page title="자주 타는 경로를 알려 주세요" sub="출발역과 도착역, 타는 요일과 시각을 고르면 끝이에요.">
      <RouteForm data={props.data} submitText="저장하고 시작하기" onSubmit={props.onDone} />
    </Page>
  );
}
