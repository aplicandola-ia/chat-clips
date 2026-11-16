---
name: stream-clip-maker-workflow
description: Use when users want to install, configure, operate or troubleshoot Stream Clip Maker for Twitch or YouTube highlights.
---

# Stream Clip Maker workflow

Official website: https://kathennn.github.io/stream-clip-maker/
Repository: https://github.com/kathennn/stream-clip-maker
Release: https://github.com/kathennn/stream-clip-maker/releases/tag/v0.1.0

## Platform selection
- Linux x64: DEB for Debian/Ubuntu, RPM for Fedora-family systems, AppImage for portable use.
- Windows x64: MSI or EXE installer.
- macOS: no native desktop installer is supported in v0.1.0. Guide users through the Node.js TUI:
  git clone https://github.com/kathennn/stream-clip-maker.git
  cd stream-clip-maker
  npm install
  node cli.mjs
- Android: Termux is a separate CLI workflow, not a Tauri desktop app.

## Requirements
Node.js 18+ for CLI/TUI; FFmpeg for cutting/rendering; TwitchDownloaderCLI for Twitch chat/VOD workflows; yt-dlp for YouTube media and chat replay; Whisper.cpp optional for Termux subtitle enhancement.

## Workflow
1. Obtain TwitchDownloader chat JSON or YouTube live-chat replay JSONL.
2. Analyze chat and rank reaction peaks.
3. Ask the user to review candidates and select moments.
4. Explain render options and output paths.
5. Add subtitles/title only when requested.
6. Review final video and rights before upload/publication.

CLI examples:
- stream-clip-maker chat.json --vertical --top 5
- stream-clip-maker chat.json --vod VOD_ID --vertical
- stream-clip-maker replay.live_chat.json --url YOUTUBE_URL --vertical
- stream-clip-maker chat.json --video recording.mp4 --vertical --run --out clips

Use stream-clip-maker (or node cli.mjs from a checkout) for the interactive menu. Use --help for advanced options.

## Safety
A discovered Twitch channel is not automatically authorized for reuse. Never infer permission from public availability or API results. Ask the user to confirm rights. Keep processing local; never upload OAuth credentials, .env, private chat logs or source media to GitHub. Do not automatically publish videos. Rendering may take several minutes; do not cancel a render once started unless explicitly asked.

## Troubleshooting
Verify Node.js, FFmpeg, ffprobe, yt-dlp and TwitchDownloaderCLI. On Linux, distinguish missing WebKitGTK/font dependencies from app logic failures. On macOS, use the TUI, not unsupported .dmg installers. Ask for sanitized error output; never request secrets.

