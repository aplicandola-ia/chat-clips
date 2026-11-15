# chat-clips

Encuentra los momentos buenos de un directo leyendo su chat: cuando mucha gente distinta reacciona a la vez, algo ha pasado en pantalla. Es un solo archivo y no tiene dependencias (Node.js 18 o superior). Para cortar los clips necesitas además `ffmpeg` y, según la plataforma, `yt-dlp` (YouTube) o `TwitchDownloaderCLI` (Twitch).

De [Aplicando La IA](https://aplicandolaia.com) · guía paso a paso: [aplicandolaia.com/recursos/clips-gta6](https://aplicandolaia.com/recursos/clips-gta6#chat-clips) · English: [README.md](README.md)

## Uso

```bash
# 1. Descarga el chat
yt-dlp --skip-download --write-subs --sub-langs live_chat -o directo "<enlace-de-youtube>"   # -> directo.live_chat.json
TwitchDownloaderCLI chatdownload --id <id-del-vod> -o chat.json                               # Twitch

# 2. Busca los momentos y enseña los comandos para cortarlos
node chat-clips.mjs directo.live_chat.json --url "<enlace-de-youtube>" --vertical

# 3. Lo mismo, pero descargando y cortando todo (un comando)
node chat-clips.mjs directo.live_chat.json --url "<enlace-de-youtube>" --vertical --run --out clips
node chat-clips.mjs chat.json --vod <id-del-vod> --vertical --run --out clips
node chat-clips.mjs chat.json --video mi-grabacion.mp4 --vertical --run   # tu propia grabación
```

`node chat-clips.mjs --help` enseña todas las opciones.

## Cómo puntúa

- Ventanas de 10 segundos. Puntuación = personas distintas escribiendo × (1 + 2 × la parte de ellas que reacciona).
- Cuentan como reacción `jaja`, `xd`, `kekw`, `lmao`, `nooo`, `wtf`, `qué pasó`, `clip`, `pog`, `F` y emojis como 😂 🤣 💀 😱 (lista `REACTION` en el código).
- Si en una ventana domina un mensaje que no es reacción (encuestas tipo «100» o «sí»), su puntuación se multiplica por 0,4.
- Cada ventana se compara con la mediana de los 5 minutos anteriores (nunca por debajo de la mediana del directo). Es un pico si llega a 2,5 veces esa cifra y reaccionan al menos 5 personas.
- Se saltan los 3 primeros minutos del chat (saludos). Los picos cercanos se juntan en un clip de hasta 90 s.
- Clip = 20 s antes del pico (el chat reacciona tarde) hasta 15 s después.
- `--simple` cuenta solo mensajes, sin ponderar por personas ni reacciones.

## Directos largos de Twitch

No hace falta descargar todo el chat: `TwitchDownloaderCLI chatdownload --id <id-del-vod> -b 2:00:00 -e 3:30:00 -o chat.json` baja solo ese tramo, y chat-clips lo analiza desde su primer mensaje.

## Ajustes útiles

- Salen demasiados momentos: sube `--ratio` (por ejemplo 3,5) o `--min`.
- Salen muy pocos: baja `--ratio` (por ejemplo 2) o `--min`.
- El clip empieza tarde o pronto: cambia `--lead` (segundos antes del pico).

## Antes de subir un clip

Solo clipea a creadores que lo permiten y respeta sus reglas y las de cada plataforma.

Ojo: el chat también reacciona a lo que dice el streamer, no solo al juego. Revisa cada clip antes de subirlo.

## Licencia

MIT (ver LICENSE): puedes usarla, cambiarla y compartirla, también en proyectos comerciales, manteniendo el aviso de copyright.
