import { useQuery } from "@tanstack/react-query";

export default function Reflections() {
  const { data, isLoading } = useQuery({
    queryKey: ["reflections"],
    queryFn: () => fetch("/api/reflections").then((r) => r.json()),
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-800 rounded animate-pulse" />)}</div>;
  }

  if (!data?.reflections?.length) {
    return (
      <div className="bg-slate-800 rounded p-8 text-center">
        <p className="text-slate-400">振り返りなし</p>
        <p className="text-slate-500 text-sm mt-1">エージェントがrunを完了すると、ここに振り返りが表示されます</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">振り返り (Reflections)</h2>

      <div className="space-y-4">
        {data.reflections.map((ref: any) => (
          <div key={ref.reflection_id} className="bg-slate-800 rounded p-4 border-l-2 border-blue-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-xs text-slate-500">{ref.run_id}</span>
              <span className="text-xs text-slate-600">{ref.run_date}</span>
            </div>

            <div className="space-y-3 text-sm">
              {ref.what_worked && (
                <div>
                  <h4 className="text-emerald-400 text-xs font-medium mb-1">うまくいったこと</h4>
                  <p className="text-slate-300">{ref.what_worked}</p>
                </div>
              )}

              {ref.what_failed && (
                <div>
                  <h4 className="text-red-400 text-xs font-medium mb-1">うまくいかなかったこと</h4>
                  <p className="text-slate-300">{ref.what_failed}</p>
                </div>
              )}

              {ref.strategy_improvements && (
                <div>
                  <h4 className="text-amber-400 text-xs font-medium mb-1">改善案</h4>
                  <p className="text-slate-300">{ref.strategy_improvements}</p>
                </div>
              )}

              {ref.open_questions && (
                <div>
                  <h4 className="text-blue-400 text-xs font-medium mb-1">未解決の疑問</h4>
                  <p className="text-slate-300">{ref.open_questions}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
