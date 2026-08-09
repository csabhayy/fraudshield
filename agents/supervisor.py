"""Supervisor node (placeholder for future conditional routing)."""
from typing import Dict, Any
from langgraph.graph import END

def supervisor_node(state: Dict[str, Any]) -> Dict[str, Any]:
    if state.get("error"):
        return {"next": END}
    return state