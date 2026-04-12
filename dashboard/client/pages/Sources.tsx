import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";

export default function Sources() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: () => fetch("/api/sources").then((r) => r.json()),
  });

  const { data: historyData } = useQuery({
    queryKey: ["source-history", selectedSource],
    queryFn: () => fetch(`/api/sources/${selectedSource}/history`).then((r) => r.json()),
    enabled: !!selectedSource,
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">ソース</h2>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-700">
            <th className="pb-2 pr-4">名前</th>
            <th className="pb-2 pr-4">カテゴリ</th>
            <th className="pb-2 pr-4">Trust Score</th>
            <th className="pb-2 pr-4">深度</th>
            <th className="pb-2">状態</th>
          </tr>
        </thead>
        <tbody>
          {(data?.sources || []).map((s: any) => (
            <tr
              key={s.source_id}
              onClick={() => setSelectedSource(selectedSource === s.source_id ? null : s.source_id)}
              className="border-b border-slate-800 cursor-pointer hover:bg-slate-800/50"
            >
              <td className="py-2 pr-4">{s.name}</td>
              <td className="py-2 pr-4 text-slate-400">{s.category}</td>
              <td className="py-2 pr-4">
                <span className="font-mono">{s.trust_score.toFixed(2)}</span>
                <TrustBar score={s.trust_score} />
              </td>
              <td className="py-2 pr-4">{s.depth}</td>
              <td className="py-2">
                {s.quarantined_until ? (
                  <span className="text-red-400 text-xs">隔離中</span>
                ) : (
                  <span className="text-emerald-400 text-xs">アクティブ</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedSource && historyData && (
        <div className="bg-slate-800 rounded p-4 space-y-4">
          <h3 className="text-sm font-medium text-slate-400">
            {historyData.source?.name} — Trust Score推移
          </h3>

          {historyData.history?.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs text-slate-500 mb-2">Trust Score推移</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[...historyData.history].reverse()}>
                    <XAxis dataKey="run_date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v: string) => v?.slice(5, 10)} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="quality_avg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-xs text-slate-500 mb-2">収集効率 (hit / noise)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[...historyData.history].reverse()}>
                    <XAxis dataKey="run_date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v: string) => v?.slice(5, 10)} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip />
                    <Bar dataKey="hit_count" fill="#10b981" stackId="a" />
                    <Bar dataKey="noise_count" fill="#ef4444" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
              現在のスコア: {historyData.source?.trust_score.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrustBar({ score }: { score: number }) {
  const color = score >= 0.7 ? "bg-emerald-500" : score >= 0.4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-16 h-1.5 bg-slate-700 rounded-full ml-2 inline-block align-middle">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${score * 100}%` }} />
    </div>
  );
}
