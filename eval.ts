/**
 * eval.ts - Quality classification eval script
 *
 * Tests agent-prompt.md's classification accuracy against known articles.
 * Run: bun run eval.ts
 *
 * This spawns CC headless with a classification-only prompt and compares
 * results against expected labels.
 */

interface EvalCase {
  title: string;
  text: string;
  expected_level: "A" | "B" | "C";
  expected_tags: string[];
}

const EVAL_CASES: EvalCase[] = [
  // Level A examples (3)
  {
    title: "メルカリでのLLM活用：カスタマーサポート自動化の実装と運用3ヶ月の振り返り",
    text: "メルカリでは2024年からLLMを活用したカスタマーサポート自動化に取り組んでいます。RAG構成でFAQデータベースと連携し、問い合わせの40%を自動応答化しました。課題はハルシネーション対策で、回答の確信度スコアリングと人間レビューのハイブリッド運用を導入。3ヶ月の運用で応答時間が平均8分から2分に短縮されました。",
    expected_level: "A",
    expected_tags: ["EC", "LLM", "RAG", "カスタマーサポート"],
  },
  {
    title: "Show HN: We built an AI code reviewer that reduced production bugs by 40%",
    text: "Our team built an AI-powered code review tool using Claude API + AST parsing. Architecture: PRs trigger a GitHub webhook -> our service extracts the diff -> AST analysis identifies risky patterns -> Claude reviews with context from our codebase embedding. After 3 months in production across 50 engineers, we measured a 40% reduction in production incidents. Key insight: providing codebase-specific context via RAG dramatically improved review quality vs generic prompts.",
    expected_level: "A",
    expected_tags: ["SaaS", "LLM", "コード生成", "コードレビュー"],
  },
  {
    title: "製造業のAI外観検査導入：3つの失敗と改善策",
    text: "中小製造業でAI外観検査システムを導入した経験を共有します。使用したのはAzure Custom Visionとエッジデバイス。失敗1: 学習データが少なすぎた（500枚→5000枚に増量で精度80%→95%）。失敗2: 照明条件の変化に弱い（照明制御ボックスを追加）。失敗3: 現場のオペレーターが信頼しない（判定理由の可視化で解決）。ROIは6ヶ月で回収。",
    expected_level: "A",
    expected_tags: ["製造業", "vision", "外観検査"],
  },
  // Level B examples (3)
  {
    title: "○○銀行、生成AIを全社導入。行員1万人が利用開始",
    text: "○○銀行は本日、全行員1万人を対象に生成AIアシスタントの利用を開始したと発表しました。Microsoft Azure OpenAI Serviceを基盤に、社内文書の検索・要約、顧客対応メモの作成支援などに活用します。セキュリティ面では、顧客データは生成AIに送信しない仕組みを構築。今後はローン審査プロセスへの活用も検討中とのことです。",
    expected_level: "B",
    expected_tags: ["金融", "LLM", "文書要約"],
  },
  {
    title: "AWS announces new generative AI features for Amazon Connect",
    text: "AWS today announced new generative AI capabilities for Amazon Connect, its cloud contact center service. The new features include AI-powered agent assist that provides real-time suggestions during customer calls, automated post-call summarization, and intelligent routing based on customer intent detection. The features are built on Amazon Bedrock and are available in preview.",
    expected_level: "B",
    expected_tags: ["SaaS", "LLM", "カスタマーサポート"],
  },
  {
    title: "△△物流、配送ルート最適化にAIを導入",
    text: "△△物流株式会社は、AIを活用した配送ルート最適化システムの本格運用を開始しました。Google Cloud Vertex AIを活用し、天候・交通情報・荷量をリアルタイムで分析。導入により配送効率が15%向上、CO2排出量が10%削減される見込みです。",
    expected_level: "B",
    expected_tags: ["物流", "データ分析"],
  },
  // Level C examples (4)
  {
    title: "生成AI市場、2026年に500億ドル規模へ",
    text: "調査会社○○の最新レポートによると、世界の生成AI市場規模は2026年に500億ドルに達する見通し。前年比35%の成長率を維持している。",
    expected_level: "C",
    expected_tags: [],
  },
  {
    title: "第5回AIイベント開催のお知らせ",
    text: "来月15日、東京ビッグサイトにて「第5回AIイベント」を開催します。最新のAI技術動向や導入事例の紹介、ハンズオンセッションなど盛りだくさんの内容です。参加費無料。",
    expected_level: "C",
    expected_tags: [],
  },
  {
    title: "○○社、AI戦略を発表",
    text: "○○社の社長は本日の決算会見で「2025年度はAIファーストの経営戦略を推進する」と述べました。具体的な施策は今後発表予定。",
    expected_level: "C",
    expected_tags: [],
  },
  {
    title: "ChatGPTの利用者数が3億人を突破",
    text: "OpenAIは、ChatGPTの週間アクティブユーザー数が3億人を超えたと発表しました。",
    expected_level: "C",
    expected_tags: [],
  },
];

