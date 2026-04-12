import asyncio
import json
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

URLS = [
    "https://zenn.dev/aws_japan/articles/87b98a92dfcfbf",
    "https://zenn.dev/ubie_dev/articles/e9cef996ed3600",
    "https://zenn.dev/ubie_dev/articles/2c474a1c5f71a8",
    "https://zenn.dev/seratch/articles/a0d4ee66688d27",
    "https://zenn.dev/innovation/articles/ce0f4b638fd86c",
    "https://zenn.dev/headwaters/articles/ad5cae54fabbb5",
]

async def main():
    browser_config = BrowserConfig(headless=True, viewport_width=1920, viewport_height=1080)
    pruning_filter = PruningContentFilter(threshold=0.4, threshold_type="fixed")
    md_generator = DefaultMarkdownGenerator(content_filter=pruning_filter)
    config = CrawlerRunConfig(
        page_timeout=30000,
        remove_overlay_elements=True,
        markdown_generator=md_generator,
        css_selector="article, section.znc, main",
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
                    title = result.metadata.get("title", "")
                    # Remove " | Zenn" suffix
                    title = title.replace(" | Zenn", "").strip()
                    results.append({
                        "url": url,
                        "title": title,
                        "content_preview": content[:800],
                        "success": True
                    })
                else:
                    results.append({"url": url, "success": False})
            except Exception as e:
                results.append({"url": url, "success": False, "error": str(e)})

    print(json.dumps(results, ensure_ascii=False, indent=2))

asyncio.run(main())
