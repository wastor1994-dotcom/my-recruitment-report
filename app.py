"""
Recruitment Report — แดชบอร์ดสถิติการสรรหาบุคลากร (Streamlit)
อ่านข้อมูลจาก data/recruitment.csv (แก้ไขหรือแทนที่ไฟล์ได้ตามจริง)
"""

from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

DATA_PATH = Path(__file__).resolve().parent / "data" / "recruitment.csv"

STAGE_ORDER = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]
STAGE_LABELS_TH = {
    "Applied": "สมัคร",
    "Screening": "คัดกรอง",
    "Interview": "สัมภาษณ์",
    "Offer": "เสนอจ้าง",
    "Hired": "รับเข้าทำงาน",
    "Rejected": "ไม่ผ่าน/ปฏิเสธ",
}


@st.cache_data
def load_recruitment(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["applied_date"] = pd.to_datetime(df["applied_date"], errors="coerce")
    for col in ("interview_date", "offer_date", "hired_date"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def stage_to_category(stage: str) -> str:
    s = str(stage).strip()
    if s in STAGE_ORDER:
        return s
    return "Applied"


def compute_funnel_counts(df: pd.DataFrame) -> pd.DataFrame:
    """นับจำนวนตามสถานะล่าสุด (แต่ละคนอยู่สเตจเดียว)."""
    rows = []
    for stage in STAGE_ORDER:
        if stage == "Rejected":
            continue
        n = (df["stage"] == stage).sum()
        rows.append({"stage": stage, "count": int(n)})
    return pd.DataFrame(rows)


def main() -> None:
    st.set_page_config(
        page_title="Recruitment Report",
        page_icon="📊",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    st.title("📊 Recruitment Report")
    st.caption("สรุปสถิติการสรรหา — โหลดจาก `data/recruitment.csv`")

    if not DATA_PATH.exists():
        st.error(f"ไม่พบไฟล์ข้อมูล: `{DATA_PATH}`")
        st.stop()

    df = load_recruitment(str(DATA_PATH))
    df["stage"] = df["stage"].apply(stage_to_category)

    min_d = df["applied_date"].min()
    max_d = df["applied_date"].max()
    if pd.isna(min_d):
        min_d = pd.Timestamp.today()
    if pd.isna(max_d):
        max_d = pd.Timestamp.today()

    with st.sidebar:
        st.header("ตัวกรอง")
        date_from, date_to = st.date_input(
            "ช่วงวันที่สมัคร",
            value=(min_d.date(), max_d.date()),
            min_value=min_d.date(),
            max_value=max_d.date(),
        )
        depts = ["ทั้งหมด"] + sorted(df["department"].dropna().unique().tolist())
        dept = st.selectbox("ฝ่าย", depts)
        positions = ["ทั้งหมด"] + sorted(df["position"].dropna().unique().tolist())
        pos = st.selectbox("ตำแหน่ง", positions)
        st.divider()
        st.markdown("**คอลัมน์ใน CSV**")
        st.code(
            "candidate_id, position, department, applied_date, "
            "stage, source, interview_date, offer_date, hired_date",
            language=None,
        )

    mask = (df["applied_date"] >= pd.Timestamp(date_from)) & (
        df["applied_date"] <= pd.Timestamp(date_to)
    )
    dff = df.loc[mask].copy()
    if dept != "ทั้งหมด":
        dff = dff[dff["department"] == dept]
    if pos != "ทั้งหมด":
        dff = dff[dff["position"] == pos]

    total = len(dff)
    hired = int((dff["stage"] == "Hired").sum())
    rejected = int((dff["stage"] == "Rejected").sum())
    in_pipeline = total - hired - rejected
    hire_rate = (hired / total * 100) if total else 0.0

    # เวลาเฉลี่ยจากสมัครถึงรับ (วัน) — เฉพาะผู้ที่ Hired
    hired_df = dff[dff["stage"] == "Hired"].dropna(subset=["hired_date", "applied_date"])
    if len(hired_df):
        tth = (hired_df["hired_date"] - hired_df["applied_date"]).dt.days
        avg_tth = float(tth.mean())
    else:
        avg_tth = 0.0

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("ผู้สมัครทั้งหมด", f"{total:,}")
    c2.metric("รับเข้าทำงาน", f"{hired:,}")
    c3.metric("อัตรา Conversion (Hired/ทั้งหมด)", f"{hire_rate:.1f}%")
    c4.metric("อยู่ในกระบวนการ", f"{in_pipeline:,}")
    c5.metric("เวลาเฉลี่ยสมัคร→รับ (วัน)", f"{avg_tth:.0f}" if hired else "—")

    tab1, tab2, tab3 = st.tabs(["ภาพรวม & Funnel", "ตามแหล่งที่มา & ฝ่าย", "ไทม์ไลน์"])

    with tab1:
        col_a, col_b = st.columns(2)
        funnel_df = compute_funnel_counts(dff)
        funnel_df["label_th"] = funnel_df["stage"].map(STAGE_LABELS_TH)
        fig_funnel = go.Figure(
            go.Funnel(
                y=funnel_df["label_th"],
                x=funnel_df["count"],
                textinfo="value+percent initial",
            )
        )
        fig_funnel.update_layout(
            title="Funnel ตามสถานะปัจจุบัน",
            margin=dict(l=20, r=20, t=50, b=20),
            height=420,
        )
        col_a.plotly_chart(fig_funnel, use_container_width=True)

        stage_counts = dff["stage"].value_counts().reindex(STAGE_ORDER, fill_value=0)
        fig_bar = px.bar(
            x=[STAGE_LABELS_TH.get(s, s) for s in stage_counts.index],
            y=stage_counts.values,
            labels={"x": "สถานะ", "y": "จำนวน"},
            title="จำนวนผู้สมัครตามสถานะ",
        )
        fig_bar.update_layout(height=420, showlegend=False)
        col_b.plotly_chart(fig_bar, use_container_width=True)

    with tab2:
        c_src, c_dept = st.columns(2)
        src = dff["source"].fillna("ไม่ระบุ").value_counts().reset_index()
        src.columns = ["แหล่งที่มา", "จำนวน"]
        fig_src = px.pie(src, names="แหล่งที่มา", values="จำนวน", title="สัดส่วนตามแหล่งที่มา")
        fig_src.update_layout(height=400)
        c_src.plotly_chart(fig_src, use_container_width=True)

        dept_c = dff.groupby("department", as_index=False).size()
        dept_c.columns = ["ฝ่าย", "จำนวนผู้สมัคร"]
        fig_dept = px.bar(
            dept_c,
            x="ฝ่าย",
            y="จำนวนผู้สมัคร",
            color="ฝ่าย",
            title="ผู้สมัครตามฝ่าย",
        )
        fig_dept.update_layout(height=400, showlegend=False)
        c_dept.plotly_chart(fig_dept, use_container_width=True)

        hired_by_dept = (
            dff[dff["stage"] == "Hired"].groupby("department", as_index=False).size()
        )
        hired_by_dept.columns = ["ฝ่าย", "จำนวนที่รับ"]
        if not hired_by_dept.empty:
            fig_h = px.bar(
                hired_by_dept,
                x="ฝ่าย",
                y="จำนวนที่รับ",
                title="จำนวนที่รับเข้าทำงานตามฝ่าย",
            )
            fig_h.update_layout(height=350, showlegend=False)
            st.plotly_chart(fig_h, use_container_width=True)

    with tab3:
        dff["month"] = dff["applied_date"].dt.to_period("M").astype(str)
        monthly = dff.groupby("month", as_index=False).size()
        monthly.columns = ["เดือน", "ผู้สมัคร"]
        fig_m = px.line(
            monthly,
            x="เดือน",
            y="ผู้สมัคร",
            markers=True,
            title="แนวโน้มผู้สมัครตามเดือน (วันที่สมัคร)",
        )
        fig_m.update_layout(height=400)
        st.plotly_chart(fig_m, use_container_width=True)

        hired_m = (
            dff[dff["stage"] == "Hired"]
            .assign(hm=lambda x: x["hired_date"].dt.to_period("M").astype(str))
            .groupby("hm", as_index=False)
            .size()
        )
        hired_m.columns = ["เดือน (วันที่รับ)", "จำนวนรับ"]
        if not hired_m.empty:
            fig_hm = px.bar(
                hired_m,
                x="เดือน (วันที่รับ)",
                y="จำนวนรับ",
                title="จำนวนที่รับเข้าทำงานตามเดือน (ตามวันที่รับจริง)",
            )
            fig_hm.update_layout(height=380, showlegend=False)
            st.plotly_chart(fig_hm, use_container_width=True)

    with st.expander("ดูตารางข้อมูลดิบ"):
        st.dataframe(dff.sort_values("applied_date", ascending=False), use_container_width=True)


if __name__ == "__main__":
    main()
