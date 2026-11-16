# Stream Clip Maker — flujo Android / Termux

## 1. Buscar una temática

Desde la copia del repositorio en Termux:

```bash
./discover-twitch.sh "GTA 6"
```

La búsqueda guarda `discovery.json` con directos y VODs archivados de los canales encontrados, además de idioma, título, fecha, duración y enlaces. Solo los logins añadidos expresamente a `allowedCreators` en `rules.json` se marcan como autorizados.

## 2. Crear clips candidatos de un VOD autorizado

```bash
./make-clips.sh "https://www.twitch.tv/videos/ID_DEL_VOD"
```

Descarga el chat, detecta picos de reacción, crea hasta tres clips verticales, genera subtítulos en español y título incrustado, y comprueba que los finales sean 1080×1920 y duren como máximo 180 segundos.

Los archivos finales se guardan en la carpeta de clips del VOD y se copian a Descargas. `moments.json` contiene tiempos y puntuaciones.

## 3. Revisar y publicar un clip

Solo se publica el archivo `*_final.mp4`, nunca el original ni el clip intermedio:

```bash
./publish-short.sh "clips_ID/clip_final.mp4" "Título #Shorts" "Descripción" "shorts,twitch,gaming"
```

La subida queda en privado. El script comprueba resolución y duración antes de invocar el uploader.

Para probar las validaciones sin subir:

```bash
DRY_RUN=1 ./publish-short.sh "ruta/al_final.mp4" "Título" "Descripción" "shorts"
```

## Seguridad y privacidad

- No publiques ni compartas `.env`, `client_secrets.json` o `youtube-token.json`.
- Los uploads se crean como privados.
- El uploader rechaza archivos que no terminen en `_final.mp4` o no sean 1080×1920 de hasta 180 segundos.
- La detección de canales no concede derechos de reutilización. Revisa permisos y condiciones del creador y de cada plataforma.
- Revisa el clip y sus metadatos antes de subirlos.
