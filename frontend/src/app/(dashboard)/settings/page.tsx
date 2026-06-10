export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">设置</h2>

      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
        <h3 className="font-semibold">租户信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500">团队名称</label>
            <input className="w-full p-2 border rounded mt-1 text-sm" defaultValue="我的团队" />
          </div>
          <div>
            <label className="text-xs text-gray-500">订阅计划</label>
            <input className="w-full p-2 border rounded mt-1 text-sm bg-gray-50" defaultValue="Free" disabled />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
        <h3 className="font-semibold">成员管理</h3>
        <p className="text-sm text-gray-400">暂无成员数据</p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
        <h3 className="font-semibold">数据源配置</h3>
        <p className="text-sm text-gray-400">聚宽 / Tushare / 天勤 / CCXT 配置</p>
      </div>
    </div>
  );
}
