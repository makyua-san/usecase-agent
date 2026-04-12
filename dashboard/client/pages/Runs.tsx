import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export default function Runs() {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetch("/api/runs?limit=50").then((r) => r.json()),
  });

  const { data: runDetail } = useQuery({
    queryKey: ["run-detail", selectedRun],
    queryFn: () => fetch(`/api/runs/${selectedRun}`).then((r) => r.json()),
    enabled: !!selectedRun,
  });

  const { data: logData } = useQuery({
    queryKey: ["log", selectedRun],
    queryFn: () => fetch(`/api/logs/${selectedRun}`).then((r) => r.json()),
    enabled: !!selectedRun,
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}</div>;
  }

  if (!data?.runs?.length) {
    return (
      <div className="bg-slate-800 rounded p-8 text-center">
        <p className="text-slate-400">まだrunがありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">実行履歴</h2>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-700">
            <th className="pb-2 pr-4">Run ID</th>
            <th className="pb-2 pr-4">開始</th>
            <th className="pb-2 pr-4">状態</th>
            <th className="pb-2">収集���</th>
          </tr>
        </thead>
        <tbody>
          {data.runs.map((run: any) => (
            <tr
              key={run.run_id}
              onClick={() => setSelectedRun(selectedRun === run.run_id ? null : run.run_id)}
              className={`border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 ${
                selectedRun === run.run_id ? "bg-slate-800" : ""
              }`}
            >
              <td className="py-2 pr-4 font-mono text-xs">{run.run_id}</td>
              <td className="py-2 pr-4">{run.started_at}</td>
              <td className="py-2 pr-4">
                <StatusBadge status={run.status} />
              </td>
              <td className="py-2">{run.case_count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedRun && runDetail && (
        <div className="bg-slate-800 rounded p-4 space-y-4">
          <h3 className="text-sm font-medium text-slate-400">
            Run詳細: <span className="font-mono">{selectedRun}</span>
          </h3>

          {runDetail.cases?.length > 0 && (
            <div>
              <h4 className="text-xs text-slate-500 mb-2">収集したケース</h4>
              {runDetail.cases.map((c: any) => (
                <div key={c.case_id} className="flex items-center gap-2 py-1 text-sm">
                  <LevelBadge level={c.level} />
                  <span>{c.title}</span>
                </div>
              ))}
            </div>
          )}

          {logData?.exists && (
            <div>
              <h4 className="text-xs text-slate-500 mb-2">ログ</h4>
              <LogViewer content={logData.content} />
            </div>
          )}
          {logData && !logData.exists && (
            <p className="text-slate-500 text-sm">ログファイルなし</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "text-emerald-400",
    error: "text-red-400",
    timeout: "text-amber-400",
    running: "text-blue-400",
  };
  return <span className={`text-xs font-medium ${colors[status] || "text-slate-400"}`}>{status}</span>;
}

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    A: "bg-emerald-500/20 text-emerald-400",
    B: "bg-amber-500/20 text-amber-400",
    C: "bg-slate-500/20 text-slate-400",
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${colors[level] || "bg-slate-700 text-slate-400"}`}>
      {level}
    </span>
  );
}

const LOG_TYPE_COLORS: Record<string, string> = {
  STARTED: "text-blue-400",
  SOURCE: "text-blue-300",
  FETCHED: "text-cyan-400",
  CLASSIFIED: "text-emerald-400",
  SKIPPED: "text-slate-500",
  DISCOVERED: "text-purple-400",
  REFLECTION: "text-amber-400",
  PLAN: "text-amber-300",
  COMPLETED: "text-emerald-500",
  ERROR: "text-red-400",
  WARNING: "text-amber-500",
};

function LogViewer({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <pre className="bg-slate-900 rounded p-3 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
      {lines.map((line, i) => {
        const match = line.match(/\[[\d\-T:]+\]\s*\[(\w+)\]/);
        const color = match ? LOG_TYPE_COLORS[match[1]] || "text-slate-300" : "text-slate-400";
        return (
          <div key={i} className={color}>
            {line}
          </div>
        );
      })}
    </pre>
  );
}
