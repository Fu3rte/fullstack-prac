from pydantic import BaseModel, Field
from datetime import datetime


class TaskBase(BaseModel):
    title: str = Field(..., max_length=100, description="任务标题")
    description: str | None = Field(None, description="任务描述内容")


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(None, max_length=100)
    description: str | None = None
    status: str | None = Field(None, pattern="^(Todo|In Progress|Done)")


class TaskResponse(TaskBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