async function runEval() {
  console.log("=== Quality Classification Eval ===\n");
  console.log(`Testing ${EVAL_CASES.length} cases against agent classification...\n`);

  const classifyPrompt = `You are evaluating article quality. For each article below, classify it as Level A, B, or C using these criteria:

- Level A: Real operational knowledge. Has 2+ of: who (specific org/person), what (specific use case), how (workflow/architecture details). Examples: deployment blogs, LT presentations, technical case studies.
- Level B: Use case is visible but operational details are limited. Examples: press releases, product announcements with use case description.
- Level C: Signal only. Market reports, event announcements, vague strategy statements.

For each article, respond in JSON format:
{"classifications": [{"index": 0, "level": "A"|"B"|"C", "reasoning": "one line"}]}

ARTICLES:
${EVAL_CASES.map((c, i) => `[${i}] Title: ${c.title}\nText: ${c.text}\n`).join("\n")}`;

  const proc = Bun.spawn(
    [
      "claude",
      "--print",
      "--dangerously-skip-permissions",
      "--model", "sonnet",
      "--max-turns", "1",
      classifyPrompt,
    ],
    { stdout: "pipe", stderr: "pipe" }
  );

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error("CC headless failed with exit code", exitCode);
    process.exit(1);
  }

  // Parse JSON from output
  let classifications: Array<{ index: number; level: string; reasoning: string }>;
  try {
    const jsonMatch = output.match(/\{[\s\S]*"classifications"[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in output");
    const parsed = JSON.parse(jsonMatch[0]);
    classifications = parsed.classifications;
  } catch (err) {
    console.error("Failed to parse classification output:");
    console.error(output.slice(0, 500));
    process.exit(1);
  }

  // Score
  let correct = 0;
  let total = EVAL_CASES.length;
  const results: Array<{ title: string; expected: string; got: string; match: boolean }> = [];

  for (const c of classifications) {
    const expected = EVAL_CASES[c.index];
    if (!expected) continue;
    const match = c.level === expected.expected_level;
    if (match) correct++;
    results.push({
      title: expected.title.slice(0, 40),
      expected: expected.expected_level,
      got: c.level,
      match,
    });
  }

  // Report
  console.log("RESULTS:");
  console.log("─".repeat(70));
  for (const r of results) {
    const icon = r.match ? "✓" : "✗";
    console.log(`  ${icon} [Expected: ${r.expected}] [Got: ${r.got}] ${r.title}...`);
  }
  console.log("─".repeat(70));
  console.log(`\nAccuracy: ${correct}/${total} (${((correct / total) * 100).toFixed(0)}%)`);
  console.log(`Target: >70%`);

  if (correct / total >= 0.7) {
    console.log("\n✓ PASS — Classification accuracy meets target");
  } else {
    console.log("\n✗ FAIL — Classification accuracy below target. Refine agent-prompt.md");
    process.exit(1);
  }
}

runEval();
