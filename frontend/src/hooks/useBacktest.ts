"use client";

import { useState, useCallback } from "react";
import { apiPost, apiGet } from "@/lib/api";

interface BacktestParams {
  symbol: string;
  freq: string;
  sdt: string;
  edt: string;
  fee_rate: number;
}

interface BacktestResult {
  job_id: string;
  status: string;
  stats: Record<string, number>;
}

export function useBacktest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (strategyId: string, params: BacktestParams) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<BacktestResult>(
        `/api/v1/strategies/${strategyId}/backtest`,
        params
      );
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const poll = useCallback(async (jobId: string) => {
    try {
      const res = await apiGet<BacktestResult>(`/api/v1/backtests/${jobId}`);
      setResult(res);
      return res.status;
    } catch {
      return "error";
    }
  }, []);

  return { loading, result, error, submit, poll };
}
