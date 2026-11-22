"""탈까말까 예측표 만들기

data/raw 폴더의 '서울교통공사_지하철혼잡도정보_YYYYMMDD.csv' 중 최근 4개 분기를
가중평균(0.4·0.3·0.2·0.1)해서 앱이 쓰는 예측표(JSON)를 만들어요.

    실행:  .venv\\Scripts\\python analysis\\build_forecast.py

결과:
    data/processed/forecast.json     (분석용 사본)
    app/public/data/forecast.json    (미니앱 번들에 들어가는 파일)

새 분기 파일이 나오면 data/raw에 넣고 다시 실행한 뒤 앱을 다시 빌드하면 돼요.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT_PROCESSED = ROOT / "data" / "processed" / "forecast.json"
OUT_APP = ROOT / "app" / "public" / "data" / "forecast.json"

WEIGHTS = [0.4, 0.3, 0.2, 0.1]  # 최근 분기부터
FILE_PATTERN = re.compile(r"지하철혼잡도정보_(\d{8})")

LINE_COLORS = {
    "1호선": "#0052A4",
    "2호선": "#00A84D",
    "3호선": "#EF7C1C",
    "4호선": "#00A5DE",
    "5호선": "#996CAC",
    "6호선": "#CD7C2F",
    "7호선": "#747F00",
    "8호선": "#E6186C",
}

DAY_MAP = {"평일": "w", "토요일": "sat", "일요일": "sun", "공휴일": "sun"}

# ---------------------------------------------------------------- 읽기

def read_csv(path: Path) -> pd.DataFrame:
    last_error: Exception | None = None
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            return pd.read_csv(path, encoding=enc, dtype=str)
        except (UnicodeDecodeError, pd.errors.ParserError) as e:
            last_error = e
    raise RuntimeError(f"{path.name} 파일을 읽지 못했어요: {last_error}")


def slot_name(col: str) -> str | None:
    """'5시30분' → '05:30'"""
    m = re.fullmatch(r"\s*(\d{1,2})\s*시\s*(\d{2})\s*분\s*", col)
    if not m:
        return None
    return f"{int(m.group(1)):02d}:{m.group(2)}"


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns=lambda c: str(c).strip())
    rename = {}
    for c in df.columns:
        if c in ("요일구분", "구분"):
            rename[c] = "day"
        elif c == "호선":
            rename[c] = "line"
        elif c == "역번호":
            rename[c] = "code"
        elif c in ("역명", "출발역"):
            rename[c] = "name"
        elif c in ("상하구분", "상하선구분"):
            rename[c] = "dir"
        elif slot_name(c):
            rename[c] = slot_name(c)
    df = df.rename(columns=rename)
    missing = {"day", "line", "code", "name", "dir"} - set(df.columns)
    if missing:
        raise RuntimeError(f"필요한 컬럼이 없어요: {missing} / 실제 컬럼: {list(df.columns)[:8]}")
    for c in ("day", "line", "code", "name", "dir"):
        df[c] = df[c].astype(str).str.strip()
    df["line"] = df["line"].map(lambda v: v if v.endswith("호선") else f"{int(float(v))}호선")
    df["code"] = df["code"].map(lambda v: str(int(float(v))) if re.fullmatch(r"\d+(\.0)?", v) else v)
    df["day"] = df["day"].map(DAY_MAP)
    df = df[df["day"].notna()]
    return df


def slot_order(slots: list[str]) -> list[str]:
    def key(s: str) -> int:
        h, m = map(int, s.split(":"))
        minutes = h * 60 + m
        return minutes + 1440 if minutes < 300 else minutes

    return sorted(set(slots), key=key)


# ---------------------------------------------------------------- 가중평균

def load_quarters() -> list[tuple[str, pd.DataFrame]]:
    files = []
    for p in RAW.glob("*.csv"):
        m = FILE_PATTERN.search(p.name)
        if m:
            files.append((m.group(1), p))
    files.sort(reverse=True)
    if not files:
        sys.exit(f"data/raw에 '서울교통공사_지하철혼잡도정보_YYYYMMDD.csv' 파일이 없어요. ({RAW})")
    picked = files[: len(WEIGHTS)]
    print("사용할 파일 (최근 순):")
    for (date, p), w in zip(picked, WEIGHTS):
        print(f"  {date}  가중치 {w}  {p.name}")
    return [(date, normalize(read_csv(p))) for date, p in picked]


def weighted_values(quarters: list[tuple[str, pd.DataFrame]], slots: list[str]) -> dict:
    """키 (line, code, dir, day) → 39칸 가중평균"""
    acc: dict[tuple, list[list[float]]] = {}
    for (date, df), w in zip(quarters, WEIGHTS):
        cols = [s for s in slots if s in df.columns]
        nums = df[cols].apply(lambda s: pd.to_numeric(s.str.replace(",", "").str.strip(), errors="coerce"))
        for idx, row in df.iterrows():
            series = [nums.at[idx, s] if s in nums.columns else float("nan") for s in slots]
            valid = [v for v in series if pd.notna(v)]
            if not valid:
                continue
            key = (row["line"], row["code"], row["dir"], row["day"])
            acc.setdefault(key, []).append([w] + series)

    result = {}
    for key, rows in acc.items():
        out = []
        for i in range(len(slots)):
            pairs = [(r[0], r[i + 1]) for r in rows if pd.notna(r[i + 1])]
            if not pairs:
                out.append(0)
                continue
            total_w = sum(w for w, _ in pairs)
            out.append(round(sum(w * v for w, v in pairs) / total_w))
        result[key] = out
    return result


# ---------------------------------------------------------------- 노선 구조

def r(a: int, b: int) -> list[str]:
    """a부터 b까지 역번호 (b 포함)"""
    return [str(c) for c in range(a, b + 1)]


# 운행 순서대로 적은 역번호와 방향 이름이에요.
# forward = codes 순서대로 갈 때의 상하구분, backward = 반대로 갈 때.
# 방향은 종착역에서 혼잡도가 0이 되는 쪽으로 확인했어요 (예: 3호선 오금 하선 = 0).
# alias: 분기역에서 갈래별 혼잡도가 9000번대 역번호에 따로 들어 있어요.
# forwardTerminal/backwardTerminal: 서울교통공사 구간 밖까지 운행하는 노선의 실제 종착역 (방면 표시용)
TOPOLOGY: dict[str, list[dict]] = {
    # 1호선은 동묘앞(159)이 동대문(155)과 신설동(156) 사이에 있어요.
    "1호선": [{"codes": r(150, 155) + ["159"] + r(156, 158), "forward": "상선", "backward": "하선"}],
    "2호선": [
        # 본선 순환: 시청→을지로입구 방향이 내선(시계방향)
        {"codes": r(201, 243), "forward": "내선", "backward": "외선", "circular": True, "alias": {"211:외선": "9001"}},
        # 성수지선: 성수→용답→신답→용두→신설동 방향이 외선
        {"codes": ["211", "244", "245", "250", "246"], "forward": "외선", "backward": "내선", "alias": {"211:외선": "9002"}},
        # 신정지선: 신도림→도림천→양천구청→신정네거리→까치산 방향이 내선
        {"codes": ["234", "247", "248", "249", "260"], "forward": "내선", "backward": "외선", "alias": {"234:내선": "9003"}},
    ],
    "3호선": [{"codes": r(309, 342), "forward": "하선", "backward": "상선", "backwardTerminal": "대화"}],
    "4호선": [{"codes": r(409, 434), "forward": "하선", "backward": "상선", "forwardTerminal": "오이도", "backwardTerminal": "진접"}],
    "5호선": [
        # 본선: 방화 → 상일동 → 하남검단산
        {"codes": r(2511, 2554) + r(2562, 2566), "forward": "하선", "backward": "상선"},
        # 마천지선: 강동 → 둔촌동 → … → 마천
        {"codes": ["2549"] + r(2555, 2561), "forward": "하선", "backward": "상선", "alias": {"2549:하선": "9005"}},
        # 방화 ↔ 마천 직통 (강동에서 마천 쪽으로 갈라져요)
        {"codes": r(2511, 2549) + r(2555, 2561), "forward": "하선", "backward": "상선", "alias": {"2549:하선": "9005"}},
    ],
    "6호선": [
        # 본선: 응암 ↔ 신내 (응암에서 새절로 가는 하선 값은 9006 '응암S')
        {"codes": ["2611"] + r(2617, 2649), "forward": "하선", "backward": "상선", "alias": {"2611:하선": "9006"}},
        # 응암순환: 역촌→불광→독바위→연신내→구산→응암→새절… 하선 한 방향만 다녀요.
        {"codes": r(2612, 2616) + ["2611"] + r(2617, 2649), "forward": "하선", "backward": "상선",
         "oneway": True, "alias": {"2611:하선": "9006"}},
    ],
    "7호선": [{"codes": r(2711, 2752), "forward": "하선", "backward": "상선", "forwardTerminal": "석남"}],
    # 8호선은 남위례(2828)가 복정(2821)과 산성(2822) 사이에 있어요.
    "8호선": [{"codes": r(2810, 2821) + ["2828"] + r(2822, 2827), "forward": "하선", "backward": "상선", "backwardTerminal": "별내"}],
}


def clean_name(name: str) -> str:
    # '신촌(지하)', '강동(하남검단산)'처럼 구분용으로 붙은 말은 빼요. ('올림픽공원(한국체대)' 같은 역명은 그대로)
    for suffix in ("(지하)", "(하남검단산)", "(마천)"):
        name = name.replace(suffix, "")
    return name.strip()


def build_lines(latest: pd.DataFrame) -> tuple[dict, dict]:
    stations = {}
    lines = {}
    for line, g in latest.groupby("line"):
        names = {code: grp.mode().iloc[0] for code, grp in g.groupby("code")["name"]}
        in_topology = set()
        segments = []
        for seg in TOPOLOGY.get(line, []):
            codes = [c for c in seg["codes"] if c in names]
            missing = [c for c in seg["codes"] if c not in names]
            if missing:
                print(f"  ! {line} 데이터에 없는 역번호: {missing}")
            in_topology.update(codes)
            segments.append({**seg, "codes": codes})
        for code in sorted(in_topology, key=lambda c: int(c)):
            stations[f"{line}:{code}"] = {"line": line, "code": code, "name": clean_name(names[code])}
        extra = sorted(c for c in names if c not in in_topology and not c.startswith("9"))
        if extra:
            print(f"  ! {line} 노선 구조에 없는 역번호(앱에서 빠짐): {extra}")
        lines[line] = {"color": LINE_COLORS.get(line, "#8b95a1"), "segments": segments}
    return lines, stations


def check_directions(values: dict, lines: dict) -> None:
    """종착역에서 그쪽으로 가는 열차의 혼잡도는 0이어야 해요. 다르면 방향 이름을 다시 봐야 해요."""
    terminals = [("3호선", "342", "하선"), ("5호선", "2511", "상선"), ("5호선", "2566", "하선"),
                 ("5호선", "2561", "하선"), ("6호선", "2649", "하선"), ("7호선", "2711", "상선"),
                 ("8호선", "2827", "하선"), ("2호선", "246", "외선"), ("2호선", "260", "내선")]
    print("\n방향 확인 (종착역 평일 합계가 0이어야 정상):")
    ok = True
    for line, code, d in terminals:
        total = sum(values.get((line, code, d, "w"), [0]))
        flag = "OK" if total == 0 else "확인 필요"
        ok = ok and total == 0
        print(f"  {line} {code} {d}: {total} {flag}")
    if not ok:
        print("  ! 방향 이름이 데이터와 맞지 않을 수 있어요. TOPOLOGY를 확인해 주세요.")


# ---------------------------------------------------------------- 공휴일

FIXED_HOLIDAYS = ["01-01", "03-01", "05-05", "06-06", "08-15", "10-03", "10-09", "12-25"]
SUBSTITUTE_OK = {"03-01", "05-05", "08-15", "10-03", "10-09", "12-25"}


def fixed_holidays(years: list[int]) -> list[str]:
    """양력 공휴일과 대체공휴일. 설·추석·부처님오신날 같은 음력 공휴일은 API로 받아요."""
    days = set()
    for y in years:
        for md in FIXED_HOLIDAYS:
            d = dt.date(y, int(md[:2]), int(md[3:]))
            days.add(d)
            if md in SUBSTITUTE_OK and d.weekday() >= 5:
                sub = d + dt.timedelta(days=7 - d.weekday())  # 다음 월요일
                days.add(sub)
    return sorted(d.isoformat() for d in days)


def api_holidays(years: list[int]) -> list[str]:
    """한국천문연구원 특일 정보 API (DATA_GO_KR_SERVICE_KEY가 .env에 있을 때만)"""
    key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
    if not key:
        try:
            from dotenv import load_dotenv

            load_dotenv(ROOT / ".env")
            key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
        except ImportError:
            pass
    if not key:
        print("\n.env에 DATA_GO_KR_SERVICE_KEY가 없어 음력 공휴일은 넣지 않았어요.")
        return []
    import requests

    days = []
    for y in years:
        for m in range(1, 13):
            r = requests.get(
                "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo",
                params={"serviceKey": key, "solYear": y, "solMonth": f"{m:02d}", "_type": "json", "numOfRows": 50},
                timeout=10,
            )
            r.raise_for_status()
            items = r.json().get("response", {}).get("body", {}).get("items") or {}
            item = items.get("item", []) if isinstance(items, dict) else []
            for it in item if isinstance(item, list) else [item]:
                if it.get("isHoliday") == "Y":
                    s = str(it["locdate"])
                    days.append(f"{s[:4]}-{s[4:6]}-{s[6:]}")
    print(f"\n특일 API에서 공휴일 {len(days)}일을 받았어요.")
    return days


# ---------------------------------------------------------------- 실행

def main() -> None:
    quarters = load_quarters()
    slots = slot_order([c for _, df in quarters for c in df.columns if re.fullmatch(r"\d{2}:\d{2}", c)])
    values = weighted_values(quarters, slots)
    lines, stations = build_lines(quarters[0][1])
    check_directions(values, lines)

    out_values: dict[str, dict] = {}
    for (line, code, d, day), series in values.items():
        out_values.setdefault(f"{line}:{code}:{d}", {})[day] = series

    years = [dt.date.today().year, dt.date.today().year + 1]
    holidays = sorted(set(fixed_holidays(years)) | set(api_holidays(years)))

    dates = [d for d, _ in quarters]
    data = {
        "source": f"{dates[-1][:4]}.{dates[-1][4:6]}~{dates[0][:4]}.{dates[0][4:6]} 기준 {len(dates)}개 분기",
        "generatedAt": dt.datetime.now().isoformat(timespec="seconds"),
        "slots": slots,
        "lines": lines,
        "stations": stations,
        "values": out_values,
        "holidays": holidays,
    }
    for path in (OUT_PROCESSED, OUT_APP):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = OUT_APP.stat().st_size / 1024
    print(f"\n역 {len(stations)}개, 방향별 시계열 {len(out_values)}개, 시간 칸 {len(slots)}개")
    print(f"저장: {OUT_APP.relative_to(ROOT)} ({size:.0f}KB)")


if __name__ == "__main__":
    main()
