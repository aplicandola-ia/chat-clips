#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}
function run(bin, args, label) {
  console.log(label);
  const result = spawnSync(bin, args, { stdio: "inherit", env: process.env });
  if (result.error) fail(`${bin} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${bin} finished with exit code ${result.status ?? "unknown"}`);
}
function escapeFilterPath(value) {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
}
async function enhance(inputArg, title) {
  if (!inputArg) fail("Choose a vertical MP4 file.");
  const input = resolve(inputArg);
  if (!existsSync(input)) fail(`Video not found: ${input}`);
  const dir = dirname(input);
  const stem = basename(input).replace(/\.[^.]+$/, "");
  const wav = join(dir, `${stem}.audio.wav`);
  const srt = join(dir, `${stem}.srt`);
  const titleFile = join(dir, `${stem}.title.txt`);
  const output = join(dir, `${stem}_final.mp4`);
  const whisper = process.env.WHISPER_BIN || join(homedir(), ".local", "bin", process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli");
  const existing = [output, srt, wav, titleFile].filter(existsSync);
  if (existing.length) {
    fail(`Refusing to overwrite existing files: ${existing.join(", ")}. Move or rename them before retrying.`);
  }
  const model = process.env.WHISPER_MODEL || join(homedir(), ".local", "share", "stream-clip-maker", "ggml-base.bin");
  if (!existsSync(whisper)) fail("Whisper.cpp was not found. Set WHISPER_BIN in the app settings or install whisper-cli.");
  if (!existsSync(model)) fail(`Whisper model not found: ${model}. Set WHISPER_MODEL or install a multilingual model.`);
  mkdirSync(dir, { recursive: true });
  await import("node:fs/promises").then(({ writeFile }) => writeFile(titleFile, title || "BEST MOMENT", { encoding: "utf8", flag: "wx" }));
  try {
    run("ffmpeg", ["-hide_banner","-loglevel","error","-n","-i",input,"-vn","-ac","1","-ar","16000","-c:a","pcm_s16le",wav], "[1/3] Extracting audio…");
    run(whisper, ["-m",model,"-f",wav,"-l","es","-osrt","-of",join(dir,stem)], "[2/3] Transcribing Spanish speech…");
    if (!existsSync(srt)) fail("Whisper did not create the expected subtitle file.");
    let font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
    let family = "DejaVu Sans";
    if (process.platform === "win32") { font = "C:/Windows/Fonts/arialbd.ttf"; family = "Arial"; }
    if (process.platform === "darwin") { font = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"; family = "Arial"; }
    const filter = `drawtext=fontfile='${escapeFilterPath(font)}':textfile='${escapeFilterPath(titleFile)}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.55:boxborderw=18:x=(w-text_w)/2:y=70,subtitles='${escapeFilterPath(srt)}':force_style='FontName=${family},FontSize=17,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=180'`;
    run("ffmpeg", ["-hide_banner","-n","-i",input,"-vf",filter,"-c:v","libx264","-preset","veryfast","-crf","21","-c:a","copy",output], "[3/3] Burning title and captions into the video…");
    console.log(`FINAL_VIDEO: ${output}`);
  } finally {
    for (const file of [wav,titleFile]) if (existsSync(file)) unlinkSync(file);
  }
}
const [action,...args] = process.argv.slice(2);
if (action === "enhance") await enhance(args[0], args.slice(1).join(" "));
else fail("Unknown desktop engine action. Supported: enhance");
