# Clay's Blender intro

The editable scene is `clay-intro.blend`. Open it in Blender 5.2 and press Space in the timeline to preview its 156 frames (6.5 seconds at 24 fps). The nine blocks build a rectangle, the figure knocks it apart, and the supplied Clay logo emerges.

Codex controls Blender here through its built-in Python API and command-line interface. No MCP server or add-on is required. Changes are reproducible in `../scripts/blender_intro.py`; the logo is packed into the scene.

Render from the Clay folder in PowerShell:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/blender_intro.py
```

Add `-- --preview` to render only frames 40, 80 and 135. Full PNG frames are written to ignored `.renders/clay/`.

Encode using an installed FFmpeg:

```powershell
ffmpeg -y -framerate 24 -i .renders/clay/frame_%04d.png -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart assets/clay-intro.mp4
```

The app plays the video once per browser session. It has a Skip control, bypasses the animation for reduced-motion users, and dismisses it if playback fails. The scene source is preserved for further art direction.
