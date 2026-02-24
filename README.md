# Comic Strip Card for Home Assistant

A generic HACS-compatible Lovelace card that displays the current daily comic strip from **any** RSS feed. Works great with [ComicCaster](https://comiccaster.xyz/) feeds, but supports any RSS feed that includes comic images.

No shell scripts, automations, or server-side setup required. The card fetches the RSS feed directly in the browser and displays the comic image.

Inspired by [calvin-card-ha](https://github.com/Brianfit/calvin-card-ha) by Brian Fitzgerald.

---

## Features

- **Any comic strip** -- Configure any RSS feed URL per card instance
- **Multiple comics** -- One installation, unlimited cards with different feeds
- **Zero setup** -- No shell scripts, automations, or `configuration.yaml` changes needed
- **Visual editor** -- Configure the card from the HA dashboard UI (no YAML required)
- **Automatic theming** -- Inherits your Home Assistant theme colors
- **Two styles** -- Default (padded with title) or Minimal (edge-to-edge image)
- **Auto-refresh** -- Periodically re-fetches the feed (configurable interval)
- **CORS handling** -- Built-in CORS proxy fallback for feeds that don't allow browser requests
- **Robust parsing** -- Handles `<img>`, `<enclosure>`, `<media:content>`, and `<content:encoded>` RSS formats

---

## Installation

### HACS (Recommended)

1. Open **HACS** in your Home Assistant instance
2. Click the **three dots** menu in the top right and select **Custom repositories**
3. Add this repository URL and select category **Dashboard** (Lovelace)
4. Click **Install**
5. **Restart** Home Assistant

### Manual

1. Download `comic-strip-card.js` from the `dist/` folder
2. Copy it to `/config/www/` (or any subfolder you like)
3. Add the resource in **Settings > Dashboards > Resources**:
   - URL: `/local/comic-strip-card.js` (adjust path to where you placed it)
   - Type: JavaScript Module

---

## Usage

### Visual Editor

1. Edit your dashboard
2. Click **Add Card**
3. Search for **Comic Strip Card**
4. Paste an RSS feed URL (e.g., from [comiccaster.xyz](https://comiccaster.xyz/))
5. Adjust optional settings and save

### YAML

```yaml
type: custom:comic-strip-card
rss_url: https://comiccaster.xyz/rss/calvinandhobbes
title: Calvin and Hobbes
show_title: true
show_date: true
card_style: default
```

### Options

| Option             | Type    | Default     | Description                                                              |
|--------------------|---------|-------------|--------------------------------------------------------------------------|
| `rss_url`          | string  | *required*  | The RSS feed URL for the comic strip                                     |
| `title`            | string  | *from feed* | Display title (overrides the title from the RSS feed)                    |
| `show_title`       | boolean | `true`      | Show the comic title and date above the image                            |
| `show_date`        | boolean | `true`      | Show the publication date from the RSS feed                              |
| `card_style`       | string  | `default`   | Card style: `default` (padded with title) or `minimal` (edge-to-edge)   |
| `refresh_interval` | number  | `1`         | How often to re-fetch the feed, in hours (minimum 0.25)                  |
| `cors_proxy`       | string  | *auto*      | Custom CORS proxy URL template (use `{url}` as placeholder)             |

---

## Multiple Comics Example

Add as many comic cards as you want, each pointing to a different RSS feed:

```yaml
type: vertical-stack
cards:
  - type: custom:comic-strip-card
    rss_url: https://comiccaster.xyz/rss/calvinandhobbes
    title: Calvin and Hobbes

  - type: custom:comic-strip-card
    rss_url: https://comiccaster.xyz/rss/garfield
    title: Garfield

  - type: custom:comic-strip-card
    rss_url: https://comiccaster.xyz/rss/peanuts
    title: Peanuts
    card_style: minimal
```

---

## Finding Comics

Browse available comics at [comiccaster.xyz](https://comiccaster.xyz/). Click on any comic to get its RSS feed URL. The URL format is typically:

```
https://comiccaster.xyz/rss/<comic-name>
```

The card also works with any other RSS feed that includes comic images (via `<img>` tags in the description, `<enclosure>`, `<media:content>`, or `<content:encoded>`).

---

## How It Works

1. The card fetches the RSS feed URL directly from your browser
2. It parses the XML to find the first item's comic image URL
3. It displays the image along with the title and publication date from the feed
4. It re-fetches the feed periodically (default: every hour) to pick up new comics

If the RSS feed server doesn't include CORS headers (common for many feeds), the card automatically falls back to a public CORS proxy. You can also configure a custom proxy in the card settings.

---

## CORS Proxy

Many RSS feeds don't include CORS headers, which means the browser can't fetch them directly. The card handles this automatically:

1. It first tries a direct fetch
2. If that fails due to CORS, it falls back to built-in public proxies (allorigins.win, corsproxy.io)
3. If you prefer a specific proxy, set `cors_proxy` in the card config:

```yaml
type: custom:comic-strip-card
rss_url: https://comiccaster.xyz/rss/calvinandhobbes
cors_proxy: "https://my-proxy.example.com/?url={url}"
```

The `{url}` placeholder will be replaced with the encoded RSS feed URL.

---

## Troubleshooting

**Card shows "Could not fetch the RSS feed"**
- Verify the RSS URL works by opening it in a browser
- The built-in CORS proxies may be down; try setting a custom `cors_proxy`
- Check your browser's developer console for error details

**Card shows "No comic image found"**
- The RSS feed may use an unsupported format
- Open the feed URL in a browser and check if items contain image references
- Please open an issue with the feed URL so we can add support

**Image doesn't update**
- The card re-fetches based on `refresh_interval` (default: 1 hour)
- Try reducing the interval or refreshing the dashboard manually
- The comic source may not have published today's strip yet

**Card doesn't appear in the card picker**
- Make sure you've added the resource correctly in Settings > Dashboards > Resources
- Clear your browser cache and refresh the dashboard

---

## Credits

- Inspired by [calvin-card-ha](https://github.com/Brianfit/calvin-card-ha) by Brian Fitzgerald
- Comic feeds powered by [ComicCaster](https://comiccaster.xyz/) / [Comics RSS](https://github.com/adamprime/comiccaster)

## License

MIT License. See [LICENSE](LICENSE) for details.
