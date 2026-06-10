"""QMT 实盘网关"""

from __future__ import annotations

from typing import Protocol


class QMTGatewayProtocol(Protocol):
    """QMT 网关接口定义"""

    async def connect(self) -> None: ...
    async def disconnect(self) -> None: ...
    async def get_account_info(self) -> dict: ...
    async def get_positions(self) -> list[dict]: ...
    async def place_order(self, symbol: str, direction: str, price: float, volume: int) -> str: ...
    async def cancel_order(self, order_id: str) -> bool: ...
    async def get_orders(self) -> list[dict]: ...


class QMTGateway:
    """QMT 实盘网关实现（需要 QMT SDK: xtdata + xttrader）

    注意：QMT SDK 需要在 Windows 环境下运行，且需要安装迅投客户端。
    此骨架仅提供接口定义，具体实现需要根据 QMT SDK 文档编写。
    """

    def __init__(self, qmt_path: str, account: str, password: str):
        self.qmt_path = qmt_path
        self.account = account
        self.password = password
        self._connected = False

    async def connect(self) -> None:
        """连接 QMT"""
        # TODO: xttrader.connect()
        raise NotImplementedError("QMT SDK required")

    async def disconnect(self) -> None:
        """断开连接"""
        raise NotImplementedError("QMT SDK required")

    async def get_account_info(self) -> dict:
        """获取账户信息"""
        raise NotImplementedError("QMT SDK required")

    async def get_positions(self) -> list[dict]:
        """获取持仓"""
        raise NotImplementedError("QMT SDK required")

    async def place_order(self, symbol: str, direction: str, price: float, volume: int) -> str:
        """下单，返回委托号"""
        raise NotImplementedError("QMT SDK required")

    async def cancel_order(self, order_id: str) -> bool:
        """撤单"""
        raise NotImplementedError("QMT SDK required")

    async def get_orders(self) -> list[dict]:
        """获取委托"""
        raise NotImplementedError("QMT SDK required")
