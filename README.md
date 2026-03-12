# Excalvdraw

Excalvdraw is a public, MIT-licensed whiteboard fork built for creator recording workflows.

It keeps the core Excalidraw drawing experience intact and adds a browser-native recording layer for people who teach, sketch, and narrate directly from the canvas.

- Live app: [https://excalvdraw.vercel.app/](https://excalvdraw.vercel.app/)
- Repository: [https://github.com/157689229/excalvdraw](https://github.com/157689229/excalvdraw)
- Primary maintainer: [@157689229](https://github.com/157689229)
- Upstream project: [Excalidraw](https://github.com/excalidraw/excalidraw)
- License: [MIT](./LICENSE)

## What this project is

Excalvdraw is maintained as a creator-focused distribution of Excalidraw for browser-based teaching and recording.

The goal is simple:

1. Open the browser
2. Draw on a whiteboard
3. Record the board, face, and voice
4. Export a ready-to-edit MP4

This repository is intended for real-world use by non-technical creators, especially educators and video makers who need a whiteboard plus recording workflow without switching between multiple tools.

## Why this fork exists

Existing tools usually split the workflow:

- Excalidraw is an excellent whiteboard, but not a built-in recording tool
- Screen recording tools can capture the screen, but they do not provide a native whiteboard authoring experience
- OBS is powerful, but too complex for many first-time creators

Excalvdraw closes that gap by combining a familiar whiteboard with an in-browser recording workflow designed for fast, repeatable use.

## What Excalvdraw adds

On top of the upstream whiteboard, this project adds:

- Screen/board recording from inside the app
- Region selection for recording
- Camera overlay with drag and resize controls
- Microphone and system audio capture
- MP4 export workflow with ffmpeg fallback when needed
- Teleprompter support for speaking workflows
- Chinese-first product copy for non-technical users

## What stays compatible

This project aims to preserve the core Excalidraw whiteboard behavior:

- drawing tools
- shapes
- text
- zooming and panning
- canvas background controls
- export/import behaviors where not directly related to the recording layer

When changes are made here, a key maintenance rule is to avoid breaking the original whiteboard interaction model while improving the recording workflow.

## Maintainer scope

This repository is maintained as an active public fork/distribution.

Primary maintenance work includes:

- triaging bugs
- keeping the whiteboard behavior stable while integrating recorder features
- validating browser media API compatibility
- reviewing regressions in camera, microphone, and export flows
- maintaining deployment readiness for the live app
- documenting usage and contribution expectations

## Current focus

The current maintenance focus is on:

- recording reliability
- preserving upstream whiteboard UX
- creator-friendly controls
- Chinese localization and creator-facing copy
- regression prevention between recorder UI and canvas interaction

## Live deployment

Production deployment:

- [https://excalvdraw.vercel.app/](https://excalvdraw.vercel.app/)

If you are evaluating the project for maintenance quality or open source support, the live deployment is the fastest way to understand the intended workflow.

## Local development

Requirements:

- Node.js 18+
- Yarn 1.x

Start locally:

```bash
yarn install
yarn start
```

Run the main checks:

```bash
yarn test:typecheck
yarn test:code
```

## Contributing

Contributions are welcome, especially for:

- recording reliability
- browser compatibility
- regression fixes
- UX improvements that do not break core whiteboard behavior
- docs and reproduction cases

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Security

If you believe you found a security issue, please read [SECURITY.md](./SECURITY.md) before reporting it publicly.

## Relationship to Excalidraw

Excalvdraw is built on top of the open-source Excalidraw codebase and would not exist without the upstream project and community.

This repository is not the upstream Excalidraw repository. It is a separate public fork/distribution with its own product direction, maintenance scope, and deployment.

## License and attribution

This repository is released under the [MIT License](./LICENSE).

The project includes and extends code from [Excalidraw](https://github.com/excalidraw/excalidraw), which is also MIT-licensed.
