from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from app.database import get_db
from app.models.vector_db import DocumentChunk
from app.services.embedding_engine import hf_embedding_service
from app.schemas import BaseResponse

router = APIRouter(prefix="/api/documents", tags=["Document Lifecycle Manager"])


async def atomic_ingestion_pipeline(
    file_name: str, text_content: str, db: AsyncSession = Depends(get_db)
):
    async with db.begin():
        try:
            delete_stmt = delete(DocumentChunk).where(
                DocumentChunk.file_name == file_name
            )
            await db.execute(delete_stmt)

            chunk_size = 400
            overlap = 40
            start = 0
            chunks_to_insert = []

            while start < len(text_content):
                end = start + chunk_size
                chunk_text = text_content[start:end]

                vector_bge = await hf_embedding_service.get_embedding_async(chunk_text)

                db_chunk = DocumentChunk(
                    file_name=file_name, content=chunk_text, embedding=vector_bge
                )
                chunks_to_insert.append(db_chunk)

                start += (
                    (chunk_size - overlap) if (end < len(text_content)) else chunk_size
                )

            if chunks_to_insert:
                db.add_all(chunks_to_insert)

        except Exception as e:
            await db.rollback()
            return RuntimeError(f"Atomic ingestion transaction aborted: {str(e)}")


@router.post("/overwrite-upload", response_model=BaseResponse[dict])
async def upload_and_overwrite_document(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    allowed_extensions = [".txt", ".md", ".pdf"]
    if not any(file.filename.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=400, detail="Unsupported document schema layout"
        )

    try:
        byte_stream = await file.read()
        text_content = byte_stream.decode("utf-8", errors="ignore")

        await atomic_ingestion_pipeline(file.filename, text_content, db)

        return BaseResponse(
            code=200,
            message="Atomic document pipeline overwrite accomplished successfully",
            data={"file_name": file.filename, "operation": "OVERWRITE_SUCCESS"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Lifecycle pipeline collision: {str(e)}"
        )
