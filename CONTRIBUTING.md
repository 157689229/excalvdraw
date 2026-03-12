# Contributing to Excalvdraw

Thanks for contributing.

This repository is maintained as a public fork/distribution of Excalidraw with an added browser-based recording workflow. The main contribution rule is straightforward:

Keep the original whiteboard behavior stable while improving the recording experience.

## Good contribution areas

- recording bugs
- camera/microphone/system-audio compatibility
- MP4 export reliability
- recorder UI and canvas interaction conflicts
- Chinese product copy and usability improvements
- documentation and reproducible bug reports

## Before opening a PR

Please check the following:

1. Whiteboard basics still work as expected
2. Recorder UI does not block normal canvas interaction unless that is intentional
3. Existing whiteboard controls are not silently removed
4. New behavior is documented when user-facing
5. Type checking passes

Recommended checks:

```bash
yarn test:typecheck
yarn test:code
```

## Bug reports

For recorder-related bugs, include:

- browser version
- operating system
- whether the issue happens during whiteboard-only recording or screen recording
- whether camera, microphone, or system audio were enabled
- exact reproduction steps
- expected result
- actual result

Strong reproduction reports are more valuable than vague feature requests.

## Pull requests

Small, scoped pull requests are preferred.

If your PR changes recording behavior, call out:

- what user flow changed
- what existing behavior was preserved
- what regressions you checked for

If your change intentionally diverges from upstream behavior, explain why.

## Code style

- follow the existing project structure
- avoid adding unnecessary dependencies
- prefer clear, reviewable changes over broad rewrites

## Questions

If you are unsure whether a change belongs in this fork or upstream, open an issue first and explain the use case.
