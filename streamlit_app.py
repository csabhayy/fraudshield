import streamlit as st
import requests
import os

API_BASE = os.getenv("API_BASE", "http://localhost:8000")

st.set_page_config(page_title="FraudShield Copilot", layout="wide")
st.title("🛡️ FraudShield AI Copilot")

st.sidebar.header("Investigate a Transaction")
tx_id = st.sidebar.text_input("Transaction ID")
if st.sidebar.button("Investigate"):
    if tx_id:
        with st.spinner("Analyzing..."):
            resp = requests.post(f"{API_BASE}/investigate", json={"transaction_id": tx_id})
            if resp.status_code == 200:
                st.session_state["case"] = resp.json()
                st.success("Investigation completed")
            else:
                st.error("Transaction not found")

if "case" in st.session_state:
    case = st.session_state["case"]
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Case ID", case["case_id"])
        st.metric("Risk Score", case["risk_score"], delta=case["risk_level"])
        st.metric("Recommendation", case["recommendation"])
    with col2:
        st.metric("Amount", f"${case['amount']:,.2f}")
        st.metric("Status", case["status"])
        st.metric("Similar Cases", len(case.get("similar_cases", [])))

    st.subheader("Reasons")
    for r in case.get("reasons", []):
        st.info(f"**{r['rule']}** (+{r['points']}) – {r['evidence']}")

    st.subheader("Graph Evidence")
    for ev in case.get("graph", {}).get("evidence", []):
        st.write(f"- {ev}")

    if case.get("graph", {}).get("cycles"):
        st.write("**Cycles detected:**")
        for cyc in case["graph"]["cycles"][:3]:
            st.write(" → ".join(cyc))

    st.subheader("Similar Past Cases")
    for sim in case.get("similar_cases", [])[:3]:
        st.write(f"Case {sim['case_id']} – Risk {sim['risk_score']} – Decision: {sim.get('reviewer_decision', 'Unknown')}")

    st.subheader("🤖 Chat with Copilot")
    q = st.text_input("Ask a question about this case")
    if st.button("Send"):
        if q:
            with st.spinner("Thinking..."):
                resp = requests.post(f"{API_BASE}/chat", json={"case_id": case["case_id"], "query": q})
                if resp.status_code == 200:
                    st.write("**Copilot:**", resp.json()["response"])
                else:
                    st.error("Error getting response")