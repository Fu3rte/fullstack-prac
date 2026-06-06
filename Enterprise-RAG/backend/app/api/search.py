from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.vector_db import DocumentChunk
from app.services.embedding_engine import hf_embedding_service
from app.schemas import BaseResponse
from app.models.rag_schemas import (
    SearchQueryRequest,
    SearchQueryResponse,
    ChunkSearchResult,
)

router = APIRouter(prefix="/api/search", tags=["Enterprise RAG Engine"])


@router.post("", response_model=BaseResponse[SearchQueryResponse])
async def vector_similarity_search(
    payload: SearchQueryRequest, db: AsyncSession = Depends(get_db)
):
    try:
        query_vector = await hf_embedding_service.get_embedding_async(payload.text)

        similarity_expression = (
            1 - DocumentChunk.embedding.cosine_distance(query_vector)
        ).label("similarity")

        stmt = (
            select(DocumentChunk, similarity_expression)
            .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
            .limit(payload.top_k)
        )

        db_execute_result = await db.execute(stmt)
        raw_records = db_execute_result.all()

        formatted_results = []
        for chunk, similarity_score in raw_records:
            formatted_results.append(
                ChunkSearchResult(
                    chunk_id=str(chunk.id),
                    file_name=chunk.file_name,
                    content=chunk.content,
                    similarity=round(float(similarity_score), 4),
                )
            )

        return BaseResponse(
            code=200,
            message="Production vector database engine query executed successfully.",
            data=SearchQueryResponse(query=payload.text, results=formatted_results),
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Vector DB Engine inner failure: {str(e)}"
        )
