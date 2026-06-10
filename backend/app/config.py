"""应用配置管理"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置，从环境变量 / .env 文件加载"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # 应用
    APP_NAME: str = "QuantHub"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8000"]

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://quanthub:quanthub@localhost:5432/quanthub"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "quanthub"
    MINIO_SECURE: bool = False

    # wmr 权重管理
    WMR_BACKEND: Literal["duckdb", "clickhouse"] = "duckdb"
    WMR_DUCKDB_PATH: str = "./data/weights.duckdb"
    WMR_CLICKHOUSE_URL: str = "clickhouse://localhost:9000/quanthub_weights"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # QMT 实盘
    QMT_PATH: str = ""
    QMT_ACCOUNT: str = ""
    QMT_PASSWORD: str = ""

    # LLM (自然语言策略生成)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o"

    # Hybrid LLM (Ollama + Moark + DashScope)
    OLLAMA_HOST: str = "http://127.0.0.1:11434"
    OLLAMA_PRIMARY_MODEL: str = "gemma4:cloud"
    OLLAMA_CLOUD_MODEL: str = "gemma4:cloud"
    OLLAMA_CONNECT_TIMEOUT_SECONDS: float = 5.0
    OLLAMA_LOCAL_TIMEOUT_SECONDS: float = 160.0
    OLLAMA_CLOUD_TIMEOUT_SECONDS: float = 180.0

    MOARK_API_KEY: str = ""
    MOARK_API_URL: str = "https://api.moark.com/v1/chat/completions"
    MOARK_MODEL: str = "gpt-4o-mini"
    MOARK_ENABLED: bool = False

    DASHSCOPE_API_KEY: str = "sk-686a9c8937d248c893d9fc1d7b5a73a0"
    DASHSCOPE_API_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DASHSCOPE_MODEL: str = "qwen-plus"
    DASHSCOPE_ENABLED: bool = True

    # 数据源
    JQ_USER: str = ""
    JQ_PASS: str = ""
    TUSHARE_TOKEN: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
