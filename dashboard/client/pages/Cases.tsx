import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export default function Cases() {
  const [level, setLevel] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cases", level],
    queryFn: () => {
      const params = new URLSearchParams();
      if (level) params.set("level", level);
      params.set("limit", "50");
      return fetch(`/api/cases?${params}`).then((r) => r.json());
    },
  });

  const copyMarkdown = (c: any) => {
    const md = `## ${c.title}\n\n- **誰が:** ${c.who || "—"}\n- **何を:** ${c.what || "—"}\n- **どうやって:** ${c.how || "—"}\n\n${c.summary || ""}\n\nTags: ${(c.tags || []).join(", ")}\nSource: ${c.url}`;
    navigator.clipboard.writeText(md);
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">事例</h2>
        <div className="flex gap-2">
          {["", "A", "B", "C"].map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1 text-xs rounded ${
                level === l ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {l || "全て"}
            </button>
          ))}
        </div>
      </div>

      {data?.total > 0 && (
        <p className="text-xs text-slate-500">{data.total}件</p>
      )}

      {!data?.cases?.length ? (
        <div className="bg-slate-800 rounded p-8 text-center">
          <p className="text-slate-400">
            {level ? `Level ${level}に一致するケースがありません。フィルタを変更してください` : "まだケースが収集されていません"}
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-700">
              <th className="pb-2 w-8">Lv</th>
              <th className="pb-2 pr-4">タイトル</th>
              <th className="pb-2 pr-4">ソース</th>
              <th className="pb-2 pr-4">タグ</th>
              <th className="pb-2">日付</th>
            </tr>
          </thead>
          <tbody>
            {data.cases.map((c: any) => (
              <>
                <tr
                  key={c.case_id}
                  onClick={() => setExpandedId(expandedId === c.case_id ? null : c.case_id)}
                  className="border-b border-slate-800 cursor-pointer hover:bg-slate-800/50"
                >
                  <td className="py-2">
                    <LevelBadge level={c.level} />
                  </td>
                  <td className="py-2 pr-4">{c.title}</td>
                  <td className="py-2 pr-4 text-slate-400">{c.source_name}</td>
                  <td className="py-2 pr-4">
                    {(c.tags || []).map((t: string) => (
                      <span key={t} className="inline-block bg-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded mr-1">
                        {t}
                      </span>
                    ))}
                  </td>
                  <td className="py-2 text-slate-500 text-xs">{c.created_at?.slice(0, 10)}</td>
                </tr>
                {expandedId === c.case_id && (
                  <tr key={`${c.case_id}-detail`} className="bg-slate-800/30">
                    <td colSpan={5} className="p-4">
                      <div className="space-y-2 text-sm">
                        {c.who && <p><span className="text-slate-500">誰が:</span> {c.who}</p>}
                        {c.what && <p><span className="text-slate-500">何を:</span> {c.what}</p>}
                        {c.how && <p><span className="text-slate-500">どうやって:</span> {c.how}</p>}
                        {c.summary && <p className="text-slate-300 mt-2">{c.summary}</p>}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyMarkdown(c); }}
                            className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded hover:bg-blue-500/30"
                          >
                            Markdownコピー
                          </button>
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600"
                          >
                            ��記事を開く
                          </a>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    A: "bg-emerald-500/20 text-emerald-400",
    B: "bg-amber-500/20 text-amber-400",
    C: "bg-slate-500/20 text-slate-400",
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${colors[level] || ""}`}>
      {level}
    </span>
  );
}
