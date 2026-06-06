import uuid
from typing import List, Dict

from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import BaseResponse, UploadTaskResponse
from app.api.search import router as search_router
from app.api.qa_engine import router as qa_router
from app.api.documents import router as documents_router
from app.database import AsyncSessionLocal
from app.models.vector_db import DocumentChunk
from app.services.embedding_engine import hf_embedding_service

app = FastAPI(title="Enterprise RAG Core Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(qa_router)
app.include_router(documents_router)

TASK_CLUSTER_DB: Dict[str, dict] = {}


async def cpu_bound_chunking_pipeline(
    task_id: str, file_name: str, file_content: bytes
):
    """后台任务：切块 → embedding → 存入数据库"""
    try:
        text = file_content.decode("utf-8", errors="ignore")

        chunk_size = 500
        overlap = 50
        chunks: List[str] = []

        # 第一步：切块
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += (chunk_size - overlap) if (end < len(text)) else chunk_size

        TASK_CLUSTER_DB[task_id] = {
            "status": "processing",
            "file_name": file_name,
            "total_chunks": len(chunks),
            "message": f"已切分为 {len(chunks)} 个切片，正在生成向量...",
        }

        # 第二步：批量生成 embedding 并存入数据库
        async with AsyncSessionLocal() as db:
            vectors = await hf_embedding_service.get_embeddings_async(chunks)
            for chunk_text, vector in zip(chunks, vectors):
                db_chunk = DocumentChunk(
                    file_name=file_name, content=chunk_text, embedding=vector
                )
                db.add(db_chunk)
            await db.commit()

        TASK_CLUSTER_DB[task_id] = {
            "status": "completed",
            "file_name": file_name,
            "total_chunks": len(chunks),
            "message": f"Successfully fragmented into {len(chunks)} elements.",
        }
    except Exception as e:
        TASK_CLUSTER_DB[task_id] = {
            "status": "failed",
            "file_name": file_name,
            "message": f"Pipeline broken: {str(e)}",
        }


@app.post("/api/documents/upload", response_model=BaseResponse[UploadTaskResponse])
async def upload_document_stream(
    bg_tasks: BackgroundTasks, file: UploadFile = File(...)
):
    allowed_extensions = [".txt", ".md", ".pdf"]
    if not any(file.filename.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(status_code=400, detail="Invalid file format framework")

    file_content = await file.read()
    task_id = str(uuid.uuid4())

    TASK_CLUSTER_DB[task_id] = {
        "status": "processing",
        "file_name": file.filename,
        "message": "Ingestion task registered.",
    }

    bg_tasks.add_task(cpu_bound_chunking_pipeline, task_id, file.filename, file_content)

    return BaseResponse(
        code=202,
        message="Asynchronous chunking task scheduled",
        data=UploadTaskResponse(
            task_id=task_id, file_name=file.filename, status="processing"
        ),
    )


@app.get("/api/documents/tasks/{task_id}", response_model=BaseResponse[dict])
async def check_task_status(task_id: str):
    task = TASK_CLUSTER_DB.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return BaseResponse(code=200, message="Fetch success", data=task)
