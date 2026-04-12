import asyncio
import json
import sys
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

URLS = [
    "https://dev.classmethod.jp/articles/agentcore-codeinterpreter/",
    "https://dev.classmethod.jp/articles/local-llm-for-manufacturing-dx-2026/",
    "https://dev.classmethod.jp/articles/claude-code-output-style/",
    "https://dev.classmethod.jp/articles/genu-agentcore-gateway/",
    "https://dev.classmethod.jp/articles/dgx-spark-gemma4-benchmark/",
]

async def main():
    browser_config = BrowserConfig(headless=True, viewport_width=1920, viewport_height=1080)
    pruning_filter = PruningContentFilter(threshold=0.4, threshold_type="fixed")
    md_generator = DefaultMarkdownGenerator(content_filter=pruning_filter)

    config = CrawlerRunConfig(
        page_timeout=30000,
        remove_overlay_elements=True,
        markdown_generator=md_generator,
        css_selector="article, .entry-content, main",
    )

    results = []
    async with AsyncWebCrawler(config=browser_config) as crawler:
        for url in URLS:
            try:
                result = await crawler.arun(url=url, config=config)
                if result.success:
                    md = result.markdown
                    if hasattr(md, 'fit_markdown'):
                        content = md.fit_markdown or md.raw_markdown
                    else:
                        content = str(md)
                    results.append({
                        "url": url,
                        "title": result.metadata.get("title", ""),
                        "content_preview": content[:1500],
                        "content_length": len(content),
                        "success": True
                    })
                else:
                    results.append({"url": url, "success": False})
            except Exception as e:
                results.append({"url": url, "success": False, "error": str(e)})

    print(json.dumps(results, ensure_ascii=False, indent=2))

asyncio.run(main())
