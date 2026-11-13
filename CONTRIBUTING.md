# Contributing

Thanks for wanting to help. Bug reports, ideas, translations and code are all
welcome. For a bug, the quickest way is **About › Report a problem** in the
settings of the extension: it opens an issue that already holds what is needed
to understand it.

Before a large change, open an issue to talk about it first: it avoids work
that would not fit the direction of the project.

## Setting up

You need [Node.js](https://nodejs.org/) 22.2 or later (the packaging uses
`zlib.crc32`) and a Chromium-based browser (Brave, Chrome, Chromium, Edge),
or Firefox 140 or later.

```bash
npm install                        # esbuild and web-ext, pinned to exact versions
npm run build                      # builds the extension into dist/chromium/
npm run build -- --target firefox  # builds it into dist/firefox/
npm test                           # runs the tests (node:test)
npm run preview                    # screenshots of the popup and the settings, in dist/preview/
```

To try your build, open `chrome://extensions` (or `brave://extensions`), turn
on the developer mode, click **Load unpacked** and choose `dist/chromium/`.
After each `npm run build`, click the reload button of the extension.

In Firefox, open `about:debugging#/runtime/this-firefox`, click **Load
Temporary Add-on** and choose `dist/firefox/manifest.json`; it stays until
Firefox closes. `npx web-ext lint --source-dir dist/firefox` checks the build
with Mozilla's rules for an add-on listed on its site.

Both builds come from the same sources: the browser layers in
`src/manifest/` differ only in what each browser requires (a service worker
or background scripts, the key of the Chromium ID or the Gecko ID).

## How the code is organized

| Folder | What it holds |
|---|---|
| `src/core/` | The rules, as pure functions: settings, lists, when to like, import, report. No browser API, fully tested. |
| `src/content/page/` | The page reader, run in the page itself (`world: "MAIN"`): reads what only YouTube's own objects hold, never acts. |
| `src/content/isolated/` | The liker, run in the isolated world: decides with `src/core/`, clicks the like button, answers the popup. |
| `src/content/youtube/` | Everything that knows YouTube's pages: selectors and data paths. When YouTube changes, the fix is here. |
| `src/platform/` | The browser API (`browser`, or `chrome` on older Chromium) and the storage. |
| `src/background/` | The service worker: checks for a new version, injects the scripts at installation. |
| `src/ui/` | The toolbar popup and the settings page, with their shared parts. |
| `src/manifest/` | A base manifest, and one layer per browser, put together by the build. |

A few rules keep the extension reliable:

- **Data coming from a page is untrusted.** Messages between the page reader
  and the liker, files imported, answers from YouTube: each goes through a
  strict validation before use (see `src/content/protocol.js`).
- **Never like by mistake.** In doubt, the extension does nothing and says why.
  A rating the user gave is never changed.
- **Ready for Firefox.** No API specific to one browser outside
  `src/platform/`, no `wrappedJSObject`, no state kept in the service worker.
- **A test for each fix.** It must fail on the code before the fix.

## Commit messages

A title in the imperative, saying what the change does, without a type
prefix (`Show channel avatars in the history`). Add a short body only when the
reason is not obvious from the title.

## Translations

The texts are in `src/_locales/<language>/messages.json`: English (`en`) is
the reference, and every language must define the same keys (a test checks
it). Corrections to an existing language are welcome as pull requests: only
English and French have been reviewed by native speakers so far.

The 28 languages: Arabic (`ar`), Chinese (`zh_CN`, `zh_TW`), Czech (`cs`),
Danish (`da`), Dutch (`nl`), English (`en`), Filipino (`fil`), Finnish (`fi`),
French (`fr`), German (`de`), Hindi (`hi`), Hungarian (`hu`), Indonesian
(`id`), Italian (`it`), Japanese (`ja`), Korean (`ko`), Polish (`pl`),
Portuguese (`pt_BR`), Romanian (`ro`), Russian (`ru`), Slovak (`sk`), Spanish
(`es`), Swedish (`sv`), Thai (`th`), Turkish (`tr`), Ukrainian (`uk`) and
Vietnamese (`vi`).

A few rules hold for every language:

- **YouTube's own words**: the name of the like button, "Shorts", "channel"
  and "subscribed" as YouTube shows them in that language.
- **Two plural forms only**: the extension picks between the "one" and the
  "other" text. In a language with more forms, write the counted texts so that
  one form fits every number ("Channels added: 5").
- **No em dash** (a test checks it).
- **A new language** also goes in `LOCALES` in `src/core/locales.js`, with its
  name in itself and the country of its flag. A language written from right to
  left also goes in `RIGHT_TO_LEFT` in `src/ui/shared/locale.js` (a test
  compares it with the browser's data).
- **Check it on screenshots**: `npm run preview -- --locales <code>` shows the
  pages in that language; the popup must keep to its width and to 600 pixels of
  height.

## Publishing a release (maintainer)

The CRX is signed with `extension-key.pem`, which gives the extension its
fixed ID. It is never committed, and never replaced: a new key would change the
ID, and every installation would lose its settings.

The Firefox version is listed on Mozilla's add-ons site, at
[addons.mozilla.org/firefox/addon/youtube-auto-like-nitramo](https://addons.mozilla.org/firefox/addon/youtube-auto-like-nitramo/),
and submitted with the maintainer's addons.mozilla.org API keys. Mozilla
reviews and signs it; the same signed file is attached to the GitHub release.
Mozilla signs each version number only once, and receives the source code
with the build (a `git archive` of the commit): sign from a committed tree,
and only the version you publish. The text of the listing is in
`store/amo-metadata.json`, sent with each version: edit it there, not on the
site, where a change would be replaced at the next release. Its screenshots
are in `store/screenshots/`, made by `npm run store-screenshots` (it needs
ImageMagick), with their captions in `store/screenshots.json`.

1. Set the new version in `package.json` (the manifest takes it from there),
   and commit.
2. Run `npm test`, then `npm run package`. It writes into `releases/`:
   `youtube-auto-like-chromium.zip`, `youtube-auto-like.crx`, and a `.sha256` file for
   each.
3. Run `npm run sign-firefox` with the keys in `WEB_EXT_API_KEY` and
   `WEB_EXT_API_SECRET` (`-- --dry-run` checks everything without sending).
   It waits for Mozilla's approval, then writes `youtube-auto-like.xpi`, its
   `.sha256`, and `updates.json`. Versions 3.0.0 and 3.1.0, distributed from
   GitHub only, read that file to update, and it names the package at the
   address of the tag `vX.Y.Z`; later versions update from Mozilla's site.
4. Create the release on GitHub with the tag `vX.Y.Z` and the seven files.
   - **Latest:** a normal release. Its files are then also at
     `https://github.com/NitramO-YT/youtube-auto-like/releases/latest/download/<file>`,
     an address that never changes.
   - **Beta:** a pre-release with the tag `beta`, moved to the new commit and
     whose files are replaced at each beta. The extension's own check for a
     new version ignores pre-releases. For Firefox, sign a beta with
     `npm run sign-firefox -- --beta`: signed but kept off the listing, and
     without `updates.json`. It needs a version number of its own, since
     Mozilla signs each number once.
