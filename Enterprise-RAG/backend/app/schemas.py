from pydantic import BaseModel, Field
from typing import Optional, Generic, TypeVar

T = TypeVar("T")


class BaseResponse(BaseModel, Generic[T]):
    code: int = Field(200, description="statu code")
    message: str = Field("success", description="info")
    data: Optional[T] = None


class UploadTaskResponse(BaseModel):
    task_id: str = Field(..., description="task ID")
    file_name: str = Field(..., description="File name")
    status: str = Field(
        "processing", description="Task statu: processing, completed, failed"
    )
