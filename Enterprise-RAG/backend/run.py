"""启动脚本：预下载模型 + 启动 uvicorn"""
import os

os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)
