# chat-clips

> Español: [LEEME.md](LEEME.md) · Guide with the commands and a Claude Code prompt (Spanish): [aplicandolaia.com/recursos/clips-gta6](https://aplicandolaia.com/recursos/clips-gta6#chat-clips)

Finds clip-worthy moments in a stream from its chat: when many different people react at once, something happened on screen. Zero dependencies (Node 18+). Cutting needs `ffmpeg` plus `yt-dlp` (YouTube) or `TwitchDownloaderCLI` (Twitch).

## Use

```bash
# 1. Get the chat
yt-dlp --skip-download --write-subs --sub-langs live_chat -o stream "<youtube-url>"   # -> stream.live_chat.json
TwitchDownloaderCLI chatdownload --id <vod-id> -o chat.json                          # Twitch

# 2. Find moments and print the cut commands
node chat-clips.mjs stream.live_chat.json --url "<youtube-url>" --vertical

# 3. Same, but download and cut everything (one command)
node chat-clips.mjs stream.live_chat.json --url "<youtube-url>" --vertical --run --out clips
node chat-clips.mjs chat.json --vod <vod-id> --vertical --run --out clips
node chat-clips.mjs chat.json --video my-recording.mp4 --vertical --run   # own recording
```

`node chat-clips.mjs --help` lists every option.

## How it scores

- 10-second windows. Score = different people writing × (1 + 2 × share of them reacting).
- Reactions: `jaja`, `xd`, `kekw`, `lmao`, `nooo`, `wtf`, `qué pasó`, `clip`, `pog`, `F`, 😂 🤣 💀 😱 … (`REACTION` in the code).
- A window where one non-reaction message dominates (polls like "100", "sí") scores ×0.4.
- Each window is compared with the median of the previous 5 minutes (never below the stream's median). A spike is ≥ 2.5× that and ≥ 5 people.
- The first 3 minutes of the chat are skipped (greetings). Close peaks merge into one clip of up to 90 s.
- Clip = 20 s before the peak (chat reacts late) to 15 s after.
- `--simple` switches to raw message counts.

## Tested

- 14-nov-2026, a public GTA RP stream on YouTube (2 h 42 min, 13,964 messages): 6 moments found, and the best one was a real drama moment (chat: "la cagaste tú", "nooo", "VAVI TIENE LA CULPA"). `--run` with the top 2 downloaded and produced two 45 s 9:16 clips in 2 min 12 s.
- 15-nov-2026, Twitch (`--vod`, TwitchDownloaderCLI 1.56.5): 90 min of chat of a GTA stream VOD downloaded with `-b 2:00:00 -e 3:30:00` (34,197 messages in 65 s); 5 moments, and `--run` with the top 2 cut two 45 s 9:16 clips in 68 s.

The Twitch run found a bug, now fixed: windows started at 0, so a chat cropped from the middle of a VOD counted the hours before it as silence and its first minute showed as a fake spike (x146). Windows and `--skip` now start at the first message.

Note: the chat also reacts to what the streamer says, not only to the game (two of those moments were during the settings menu).

## Before you upload a clip

Only clip creators who allow it, and follow their rules and each platform's terms. Review every clip before you post it.

## License

MIT (see [LICENSE](LICENSE)). Made by [Aplicando La IA](https://aplicandolaia.com) with Claude.
