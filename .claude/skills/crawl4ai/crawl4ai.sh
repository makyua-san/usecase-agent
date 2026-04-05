#!/bin/bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
docker run --rm \
  -v "$SKILL_DIR/scripts:/scripts" \
  -v "$(pwd)/output:/output" \
  unclecode/crawl4ai:latest python /scripts/"$@"
