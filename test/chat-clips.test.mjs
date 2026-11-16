import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "chat-clips.mjs");

function fixtureChat(dir) {
  const file = join(dir, "chat.json");
  const comments = [0, 10, 20, 30, 31, 32, 33, 34, 40, 50, 60].map((time, i) => ({
    content_offset_seconds: time,
    commenter: { _id: `user-${i}` },
    message: { body: `message ${i}` },
  }));
  writeFileSync(file, JSON.stringify({ comments }));
  return file;
}

function run(chat, out, extra = [], env = process.env) {
  return spawnSync(process.execPath, [
    cli, chat, "--simple", "--window", "10", "--lead", "0", "--tail", "0",
    "--max", "30", "--skip", "0", "--baseline", "10", "--ratio", "2",
    "--min", "2", "--out", out, ...extra,
  ], { encoding: "utf8", env });
}

test("detects a synthetic chat spike and writes a reviewable moments file", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "stream-clip-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const chat = fixtureChat(dir);
  const out = join(dir, "out");
  const result = run(chat, out);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(join(out, "moments.json"), "utf8"));
  assert.equal(report.moments.length, 1);
  assert.equal(report.moments[0].peak, 30);
  assert.equal(report.moments[0].messages, 5);
});

test("refuses to replace an existing moments.json", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "stream-clip-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const chat = fixtureChat(dir);
  const out = join(dir, "out");
  mkdirSync(out);
  const report = join(out, "moments.json");
  writeFileSync(report, "keep this report\n");
  const result = run(chat, out);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to overwrite existing output/i);
  assert.equal(readFileSync(report, "utf8"), "keep this report\n");
});

test("preflights media outputs before running tools and preserves existing clips", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "stream-clip-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const chat = fixtureChat(dir);
  const inputVideo = join(dir, "input.mp4");
  writeFileSync(inputVideo, "not a real video; the fake tool must never run");
  const out = join(dir, "out");
  mkdirSync(out);
  const existingClip = join(out, "clip_01_00-00-30.mp4");
  const existingVerticalClip = join(out, "clip_01_00-00-30_9x16.mp4");
  writeFileSync(existingClip, "keep this clip\n");
  writeFileSync(existingVerticalClip, "keep this vertical clip\n");
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const marker = join(dir, "ffmpeg-was-run");
  const fakeFfmpeg = join(bin, "ffmpeg");
  writeFileSync(fakeFfmpeg, `#!/bin/sh\nprintf called > '${marker}'\nexit 99\n`);
  chmodSync(fakeFfmpeg, 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH || ""}` };
  const result = run(chat, out, ["--video", inputVideo, "--vertical", "--run"], env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to overwrite existing output/i);
  assert.equal(readFileSync(existingClip, "utf8"), "keep this clip\n");
  assert.equal(readFileSync(existingVerticalClip, "utf8"), "keep this vertical clip\n");
  assert.equal(existsSync(marker), false, "media tools must not start when an output already exists");
  assert.equal(existsSync(join(out, "moments.json")), false, "preflight failure must not write a partial report");
});

test("uses no-overwrite options for FFmpeg and yt-dlp generated commands", async () => {
  const { commandsFor } = await import("../chat-clips.mjs");
  const moment = { peak: 30, start: 20, end: 40 };
  const ffmpeg = commandsFor(moment, 0, { out: "clips", video: "input.mp4", vertical: true });
  assert.equal(ffmpeg[0][1], "-n");
  assert.equal(ffmpeg[1][1], "-n");
  const ytdlp = commandsFor(moment, 0, { out: "clips", url: "https://example.com/video", vertical: false });
  assert.ok(ytdlp[0].includes("--no-overwrites"));
});

test("parses Twitch JSON and YouTube live-chat replay JSONL", async () => {
  const { fromTwitch, fromYouTube } = await import("../chat-clips.mjs");
  assert.deepEqual(fromTwitch({ comments: [{ content_offset_seconds: "12.5", commenter: { _id: "twitch-user" }, message: { body: "hola" } }] }), [
    { t: 12.5, user: "twitch-user", text: "hola" },
  ]);
  const row = '{"replayChatItemAction":{"videoOffsetTimeMsec":"1250","actions":[{"addChatItemAction":{"item":{"liveChatTextMessageRenderer":{"authorExternalChannelId":"youtube-user","message":{"runs":[{"text":"hello"}]}}}}}]}}';
  assert.deepEqual(fromYouTube(row), [{ t: 1.25, user: "youtube-user", text: "hello" }]);
});
