import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const LEVEL_COLORS: Record<string, string> = { A: "#10b981", B: "#f59e0b", C: "#64748b" };

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/dashboard/stats").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded p-4 text-red-400">
        サーバーに接続できません。dashboard serverが起動しているか確認してください。
      </div>
    );
  }

  if (!data || data.total_runs === 0) {
    return (
      <div className="bg-slate-800 rounded p-8 text-center">
        <p className="text-slate-400 text-lg mb-2">まだrunが実行されていません</p>
        <p className="text-slate-500 font-mono text-sm">bun run harness.ts で最初のrunを開始してください</p>
      </div>
    );
  }

  const pieData = Object.entries(data.level_distribution || {}).map(([level, count]) => ({
    name: `Level ${level}`,
    value: count as number,
    color: LEVEL_COLORS[level] || "#64748b",
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">ダッシュボード</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="総ケース数" value={data.total_cases} />
        <StatCard label="実行回数" value={data.total_runs} />
        <StatCard label="アクティブソース" value={data.active_sources} />
        <StatCard
          label="最新run"
          value={data.latest_run?.status || "—"}
          color={data.latest_run?.status === "success" ? "text-emerald-400" : "text-amber-400"}
        />
      </div>

      {/* Level distribution + Latest run */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">分類分布</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-sm">データなし</p>
          )}
        </div>

        <div className="bg-slate-800 rounded p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">最新run</h3>
          {data.latest_run ? (
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">ID:</span> <span className="font-mono">{data.latest_run.run_id}</span></p>
              <p><span className="text-slate-500">開始:</span> {data.latest_run.started_at}</p>
              <p><span className="text-slate-500">状態:</span> {data.latest_run.status}</p>
              <p><span className="text-slate-500">収集:</span> {data.latest_run.case_count}件</p>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">—</p>
          )}
        </div>
      </div>

      {/* Trust score top/bottom */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Trust Score Top</h3>
          {(data.top_sources || []).map((s: any) => (
            <div key={s.source_id} className="flex justify-between py-1 text-sm">
              <span>{s.name}</span>
              <span className="font-mono text-emerald-400">{s.trust_score.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-800 rounded p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Trust Score Bottom</h3>
          {(data.bottom_sources || []).map((s: any) => (
            <div key={s.source_id} className="flex justify-between py-1 text-sm">
              <span>{s.name}</span>
              <span className="font-mono text-red-400">{s.trust_score.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest reflection */}
      {data.latest_reflection && (
        <div className="bg-slate-800 rounded p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">最新の振り返り</h3>
          <div className="text-sm space-y-2">
            {data.latest_reflection.what_worked && (
              <p><span className="text-emerald-400">成功:</span> {data.latest_reflection.what_worked}</p>
            )}
            {data.latest_reflection.what_failed && (
              <p><span className="text-red-400">失敗:</span> {data.latest_reflection.what_failed}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-slate-800 rounded p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color || "text-slate-100"}`}>{value}</p>
    </div>
  );
}
