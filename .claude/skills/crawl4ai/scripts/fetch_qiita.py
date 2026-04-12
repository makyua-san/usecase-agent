import asyncio
import json
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

async def main():
    browser_config = BrowserConfig(headless=True, viewport_width=1920, viewport_height=1080)
    config = CrawlerRunConfig(
        page_timeout=40000,
        remove_overlay_elements=True,
        wait_for="css:article",
    )

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(
            url="https://qiita.com/tags/llm",
            config=config
        )

        if not result.success:
            print(json.dumps({"error": "Failed to fetch"}))
            return

        all_links = result.links.get("internal", []) + result.links.get("external", [])
        article_links = []
        seen = set()
        import re
        for link in all_links:
            href = link.get("href", "") if isinstance(link, dict) else str(link)
            if re.search(r'qiita\.com/.+/items/[0-9a-f]+', href) and href not in seen:
                seen.add(href)
                text = link.get("text", "").strip() if isinstance(link, dict) else ""
                article_links.append({"url": href, "title": text})
            if len(article_links) >= 15:
                break

        print(json.dumps({
            "source": "Qiita LLM tag",
            "article_count": len(article_links),
            "articles": article_links
        }, ensure_ascii=False, indent=2))

asyncio.run(main())
