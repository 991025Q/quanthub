"use client";

import { useParams } from "next/navigation";

export default function AccountDetailPage() {
  const params = useParams();
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">交易账号详情</h2>
      <p className="text-gray-500">Account: {params.accountId}</p>
      {/* TODO: Account detail, PnL chart, order management */}
    </div>
  );
}
