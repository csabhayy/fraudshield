"""Graph database client (Neo4j) with fallback to in‑memory networkx."""
import networkx as nx
import pandas as pd
from typing import Dict, List, Any
import os

try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False

# ✅ Absolute import (works both at runtime and with Pylance)
from services.data_service import load_transactions


class Neo4jClient:
    def __init__(self, uri=None, user=None, password=None):
        self.uri = uri or os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = user or os.getenv("NEO4J_USER", "neo4j")
        self.password = password or os.getenv("NEO4J_PASSWORD", "password")
        self.driver = None
        self._use_neo4j = NEO4J_AVAILABLE
        if self._use_neo4j:
            try:
                self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
                with self.driver.session() as session:
                    session.run("RETURN 1")
                print("✅ Neo4j connected.")
            except Exception as e:
                self._use_neo4j = False
                print(f"⚠️ Neo4j connection failed: {e}, falling back to in‑memory graph.")
        if not self._use_neo4j:
            self.graph = nx.DiGraph()
            self._populate_from_csv()

    def _populate_from_csv(self):
        df = load_transactions()
        for _, row in df.iterrows():
            self.graph.add_edge(
                row["source_account"],
                row["beneficiary_account"],
                transaction_id=row["transaction_id"],
                amount=float(row["amount"]),
                timestamp=row["timestamp"].isoformat(),
                device=row["device_id"],
                channel=row["channel"],
                location=row["location"]
            )
        print(f"📊 In‑memory graph populated with {len(df)} edges.")

    def clear_graph(self):
        """Delete all nodes and relationships."""
        if self._use_neo4j:
            with self.driver.session() as session:
                session.run("MATCH (n) DETACH DELETE n")
        else:
            self.graph.clear()

    def bulk_add_edges(self, df: pd.DataFrame):
        """Insert all transactions as edges."""
        if self._use_neo4j:
            with self.driver.session() as session:
                for _, row in df.iterrows():
                    session.run("""
                        MERGE (a:Account {account: $src})
                        MERGE (b:Account {account: $dst})
                        CREATE (a)-[r:TRANSFER {
                            transaction_id: $tid,
                            amount: $amount,
                            timestamp: $ts,
                            device: $device,
                            channel: $channel,
                            location: $location
                        }]->(b)
                    """, src=row["source_account"], dst=row["beneficiary_account"],
                         tid=row["transaction_id"], amount=float(row["amount"]),
                         ts=row["timestamp"].isoformat(), device=row["device_id"],
                         channel=row["channel"], location=row["location"])
        else:
            for _, row in df.iterrows():
                self.graph.add_edge(
                    row["source_account"],
                    row["beneficiary_account"],
                    transaction_id=row["transaction_id"],
                    amount=float(row["amount"]),
                    timestamp=row["timestamp"].isoformat(),
                    device=row["device_id"],
                    channel=row["channel"],
                    location=row["location"]
                )

    def analyze_account(self, account: str, lookback_days: int = 7) -> Dict[str, Any]:
        if self._use_neo4j:
            return self._analyze_neo4j(account, lookback_days)
        else:
            return self._analyze_networkx(account, lookback_days)

    def _analyze_neo4j(self, account: str, lookback_days: int) -> dict:
        with self.driver.session() as session:
            cycles_result = session.run("""
                MATCH p = (a:Account)-[:TRANSFER*2..5]->(a)
                WHERE a.account = $account
                RETURN [node IN nodes(p) | node.account] AS cycle
                LIMIT 5
            """, account=account)
            cycles = [record["cycle"] for record in cycles_result]

            neighbors_result = session.run("""
                MATCH (a:Account {account: $account})-[r:TRANSFER]-(b)
                WHERE r.timestamp > datetime() - duration({days: $days})
                RETURN DISTINCT b.account AS neighbor
            """, account=account, days=lookback_days)
            neighbors = [record["neighbor"] for record in neighbors_result]

            shared_result = session.run("""
                MATCH (a:Account {account: $account})-[r:TRANSFER]-(b)
                WHERE r.timestamp > datetime() - duration({days: $days})
                WITH DISTINCT r.device AS device
                MATCH (other:Account)-[r2:TRANSFER]-(b2)
                WHERE r2.device = device AND other.account <> $account
                RETURN DISTINCT other.account AS shared_account, device
                LIMIT 10
            """, account=account, days=lookback_days)
            shared_devices = [record["shared_account"] for record in shared_result]

            edges_result = session.run("""
                MATCH (a:Account {account: $account})-[r:TRANSFER]-(b)
                WHERE r.timestamp > datetime() - duration({days: $days})
                RETURN a.account AS from, b.account AS to, r.amount AS amount
                LIMIT 30
            """, account=account, days=lookback_days)
            edges = [{"from": record["from"], "to": record["to"], "amount": record["amount"]}
                     for record in edges_result]

            evidence = []
            if cycles:
                evidence.append(f"Circular path detected: {' → '.join(cycles[0] + [cycles[0][0]])}")
            if neighbors:
                evidence.append(f"Account connected to {len(neighbors)} counterparties.")
            if shared_devices:
                evidence.append(f"Device shared with {len(set(shared_devices))} other account(s).")

            return {
                "cycles": cycles,
                "neighbors": neighbors,
                "shared_devices": shared_devices,
                "edges": edges,
                "evidence": evidence if evidence else ["No graph anomalies detected."]
            }

    def _analyze_networkx(self, account: str, lookback_days: int) -> dict:
        df = load_transactions()
        recent = df[df["timestamp"] >= pd.Timestamp.now() - pd.Timedelta(days=lookback_days)]
        G = nx.DiGraph()
        for _, row in recent.iterrows():
            G.add_edge(row["source_account"], row["beneficiary_account"],
                       amount=float(row["amount"]))

        try:
            cycles = [list(c) for c in nx.simple_cycles(G) if account in c][:5]
        except:
            cycles = []

        neighbors = list(set(G.predecessors(account)) | set(G.successors(account)))
        edges = []
        for u, v, data in G.edges(data=True):
            if u == account or v == account:
                edges.append({"from": u, "to": v, "amount": data.get("amount", 0)})
        evidence = []
        if cycles:
            evidence.append(f"Circular path detected: {' → '.join(cycles[0] + [cycles[0][0]])}")
        evidence.append(f"Account connected to {len(neighbors)} counterparties.")
        return {
            "cycles": cycles,
            "neighbors": neighbors,
            "shared_devices": [],
            "edges": edges[:30],
            "evidence": evidence if evidence else ["No graph anomalies detected."]
        }

    def close(self):
        if self.driver:
            self.driver.close()