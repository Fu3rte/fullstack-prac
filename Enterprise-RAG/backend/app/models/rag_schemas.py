from pydantic import BaseModel, Field
from typing import List


class SearchQueryRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000, description="用户提问的文本")
    top_k: int = Field(default=3, ge=1, le=20, description="召回的切片数量边界")


class ChunkSearchResult(BaseModel):
    chunk_id: str = Field(..., description="切片唯一标识")
    file_name: str = Field(..., description="源文件名")
    content: str = Field(..., description="原始文本切片内容")
    similarity: float = Field(..., description="余弦相似度置信度分数")


class SearchQueryResponse(BaseModel):
    query: str = Field(..., description="原始提问")
    results: List[ChunkSearchResult] = Field(..., description="召回的Top-K相似切片列表")
