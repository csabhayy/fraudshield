"""Qdrant vector DB with in‑memory fallback."""
from typing import List, Dict, Any
import uuid
import os
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False

from sentence_transformers import SentenceTransformer

class VectorService:
    def __init__(self, host=None, port=None, collection="fraud_cases"):
        self.host = host or os.getenv("QDRANT_HOST", "localhost")
        self.port = int(port or os.getenv("QDRANT_PORT", 6333))
        self.collection = collection
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
        self._in_memory = []
        self.client = None
        if QDRANT_AVAILABLE:
            try:
                self.client = QdrantClient(host=self.host, port=self.port)
                collections = self.client.get_collections().collections
                if collection not in [c.name for c in collections]:
                    self.client.create_collection(
                        collection_name=collection,
                        vectors_config=VectorParams(size=384, distance=Distance.COSINE)
                    )
            except Exception:
                self.client = None
                print("Qdrant unavailable – using in‑memory store.")
        else:
            print("Qdrant client not installed – using in‑memory store.")

    def _vectorize(self, text: str) -> List[float]:
        return self.encoder.encode(text).tolist()

    def index_case(self, case: dict):
        text = f"Transaction {case['transaction_id']} amount {case['amount']} risk {case['risk_score']} reasons {case['reasons']}"
        vector = self._vectorize(text)
        if self.client:
            point = PointStruct(id=str(uuid.uuid4()), vector=vector, payload=case)
            self.client.upsert(collection_name=self.collection, points=[point])
        else:
            self._in_memory.append({"id": str(uuid.uuid4()), "vector": vector, "payload": case})

    def search_similar(self, query: dict, limit=5) -> List[Dict]:
        text = f"Transaction {query.get('transaction_id')} amount {query.get('amount')} reasons {query.get('reasons')}"
        vector = self._vectorize(text)
        
        if self.client:
            try:
                # Try the standard 'search' method
                if hasattr(self.client, 'search'):
                    hits = self.client.search(collection_name=self.collection, query_vector=vector, limit=limit)
                    return [hit.payload for hit in hits]
                # If not, try 'query' (newer versions)
                elif hasattr(self.client, 'query'):
                    hits = self.client.query(collection_name=self.collection, query_vector=vector, limit=limit)
                    return [hit.payload for hit in hits]
                else:
                    print("Qdrant client has no search/query method, falling back to in-memory.")
                    self.client = None  # fallback to in-memory
            except Exception as e:
                print(f"Qdrant search failed: {e}, falling back to in-memory.")
                self.client = None  # fallback

        # In-memory fallback (brute force cosine similarity)
        if not self._in_memory:
            return []
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity
        vectors = np.array([item["vector"] for item in self._in_memory])
        q = np.array(vector).reshape(1, -1)
        sim = cosine_similarity(q, vectors)[0]
        indices = np.argsort(sim)[-limit:][::-1]
        return [self._in_memory[i]["payload"] for i in indices if sim[i] > 0.3]