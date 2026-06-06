import os
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

llm_client = AsyncOpenAI(api_key=os.getenv("API_KEY"), base_url=os.getenv("AI_URL"))
