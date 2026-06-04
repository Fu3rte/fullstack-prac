import json
import os
from typing import List
import uuid
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from redis.asyncio import Redis
from openai import AsyncOpenAI, APITimeoutError, APIError

from schemas import CreateSessionResponse, Message, ChatRequest, ChatResponse

load_dotenv()

app = FastAPI(title="Ai Chatroom Backend")

redis_client = Redis(host="localhost", port=6379, decode_responses=True)

ai_client = AsyncOpenAI(
    api_key=os.getenv("AI_API_KEY"), base_url=os.getenv("AI_BASE_URL")
)


@app.get("/api/sessions")
async def list_sessions():
    all_sessions = await redis_client.hgetall("chatroom:sessions")

    result = [
        {"session_id": sid, "title": title} for sid, title in all_sessions.items()
    ]

    return {"sessions": result}


@app.post("/api/sessions", response_model=CreateSessionResponse)
async def create_session():
    """
    【C】新建话题/会话
    类似于前端左侧点击“新建话题”按钮，后端生成一个唯一的 id，并存入 Redis 的会话列表中
    """
    session_id = str(uuid.uuid4())  # 生成唯一标识符
    default_title = "新话题"

    await redis_client.hset("chatroom:sessions", session_id, default_title)

    return {"session_id": session_id, "title": default_title}


@app.post("/api/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat_with_ai(session_id: str, request: ChatRequest):
    if not await redis_client.hexists("chatroom:sessions", session_id):
        raise HTTPException(status_code=404, detail="Sessions not found")

    redis_key = f"chatroom:messages:{session_id}"
    user_content = request.content

    current_length = await redis_client.llen(redis_key)
    if current_length == 0:
        short_title = user_content[:10] + (
            "..." if len(user_content) > 10 else ""
        )

        await redis_client.hset("chatroom:sessions", session_id, short_title)

    raw_history = await redis_client.lrange(redis_key, 0, -1)
    formatted_messages = [json.loads(msg) for msg in raw_history]

    current_user_msg = {"role": "user", "content": user_content}
    formatted_messages.append(current_user_msg)

    try:
        response = await ai_client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=formatted_messages,
            temperature=1.0,
            timeout=20,
        )

        ai_reply = response.choices[0].message.content

        await redis_client.rpush(redis_key, json.dumps(current_user_msg))
        await redis_client.rpush(
            redis_key, json.dumps({"role": "assistant", "content": ai_reply})
        )

        return ChatResponse(content=ai_reply)

    except APITimeoutError:
        return ChatResponse(content="Timeout error")

    except APIError:
        return ChatResponse(content="API Error")

    except Exception as e:
        return ChatResponse(content=f"System Error: {e}")


@app.get("/api/sessions/{session_id}/messages", response_model=List[Message])
async def get_sessions_messages(session_id: str):
    redis_key = f"chatroom:messages:{session_id}"

    raw_messages = await redis_client.lrange(redis_key, 0, -1)

    messages = [Message(**json.loads(msg)) for msg in raw_messages]
    return messages


@app.post("/api/sessions/{session_id}/clear")
async def clear_session_context(session_id: str):
    redis_key = f"chatroom:messages:{session_id}"

    await redis_client.delete(redis_key)
    return {"status": "success", "message": "Clear context success"}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    await redis_client.hdel("chatroom:sessions", session_id)
    await redis_client.delete(f"chatroom:messages:{session_id}")
    return {"status": "success", "message": "Delete sessions success"}
