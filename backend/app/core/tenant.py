"""多租户中间件：自动注入 tenant_id 过滤"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select


def apply_tenant_filter(query: Select, tenant_id: UUID, model) -> Select:
    """为查询自动注入 tenant_id 过滤条件"""
    if hasattr(model, "tenant_id"):
        query = query.where(model.tenant_id == tenant_id)
    return query
