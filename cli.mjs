#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  outro,
  select,
  text,
  note,
} from "@clack/prompts";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const run = (args, options = {}) => spawnSync(process.execPath, [resolve(ROOT, "chat-clips.mjs"), ...args], {
  cwd: process.cwd(), stdio: "inherit", ...options,
});
const cancelled = (value) => {
  if (isCancel(value)) {
    cancel("Operación cancelada. No se ha ejecutado ningún proceso.");
    process.exit(0);
  }
  return value;
};
const askText = async (message, placeholder = "", validate) => cancelled(await text({ message, placeholder, validate }));
const askSelect = async (message, options) => cancelled(await select({ message, options }));
const askConfirm = async (message, initialValue = false) => cancelled(await confirm({ message, initialValue }));

function loadEnvFile() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith(") && value.endsWith("))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function launch(args, label) {
  note(args.map((x) => JSON.stringify(x)).join(" "), label);
  const result = run(args);
  if (result.error) throw result.error;
  if (result.status !== 0) note(`El comando terminó con código ${result.status ?? "desconocido"}.`, "Proceso finalizado");
  else outro("Proceso completado.");
}

async function analyzeChat() {
  const chat = await askText("Ruta del archivo de chat JSON / JSONL", "./chat.json", (v) => v.trim() ? undefined : "Indica la ruta del archivo.");
  if (!existsSync(resolve(chat))) {
    note(`No encuentro el archivo: ${resolve(chat)}`, "Archivo no encontrado");
    return;
  }
  const source = await askSelect("¿De dónde saldrán los clips?", [
    { value: "analysis", label: "Solo analizar y guardar los momentos" },
    { value: "twitch", label: "Crear clips desde un VOD de Twitch" },
    { value: "youtube", label: "Crear clips desde una URL compatible con yt-dlp" },
    { value: "local", label: "Crear clips desde un vídeo local" },
  ]);
  const args = [chat];
  if (source === "twitch") args.push("--vod", await askText("ID del VOD de Twitch", "1234567890", (v) => /^\d+$/.test(v.trim()) ? undefined : "El ID debe contener solo números."));
  if (source === "youtube") args.push("--url", await askText("URL del vídeo", "https://www.youtube.com/watch?v=...", (v) => /^https?:\/\//i.test(v.trim()) ? undefined : "Introduce una URL http o https."));
  if (source === "local") args.push("--video", await askText("Ruta del vídeo local", "./stream.mp4", (v) => existsSync(resolve(v)) ? undefined : "No encuentro ese vídeo."));
  const top = await askText("¿Cuántos momentos quieres conservar?", "10", (v) => /^\d+$/.test(v) && Number(v) > 0 ? undefined : "Indica un número mayor que cero." );
  const vertical = await askConfirm("¿Crear también versión vertical 9:16?", true);
  const output = await askText("Carpeta de salida", "clips");
  args.push("--top", top, "--out", output);
  if (vertical) args.push("--vertical");
  if (source !== "analysis") {
    note("Se descargarán y/o renderizarán vídeos. Puede tardar varios minutos por clip.", "Antes de empezar");
    if (!await askConfirm("¿Confirmas que tienes permiso para usar este contenido y quieres iniciar el procesamiento?", false)) {
      outro("No se ha iniciado ningún procesamiento.");
      return;
    }
    args.push("--run");
  }
  launch(args, "Plan de ejecución");
}

async function discoverTwitch() {
  loadEnvFile();
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    note("Configura TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET en un archivo .env en la carpeta desde la que ejecutas la TUI. Puedes partir de .env.example. No compartas esas claves.", "Falta la configuración de Twitch");
    return;
  }
  const topic = await askText("Juego o categoría que quieres buscar", "GTA 6", (v) => v.trim() ? undefined : "Escribe una categoría.");
  note("La búsqueda consulta directos y VODs archivados. Descubrir un canal no significa que tengas permiso para reutilizar su contenido.", "Permisos de contenido");
  if (!await askConfirm(`¿Buscar directos y VODs de «${topic}»?`, false)) return;
  const result = spawnSync(process.execPath, [resolve(ROOT, "discover-twitch.mjs"), topic], { cwd: process.cwd(), stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status === 0) outro("Búsqueda terminada. Revisa discovery.json y confirma permisos antes de reutilizar contenido.");
  else note(`La búsqueda terminó con código ${result.status ?? "desconocido"}.`, "Proceso finalizado");
}

async function enhanceClip() {
  const input = await askText("Ruta del clip vertical que quieres mejorar", "./clip_9x16.mp4", (v) => existsSync(resolve(v)) ? undefined : "No encuentro ese archivo." );
  const title = await askText("Título que aparecerá en el vídeo", "MOMENTO DESTACADO");
  note("Whisper.cpp y FFmpeg deben estar instalados y configurados. La recodificación puede tardar varios minutos.", "Requisitos");
  if (!await askConfirm("¿Iniciar transcripción y renderizado?", false)) return;
  const script = resolve(ROOT, "enhance-clip.sh");
  const result = spawnSync("bash", [script, resolve(input), title], { cwd: process.cwd(), stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status === 0) outro("Clip mejorado correctamente.");
  else note(`El proceso terminó con código ${result.status ?? "desconocido"}.`, "Proceso finalizado");
}

async function toolsCheck() {
  const checks = ["node", "ffmpeg", "ffprobe", "yt-dlp", "TwitchDownloaderCLI"];
  const rows = checks.map((name) => {
    const result = spawnSync("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" });
    return `${result.status === 0 ? "✓" : "–"} ${name}${result.status === 0 ? `  ${result.stdout.trim()}` : "  no encontrado (según el flujo puede ser opcional)"}`;
  });
  note(rows.join("\n"), "Comprobación de herramientas");
}

async function main() {
  // Keep the original command-line interface available for scripts and advanced users.
  if (process.argv.length > 2) {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      process.stdout.write("Uso interactivo: stream-clip-maker\nUso avanzado: stream-clip-maker <chat-file> [opciones]\n\n");
      run(["--help"]);
      return;
    }
    const result = run(process.argv.slice(2));
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
    return;
  }

  intro("STREAM CLIP MAKER  ·  Twitch / YouTube");
  note("Encuentra los momentos, crea clips y prepara highlights. Los vídeos nunca se publican automáticamente.", "Bienvenido");
  while (true) {
    const action = await askSelect("¿Qué quieres hacer?", [
      { value: "analyze", label: "Analizar un chat y crear clips" },
      { value: "discover", label: "Descubrir directos y VODs de Twitch" },
      { value: "enhance", label: "Añadir subtítulos y título a un clip" },
      { value: "checks", label: "Comprobar herramientas instaladas" },
      { value: "help", label: "Ayuda y comandos avanzados" },
      { value: "exit", label: "Salir" },
    ]);
    if (action === "exit") break;
    if (action === "analyze") await analyzeChat();
    if (action === "discover") await discoverTwitch();
    if (action === "enhance") await enhanceClip();
    if (action === "checks") await toolsCheck();
    if (action === "help") note("stream-clip-maker <chat.json> --url <URL> --vertical --run\nstream-clip-maker <chat.json> --vod <ID> --top 5\nstream-clip-maker --help\n\nMás información: https://github.com/kathennn/stream-clip-maker", "Modo avanzado");
  }
  outro("¡Hasta pronto!");
}

main().catch((error) => {
  cancel(`Error: ${error.message}`);
  process.exitCode = 1;
});
