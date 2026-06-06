import asyncio
import os
from sentence_transformers import SentenceTransformer
from app.config import EMBEDDING_MODEL_NAME

# HuggingFace 国内镜像
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

# 启动时加载模型到内存（第一次会下载，后续从缓存加载）
_model = SentenceTransformer(EMBEDDING_MODEL_NAME)


class EmbeddingService:
    def _sync_encode(self, text: str) -> list:
        return _model.encode(text).tolist()

    def _sync_encode_batch(self, texts: list[str]) -> list:
        return _model.encode(texts).tolist()

    async def get_embedding_async(self, text: str) -> list:
        return await asyncio.to_thread(self._sync_encode, text)

    async def get_embeddings_async(self, texts: list[str]) -> list:
        return await asyncio.to_thread(self._sync_encode_batch, texts)


hf_embedding_service = EmbeddingService()
