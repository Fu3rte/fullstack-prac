# 使用轻量级 Python 基础镜像
FROM python:3.13-slim

# 从官方 uv 镜像中将 uv 工具直接复制到当前容器中（2026 最新佳实践）
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# 1. 仅复制依赖描述文件，充分利用 Docker 层缓存
COPY pyproject.toml uv.lock ./

# 2. 安装项目依赖（--frozen 确保严格锁定版本，--no-cache 缩减镜像体积）
RUN uv sync --frozen --no-cache

# 3. 复制后端全部源码
COPY . .

# 暴露 FastAPI 运行端口
EXPOSE 8000

# 生产环境运行指令，关闭热更新以提升性能
CMD ["uv", "run", "python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]