# 🚀 SilwerWolf999 Launcher

# Support REL/BETA

![alt text](image.png)



A lightweight and modern launcher for Anime game — designed to make launching, updating, and customizing your game easy and efficient.


---

## 🧑‍💻 About the Developer

Hi! I'm **Horoyoi-san**, a developer passionate about building simple and powerful tools.  
SilwerWolf999 Launcher is built with:

- ⚙️ **Go + Wails** for backend/frontend integration  
- 🎨 **Tailwind CSS** + **DaisyUI** for a clean, responsive UI

My goal is to create tools that are fast, efficient, and enjoyable to use.

---

## 📦 Installation

You can choose between:

- ✅ **Portable** version (no install needed)
- 🛠️ **MSI Installer** (for full integration)
1. [go 1.24.0](https://go.dev/dl/go1.24.0.windows-amd64.msi)
2. wails3
```
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-alpha.34
```
3. [Node.js](https://nodejs.org/en/download/current)
    - เปิด Command Prompt / PowerShell ใหม่ แล้วพิมพ์:
```
node -v
npm -v
```
---

## 🛠️ Common Development Commands (Wails v3)

```bash
# Start the app in development mode (hot reload frontend)
wails3 dev

# Build the application (production binary)
wails3 build

# Package the app (NSIS)
wails3 package
```
---

## Automatic launcher updates

The `Build SilwerWolf999 Launcher` workflow in `horoyoi-san/Hoyo` builds the
Windows launcher and overwrites these assets on its existing
`Sophon.Downloader` release:

- `SilwerWolf999-launcher.exe`
- `latest.json` (version and SHA-256 checksum)

The version is generated from the latest manifest; no versioned release or tag
is created. The sequence starts at `1.0.1` and rolls over as
`1.0.9` → `1.1.0` → `1.1.1` → `1.1.9` → `1.2.0` → … → `1.9.9` → `2.0.0`.
`latest.json` contains the current version and checksum, and the launcher
verifies that checksum before applying an update.

The workflow needs to read the existing manifest (or use `1.0.0` if none exists),
pass the generated version as `BUILD_VERSION` while building this source, create
`latest.json` with the executable's SHA-256, and publish both files. Its existing
`contents: write` permission is sufficient; no extra token is needed.

---

## 📄 License

MIT License — feel free to use and contribute.

---
