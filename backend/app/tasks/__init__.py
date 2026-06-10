"""Celery 异步任务"""

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "quanthub",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
)
