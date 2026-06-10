"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api";

interface Position {
  id: string;
  symbol: string;
  direction: string;
  volume: number;
  avg_price: number;
  unrealized_pnl: number | null;
}

interface Order {
  id: string;
  symbol: string;
  direction: string;
  volume: number;
  status: string;
}

export function useTrading() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Position[]>("/api/v1/trade/positions");
      setPositions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await apiGet<Order[]>("/api/v1/trade/orders");
      setOrders(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    fetchOrders();
  }, [fetchPositions, fetchOrders]);

  return { positions, orders, loading, refresh: () => { fetchPositions(); fetchOrders(); } };
}
