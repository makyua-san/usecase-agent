#!/bin/bash
docker run --rm \
  -v /home/U0QEJUX/usecase-agent/.claude/skills/crawl4ai/scripts:/scripts \
  -v "$(pwd)/output:/output" \
  unclecode/crawl4ai:latest python /scripts/"$@"
