# Stream Clip Maker

**Find the best moments in Twitch and YouTube streams from chat reactions, then turn them into shareable clips.**

Stream Clip Maker analyzes live-chat activity to detect moments when many different viewers react at once. It ranks the strongest highlights and can generate cut commands or run the cutting workflow with FFmpeg, yt-dlp, or TwitchDownloaderCLI.

- Detect stream highlights from TwitchDownloader chat JSON and YouTube live-chat replay JSONL.
- Rank reaction spikes using unique chatters, reaction signals, and a rolling baseline.
- Create clips from Twitch VODs, YouTube URLs, or local recordings.
- Export vertical 9:16 clips with a blurred background.
- Includes optional Android/Termux helpers for Spanish subtitles and a title overlay.

**No Node.js runtime dependencies.** External media tools are required for downloading and rendering clips.

Español: [LEEME.md](LEEME.md)

## Install

Requires Node.js 18 or newer.

```bash
npm install --global stream-clip-maker
```

Or run without a global install:

```bash
npx stream-clip-maker --help
```

## Quick start

First, download a chat replay:

```bash
# Twitch chat
TwitchDownloaderCLI chatdownload --id <VOD_ID> -o chat.json

# YouTube live chat replay
yt-dlp --skip-download --write-subs --sub-langs live_chat -o stream "<YOUTUBE_URL>"
```

Analyze the chat and print suggested cut commands:

```bash
stream-clip-maker chat.json --vod <VOD_ID> --vertical
stream-clip-maker stream.live_chat.json --url "<YOUTUBE_URL>" --vertical
```

Run the commands and create clips:

```bash
stream-clip-maker chat.json --vod <VOD_ID> --vertical --run --out clips
stream-clip-maker stream.live_chat.json --url "<YOUTUBE_URL>" --vertical --run --out clips
stream-clip-maker chat.json --video recording.mp4 --vertical --run --out clips
```

See all options:

```bash
stream-clip-maker --help
```

## Requirements

- Node.js 18+.
- FFmpeg for video cutting and rendering.
- Twitch VOD downloads: [TwitchDownloaderCLI](https://github.com/lay295/TwitchDownloader).
- YouTube downloads: [yt-dlp](https://github.com/yt-dlp/yt-dlp).
- Optional Android/Termux workflow: Whisper.cpp and its multilingual base model for speech captions.

The core chat-analysis command has no third-party Node.js dependencies. Downloading and rendering media requires the corresponding external tools.

## How highlight detection works

- Chat is divided into 10-second windows.
- Each window is scored using the number of unique chatters and the share of those chatters who post reaction messages.
- Poll-like windows dominated by one repeated non-reaction message are down-weighted.
- A window is considered a candidate when it exceeds the rolling baseline and minimum-reactor thresholds.
- Nearby peaks are merged into a clip, up to the configured maximum duration.
- By default, the first three minutes are skipped to avoid greeting spikes.

The scoring is heuristic, not an AI model. Chat reactions can refer to what the streamer says or does, not only to the game. Always review the detected moments and finished videos.

## Vertical clips

The `--vertical` option creates a 9:16 version with a blurred background. It does not currently perform automatic face tracking or smart subject reframing.

## Android / Termux helpers

The repository also includes optional scripts for an Android workflow:

- `make-clips.sh`: Twitch VOD chat download, highlight detection, vertical clip creation, Spanish captions, title overlay, and copy to Android Downloads.
- `enhance-clip.sh`: Spanish speech transcription with Whisper.cpp and title/subtitle burn-in.
- `discover-twitch.sh`: search live Twitch channels by category using Twitch Helix.
- `youtube-auth.mjs` and `youtube-upload.mjs`: local YouTube OAuth and private upload workflow.
- `publish-short.sh`: validates a final 1080×1920 MP4 of up to 180 seconds before upload.

These helpers are designed for the project's Termux setup and require additional local tools and configuration. They are not a hosted service and do not publish automatically.

### Twitch discovery setup

1. Create an application in the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Copy `.env.example` to `.env` and fill in `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`.
3. Add creator logins you have permission to edit to `allowedCreators` in `rules.json`.
4. Run `./discover-twitch.sh "GTA 6"` from the repository checkout.

Discovered channels are **not automatically authorized**. Only creators explicitly listed in `allowedCreators` are marked as authorized in the discovery output. Twitch API discovery does not grant permission to reuse a creator's content.

### YouTube upload safety

The upload helper requires an explicit `--confirm-rights` flag, accepts only files ending in `_final.mp4`, validates 1080×1920 dimensions and a duration up to 180 seconds, and uploads as private. Review the clip, creator permissions, title, and description before publishing.

## Development

```bash
npm run check
npm test
npm pack --dry-run
```

## License

MIT. See [LICENSE](LICENSE).
