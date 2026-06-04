from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str = Field(..., description="role: user or assistant")
    content: str = Field(..., description="message text content")


class CreateSessionResponse(BaseModel):
    session_id: str
    title: str


class ChatRequest(BaseModel):
    content: str = Field(..., description="用户输入的聊天文本")


class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str = Field(..., description="LLM 返回的文本")
