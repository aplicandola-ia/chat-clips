# Linux WebKitGTK font fallback

Some Linux systems can start the Tauri window with a black/empty surface when WebKitGTK cannot resolve its generic fonts through Fontconfig.

The desktop bootstrap sets `FONTCONFIG_FILE` **before Tauri creates the first webview**. It points to the bundled `fonts.conf`, which includes the distribution's normal configuration, explicitly scans common system font directories, and prefers DejaVu Sans for generic sans-serif text.

The config is intentionally small and does not replace the system font database. DejaVu Sans is a widely packaged fallback on Debian/Ubuntu and many other Linux distributions.

To verify the same resolution on a Linux build machine:

```sh
FONTCONFIG_FILE=src-tauri/resources/fontconfig/fonts.conf fc-match sans-serif
```

Expected family: `DejaVu Sans`.

If a distribution stores its packaged app resources in a non-standard location, set `STREAM_CLIP_FONTCONFIG_FILE` to the absolute path of the bundled `fonts.conf` before launching the app.
