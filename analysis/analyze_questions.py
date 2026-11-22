import sys, json
sys.path.insert(0, "analysis")  # 프로젝트 폴더(talkkamalkka)에서 실행: python analysis/analyze_questions.py
import pandas as pd, numpy as np
from pathlib import Path
import build_forecast as bf
quarters = bf.load_quarters()  # 최근 순 4개
slots = bf.slot_order([c for _, df in quarters for c in df.columns if len(c)==5 and c[2]==":"])
def tidy(df):
    m = df.melt(id_vars=["day","line","code","name","dir"], value_vars=[s for s in slots if s in df.columns], var_name="slot", value_name="v")
    m["v"] = pd.to_numeric(m["v"].astype(str).str.replace(",","").str.strip(), errors="coerce")
    return m
T = {d: tidy(df) for d, df in quarters}
latest = T[quarters[0][0]]
res = {}
# ---------- Q1 요일·시간대
w = latest[(latest.v>0)]
by = w.groupby(["day","slot"]).v.mean().unstack(0).reindex(slots)
peak = {d: (by[d].idxmax(), round(by[d].max(),1)) for d in by.columns}
res["Q1_peak_slot_mean"] = peak
# 출근/퇴근 피크: 평일 오전(05:30~11:30) vs 오후(16:00~21:00)
am = by["w"].loc["06:00":"11:00"]; pm = by["w"].loc["16:00":"21:00"]
res["Q1_am_peak"] = (am.idxmax(), round(am.max(),1)); res["Q1_pm_peak"] = (pm.idxmax(), round(pm.max(),1))
# 지속: 평일 평균이 피크의 80% 이상인 칸 수
res["Q1_am_slots_over80pct"] = int((am >= 0.8*am.max()).sum()); res["Q1_pm_slots_over80pct"] = int((pm >= 0.8*pm.max()).sum())
# 혼잡(130%+) 역·방향 수 (평일 하루 중 한 번이라도)
wd = latest[latest.day=="w"]
mx = wd.groupby(["line","code","name","dir"]).v.max()
res["Q1_busy_station_dirs"] = int((mx>=130).sum()); res["station_dirs"] = int(len(mx))
top = wd.sort_values("v", ascending=False).head(10)[["line","name","dir","slot","v"]]
res["Q1_top10"] = top.values.tolist()
res["Q1_sat_sun_peak"] = {d: (by[d].idxmax(), round(by[d].max(),1)) for d in ["sat","sun"]}
# 토·일 최대 역
for d in ["sat","sun"]:
    x = latest[latest.day==d].sort_values("v", ascending=False).iloc[0]
    res[f"Q1_{d}_max"] = [x.line, x["name"], x.dir, x.slot, x.v]
# ---------- Q2 출발 시각 옮기기 (역·방향 단위, 평일, 혼잡 칸 기준)
p = wd.pivot_table(index=["line","code","dir"], columns="slot", values="v").reindex(columns=slots)
arr = p.values
cells = []  # (value, -30, -15, +15, +30)
for i in range(arr.shape[0]):
    for j in range(2, arr.shape[1]-2):
        v = arr[i,j]
        if not (v >= 130): continue
        m30 = arr[i,j-1]; m15 = (arr[i,j-1]+v)/2; p15 = (arr[i,j+1]+v)/2; p30 = arr[i,j+1]
        cells.append((v,m30,m15,p15,p30))
c = np.array(cells)
def lvl(x): return np.where(x<80,0,np.where(x<130,1,2))
res["Q2_busy_cells"] = int(len(c))
for k,name in [(1,"-30"),(2,"-15"),(3,"+15"),(4,"+30")]:
    res[f"Q2_{name}_drop_level_share"] = round(float((lvl(c[:,k])<2).mean()*100),1)
    res[f"Q2_{name}_mean_change"] = round(float((c[:,k]-c[:,0]).mean()),1)
res["Q2_best_of_-30/-15/+15/+30_drop_share"] = round(float((lvl(c[:,1:]).min(axis=1)<2).mean()*100),1)
# ---------- Q3 예측 정확도 (마지막 분기 = 시험)
keys = ["day","line","code","dir","slot"]
truth = latest[keys+["v"]].rename(columns={"v":"t"})
prev = [T[d][keys+["v"]].rename(columns={"v":d}) for d,_ in quarters[1:]]
m = truth
for pq in prev: m = m.merge(pq, on=keys, how="left")
dates = [d for d,_ in quarters[1:]]
m = m[(m.t>0)]
A = m[dates[0]]
wts = np.array([0.4,0.3,0.2])
vals = m[dates].values
mask = ~np.isnan(vals) & (vals>0)
B = (np.where(mask, vals, 0)*wts).sum(1) / (mask*wts).sum(1)
m = m.assign(A=A.values, B=B)
m = m.dropna(subset=["A","B"])
def score(pred, sub):
    e = (sub[pred]-sub.t).abs()
    return round(float(e.mean()),1), round(float((lvl(sub[pred])==lvl(sub.t)).mean()*100),1), int(len(sub))
res["Q3_test_quarter"] = quarters[0][0]; res["Q3_train_quarters"] = dates
for pred in ["A","B"]:
    res[f"Q3_{pred}_all(MAE,match,n)"] = score(pred, m)
    pk = m[(m.day=="w") & m.slot.isin(["07:00","07:30","08:00","08:30","18:00","18:30","19:00","19:30"])]
    res[f"Q3_{pred}_peak(MAE,match,n)"] = score(pred, pk)
    bz = m[m.t>=100]
    res[f"Q3_{pred}_t>=100(MAE,match,n)"] = score(pred, bz)
for k,v in res.items(): print(k, v)
json.dump(res, open("data/processed/analysis_results.json","w"), ensure_ascii=False, indent=1, default=str)
