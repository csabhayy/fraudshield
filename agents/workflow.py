"""LangGraph workflow definition."""
from langgraph.graph import StateGraph, END
from .nodes import (
    data_retriever_node,
    graph_analyst_node,
    rule_engine_node,
    anomaly_detector_node,
    rag_retriever_node,
    report_generator_node
)

def build_investigation_workflow():
    workflow = StateGraph(dict)
    workflow.add_node("data_retriever", data_retriever_node)
    workflow.add_node("graph_analyst", graph_analyst_node)
    workflow.add_node("rule_engine", rule_engine_node)
    workflow.add_node("anomaly_detector", anomaly_detector_node)
    workflow.add_node("rag_retriever", rag_retriever_node)
    workflow.add_node("report_generator", report_generator_node)

    workflow.set_entry_point("data_retriever")
    workflow.add_edge("data_retriever", "graph_analyst")
    workflow.add_edge("graph_analyst", "rule_engine")
    workflow.add_edge("rule_engine", "anomaly_detector")
    workflow.add_edge("anomaly_detector", "rag_retriever")
    workflow.add_edge("rag_retriever", "report_generator")
    workflow.add_edge("report_generator", END)
    return workflow.compile()