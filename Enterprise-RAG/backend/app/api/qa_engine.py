from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.vector_db import DocumentChunk
from app.services.embedding_engine import hf_embedding_service
from app.services.llm_engine import llm_client
from app.schemas import BaseResponse
from app.models.qa_schemas import QAAgentRequest, QAAgentResponse, CitationSource

router = APIRouter(prefix="/api/qa", tags=["RAG AI Core Engine"])


@router.post("/query", response_model=BaseResponse[QAAgentResponse])
async def execute_rag_qa_pipeline(
    payload: QAAgentRequest, db: AsyncSession = Depends(get_db)
):
    try:
        query_vector = await hf_embedding_service.get_embedding_async(payload.question)

        similarity_expr = (
            1 - DocumentChunk.embedding.cosine_distance(query_vector)
        ).label("similarity")

        stmt = (
            select(DocumentChunk, similarity_expr)
            .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
            .limit(payload.top_k)
        )

        db_res = await db.execute(stmt)
        records = db_res.all()

        is_kb_empty = len(records) == 0
        has_high_quality_chunk = (
            any(float(score) >= payload.similarity_threshold for _, score in records)
            if not is_kb_empty
            else False
        )

        citations_list = []
        context_text_blocks = []

        if not is_kb_empty and has_high_quality_chunk:
            for chunk, score in records:
                score_val = float(score)
                if score_val >= payload.similarity_threshold:
                    context_text_blocks.append(
                        f"【源文件: {chunk.file_name}】\n内容: {chunk.content}"
                    )
                    citations_list.append(
                        CitationSource(
                            file_name=chunk.file_name,
                            content=chunk.content,
                            score=round(score_val, 4),
                        )
                    )

            routing_mode = "rag"
        else:
            routing_mode = "general"

        if routing_mode == "rag":
            merged_context = "\n\n".join(context_text_blocks)
            system_prompt = (
                "你是一位严谨的企业级级本地知识库问答专家。\n"
                "请严格基于下方给出的 [企业参考上下文] 进行事实回答。\n\n"
                f"[企业参考上下文]:\n{merged_context}\n\n"
                "[严格约束指标]:\n"
                "1. 只能根据上下文明确提及的客观事实回答，禁止进行任何主观推导、逻辑脑补或外部常识扩充。\n"
                "2. 如果上下文中的内容不足以回答或与问题无关，你必须**一个字不差地**直接诚实回答：“知识库中未找到相关内容”，严禁胡思乱想或胡乱拼凑。"
            )
            user_prompt = f"请基于知识库上下文回答此问题：{payload.question}"
        else:
            system_prompt = "你是一个通用的 AI 智能助手。当前本地知识库未挂载或未能检索到匹配的高置信度资料，请基于你的通用常识库回答用户的问题，并在开头说明当前处于通用模式。"
            user_prompt = payload.question

        llm_response = await llm_client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=1024,
            timeout=10,
        )

        ai_answer = llm_response.choices[0].message.content or "No answer"

        return BaseResponse(
            code=200,
            message="Dynamic RAG execution pipeline sequence fully finalized.",
            data=QAAgentResponse(
                answer=ai_answer, routing_mode=routing_mode, citations=citations_list
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"RAG QA Router broken down: {str(e)}"
        )
