#!/bin/bash
# =============================================================================
# Comic Strip Fetcher for Home Assistant
# =============================================================================
# Downloads the latest comic strip image from an RSS feed and saves it locally
# so the Comic Strip Card can display it.
#
# Usage:
#   comic-strip.sh <rss_url> [save_dir]
#
# Arguments:
#   rss_url   - The RSS feed URL (e.g. https://comiccaster.xyz/rss/calvinandhobbes)
#   save_dir  - (Optional) Directory to save files. Defaults to:
#               /config/www/community/comic-strip-card/
#
# Output files:
#   <slug>.png        - The comic strip image
#   <slug>_data.json  - Metadata (title, timestamp) used by the card
#
# Examples:
#   comic-strip.sh https://comiccaster.xyz/rss/calvinandhobbes
#   comic-strip.sh https://comiccaster.xyz/rss/garfield /config/www/comics/
# =============================================================================

set -euo pipefail

# --- Arguments ---------------------------------------------------------------
RSS_URL="${1:-}"
SAVE_DIR="${2:-/config/www/community/comic-strip-card/}"

if [ -z "$RSS_URL" ]; then
  echo "Error: No RSS URL provided."
  echo "Usage: comic-strip.sh <rss_url> [save_dir]"
  exit 1
fi

# Ensure trailing slash on save dir
SAVE_DIR="${SAVE_DIR%/}/"

# --- Derive slug from URL (last path segment) --------------------------------
SLUG=$(echo "$RSS_URL" | sed 's|.*://[^/]*/||' | sed 's|/$||' | sed 's|.*/||' | sed 's|\.[^.]*$||' | sed 's|[^a-zA-Z0-9_-]|_|g')
if [ -z "$SLUG" ]; then
  SLUG="comic"
fi

IMAGE_FILE="${SAVE_DIR}${SLUG}.png"
JSON_FILE="${SAVE_DIR}${SLUG}_data.json"

echo "Comic Strip Fetcher"
echo "  RSS URL:  $RSS_URL"
echo "  Slug:     $SLUG"
echo "  Save Dir: $SAVE_DIR"

# --- Create output directory if needed ----------------------------------------
mkdir -p "$SAVE_DIR"

# --- Fetch RSS feed -----------------------------------------------------------
echo "Fetching RSS feed..."
RSS_DATA=$(curl -sL --max-time 30 "$RSS_URL")

if [ -z "$RSS_DATA" ]; then
  echo "Error: Empty response from RSS feed."
  exit 1
fi

# --- Extract first <item> block -----------------------------------------------
ITEM=$(echo "$RSS_DATA" | sed -n '/<item>/,/<\/item>/p' | head -n 30)

if [ -z "$ITEM" ]; then
  echo "Error: No <item> found in RSS feed."
  exit 1
fi

# --- Extract title ------------------------------------------------------------
TITLE=$(echo "$ITEM" | sed -n 's:.*<title>\(.*\)</title>.*:\1:p' | head -n1)
TITLE=$(echo "$TITLE" | sed 's/<!\[CDATA\[//g' | sed 's/\]\]>//g')

echo "  Title:    $TITLE"

# --- Extract description and decode HTML entities -----------------------------
DESCRIPTION=$(echo "$ITEM" | sed -n 's:.*<description>\(.*\)</description>.*:\1:p' | head -n1)

# Decode CDATA wrapper if present
DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/<!\[CDATA\[//g' | sed 's/\]\]>//g')

# Decode common HTML entities
DESCRIPTION=$(echo "$DESCRIPTION" \
  | sed 's/&lt;/</g' \
  | sed 's/&gt;/>/g' \
  | sed 's/&amp;/\&/g' \
  | sed 's/&quot;/"/g' \
  | sed "s/&#39;/'/g" \
  | sed 's/&#x27;/'"'"'/g' \
  | sed 's/&apos;/'"'"'/g')

# --- Extract image URL from the description HTML ------------------------------
# Try <img src="..."> first
IMAGE_URL=$(echo "$DESCRIPTION" | sed -n 's/.*<img[^>]*src="\([^"]*\)".*/\1/p' | head -n1)

# Fallback: try <img src='...'>
if [ -z "$IMAGE_URL" ]; then
  IMAGE_URL=$(echo "$DESCRIPTION" | sed -n "s/.*<img[^>]*src='\([^']*\)'.*/\1/p" | head -n1)
fi

# Fallback: try <enclosure url="..."> in the item
if [ -z "$IMAGE_URL" ]; then
  IMAGE_URL=$(echo "$ITEM" | sed -n 's/.*<enclosure[^>]*url="\([^"]*\)".*/\1/p' | head -n1)
fi

# Fallback: try <media:content url="...">
if [ -z "$IMAGE_URL" ]; then
  IMAGE_URL=$(echo "$ITEM" | sed -n 's/.*<media:content[^>]*url="\([^"]*\)".*/\1/p' | head -n1)
fi

if [ -z "$IMAGE_URL" ]; then
  echo "Error: Could not find an image URL in the RSS item."
  echo "Description content: $DESCRIPTION"
  exit 1
fi

echo "  Image:    $IMAGE_URL"

# --- Download image -----------------------------------------------------------
echo "Downloading comic strip image..."
HTTP_CODE=$(curl -sL --max-time 30 -w "%{http_code}" -o "$IMAGE_FILE" "$IMAGE_URL")

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 400 ]; then
  echo "Error: Failed to download image (HTTP $HTTP_CODE)."
  rm -f "$IMAGE_FILE"
  exit 1
fi

# Verify we got an actual image (check file size > 0)
FILE_SIZE=$(stat -f%z "$IMAGE_FILE" 2>/dev/null || stat -c%s "$IMAGE_FILE" 2>/dev/null || echo "0")
if [ "$FILE_SIZE" -eq 0 ]; then
  echo "Error: Downloaded file is empty."
  rm -f "$IMAGE_FILE"
  exit 1
fi

echo "  Saved:    $IMAGE_FILE ($FILE_SIZE bytes)"

# --- Write JSON metadata ------------------------------------------------------
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Escape double quotes in title for valid JSON
TITLE_ESCAPED=$(echo "$TITLE" | sed 's/"/\\"/g')

cat > "$JSON_FILE" << EOF
{
  "image_url": "${SLUG}.png",
  "title": "${TITLE_ESCAPED}",
  "timestamp": "${TIMESTAMP}",
  "rss_url": "${RSS_URL}",
  "source_image_url": "${IMAGE_URL}"
}
EOF

echo "  Metadata: $JSON_FILE"
echo "Done!"
