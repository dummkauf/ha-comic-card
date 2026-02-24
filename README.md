# Comic Strip Card for Home Assistant

A generic HACS-compatible Lovelace card that displays the current daily comic strip from **any** RSS feed. Works great with [ComicCaster](https://comiccaster.xyz/) feeds, but supports any RSS feed that includes comic images.

This is a generalized version of [calvin-card-ha](https://github.com/Brianfit/calvin-card-ha) by Brian Fitzgerald. Instead of being hardcoded to one comic, you configure which RSS feed to use per card instance, and you can add as many different comics to your dashboard as you like.

---

## Features

- **Any comic strip** -- Configure any RSS feed URL per card instance
- **Multiple comics** -- One installation, unlimited cards with different feeds
- **Visual editor** -- Configure the card from the HA dashboard UI (no YAML required)
- **Automatic theming** -- Inherits your Home Assistant theme colors
- **Two styles** -- Default (padded with title) or Minimal (edge-to-edge image)
- **Robust parsing** -- Handles `<img>`, `<enclosure>`, and `<media:content>` RSS formats

---

## Installation

### HACS (Recommended)

1. Open **HACS** in your Home Assistant instance
2. Click the **three dots** menu in the top right and select **Custom repositories**
3. Add this repository URL and select category **Dashboard** (Lovelace)
4. Click **Install**
5. **Restart** Home Assistant

### Manual

1. Download `comic-strip-card.js` and `comic-strip.sh` from the `dist/` folder
2. Copy them to `/config/www/community/comic-card/` (or any folder name you prefer)
3. Add the resource in **Settings > Dashboards > Resources**:
   - URL: `/local/community/comic-card/comic-strip-card.js`
   - Type: JavaScript Module

> **Note on folder names:** HACS names the download folder after your GitHub repository name. If your repo is called `comic-card`, the folder will be `/config/www/community/comic-card/`. All paths in this README use that name. Both the JS card and shell script auto-detect their folder location, so they work regardless of the actual folder name.

---

## Setup

The card displays a locally cached comic image. A shell script fetches the image from the RSS feed, and a Home Assistant automation runs it on a schedule.

### Step 1: Make the Shell Script Executable

```bash
chmod +x /config/www/community/comic-card/comic-strip.sh
```

### Step 2: Add Shell Commands

Add the following to your `configuration.yaml`. Create one entry per comic you want to display:

```yaml
shell_command:
  fetch_comic_calvinandhobbes: >-
    /config/www/community/comic-card/comic-strip.sh
    https://comiccaster.xyz/rss/calvinandhobbes
  fetch_comic_garfield: >-
    /config/www/community/comic-card/comic-strip.sh
    https://comiccaster.xyz/rss/garfield
  fetch_comic_peanuts: >-
    /config/www/community/comic-card/comic-strip.sh
    https://comiccaster.xyz/rss/peanuts
```

After editing `configuration.yaml`, restart Home Assistant or reload shell commands.

### Step 3: Create an Automation

Create an automation to fetch the comics daily. Go to **Settings > Automations** and create a new automation:

```yaml
alias: Fetch Daily Comics
description: Downloads the latest comic strips each morning
triggers:
  - trigger: time
    at: "06:00:00"
actions:
  - action: shell_command.fetch_comic_calvinandhobbes
  - action: shell_command.fetch_comic_garfield
  - action: shell_command.fetch_comic_peanuts
mode: single
```

You can also trigger it manually to test: go to **Developer Tools > Services** and call `shell_command.fetch_comic_calvinandhobbes`.

### Step 4: Run It Once

Before the card can display anything, run the shell command at least once. Go to **Developer Tools > Services**, select your shell command, and click **Call Service**.

---

## Card Configuration

### Visual Editor

1. Edit your dashboard
2. Click **Add Card**
3. Search for **Comic Strip Card**
4. Fill in the RSS feed URL and optional settings

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

| Option       | Type    | Default   | Description                                                                 |
|-------------|---------|-----------|-----------------------------------------------------------------------------|
| `rss_url`   | string  | *required* | The RSS feed URL for the comic strip                                        |
| `title`     | string  | *from feed* | Display title (overrides the title from the RSS feed)                       |
| `show_title`| boolean | `true`    | Show the comic title and date above the image                               |
| `show_date` | boolean | `true`    | Show the date the comic was last fetched                                    |
| `card_style`| string  | `default` | Card style: `default` (padded with title) or `minimal` (edge-to-edge)       |

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

---

## How It Works

1. **Shell script** (`comic-strip.sh`) fetches the RSS feed, parses the XML to find the comic image URL, and downloads the image to the local filesystem
2. **Automation** runs the shell script daily (or on your preferred schedule)
3. **Lovelace card** (`comic-strip-card.js`) reads the cached image and metadata from the local filesystem and renders it

Files are stored in the same folder as the card (e.g., `/config/www/community/comic-card/`):
- `<slug>.png` -- The comic strip image
- `<slug>_data.json` -- Metadata (title, timestamp)

The slug is derived from the RSS URL (e.g., `calvinandhobbes` from `https://comiccaster.xyz/rss/calvinandhobbes`).

---

## Troubleshooting

**Card shows "No comic strip loaded yet"**
- The shell script hasn't run yet. Go to Developer Tools > Services and call the shell command manually.
- Check that the file exists: look for `/config/www/community/comic-card/<slug>.png`

**Shell command fails**
- Check the Home Assistant logs for error output
- Verify the RSS URL works by opening it in a browser
- Make sure `curl` is available in your HA installation
- Ensure the script is executable: `chmod +x comic-strip.sh`

**Image doesn't update**
- The card uses a date-based cache buster; if the image hasn't changed today, it may still show yesterday's comic
- Try clearing your browser cache or hard-refreshing the dashboard
- Check that the automation is running at the expected time

**Card doesn't appear in the card picker**
- Make sure you've added the resource correctly in Settings > Dashboards > Resources
- Try clearing your browser cache and refreshing

---

## Credits

- Inspired by [calvin-card-ha](https://github.com/Brianfit/calvin-card-ha) by Brian Fitzgerald
- Comic feeds powered by [ComicCaster](https://comiccaster.xyz/) / [Comics RSS](https://github.com/adamprime/comiccaster)

## License

MIT License. See [LICENSE](LICENSE) for details.
