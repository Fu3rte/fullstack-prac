from pydantic import BaseModel, Field
from typing import List


class QAAgentRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="用户提问")
    top_k: int = Field(default=3, ge=1, le=10)
    similarity_threshold: float = Field(
        default=0.45, description="低于此置信度分数将强制触发幻觉熔断机制"
    )


class CitationSource(BaseModel):
    file_name: str = Field(..., description="源文件名")
    content: str = Field(..., description="切片明细")
    score: float = Field(..., description="召回匹配度")


class QAAgentResponse(BaseModel):
    answer: str = Field(..., description="模型最终输出")
    routing_mode: str = Field(..., description="路由模式: rag or general")
    citations: List[CitationSource] = Field(default=[], description="引用来源")
