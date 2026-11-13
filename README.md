[ ![🇫🇷 Français](https://img.shields.io/badge/%F0%9F%87%AB%F0%9F%87%B7-Fran%C3%A7ais-blue) ](README.fr.md)

<img width="96" height="96" src="assets/icon.svg" align="right" alt="" />

# YouTube Auto Like

Likes the YouTube videos you choose, automatically: the channels you subscribe to, every channel, or only your own list, as soon as a video opens or after a while.

[![Latest release](https://img.shields.io/github/v/release/NitramO-YT/youtube-auto-like)](https://github.com/NitramO-YT/youtube-auto-like/releases/latest)
[![Release date](https://img.shields.io/github/release-date/NitramO-YT/youtube-auto-like)](https://github.com/NitramO-YT/youtube-auto-like/releases/latest)
[![License](https://img.shields.io/github/license/NitramO-YT/youtube-auto-like)](LICENSE)

> [!NOTE]
> This is the maintained continuation of [austencm/youtube-auto-like](https://github.com/austencm/youtube-auto-like), for Chromium-based browsers (Brave, Chrome, Edge…) and Firefox. It is not run by its original author: see [About this fork](#about-this-fork).

## What it does

- **Likes what you choose:** the channels you subscribe to, every channel, or only your “Always like” list; videos, Shorts, or both.
- **When you choose:** as soon as the video opens, after a share of the video or a number of minutes, or at a random moment. Ads are not counted.
- **Never against you:** a video you liked or disliked yourself is never touched, and in doubt the extension does nothing and says why.
- **Two lists:** “Always like” and “Never like”, which always wins. Add a channel from the toolbar popup on one of its videos or on its page, from the history of likes, or by pasting links and @handles.
- **Videos made by several channels:** they follow the channel that publishes them, and your lists can count for the guest channels too.
- **This video only, or never:** skip a video this time, or exclude it for good.
- **Shows what it does:** the toolbar popup tells what happens to the video you watch and why, with the actions that change it.
- **History:** the last 500 likes the extension made, each with a link to its video and its channel, and a choice to always or never like that channel.
- **Your lists, yours:** export them as a file or a list of links, import them back with a preview of what changes. The file can also hold all your settings and the history of likes, to find everything again in another browser or after a new installation.
- **Light and dark themes, 28 languages:** the browser's, or the one you pick in the settings. Only English and French have been reviewed by native speakers so far: corrections are welcome (see [Contributing](#contributing)).

## About this fork

[YouTube Auto Like](https://github.com/austencm/youtube-auto-like) was created by Austen Morgan in 2016. Its last release, `v2.8.1`, dates from December 2023, and it has not been maintained since. [Taknok](https://github.com/Taknok/youtube-auto-like) has kept a fork alive for Firefox since 2017, which does not run in Chromium-based browsers.

This fork brings it back for Chromium-based browsers, rewritten for Manifest V3, with a new interface, and builds the same code for Firefox too. It builds on the knowledge of both projects, and credits them: the structure and the update alert of the original, the reading of YouTube's pages and the rules of Taknok's fork.

Versions continue the original numbering: `3.0.0` is the first version of this fork.

## Where can I get it?

Two channels, each with a link that never changes:

| Channel | What it is | Link |
| --- | --- | --- |
| **Latest** | The most recent version. | [Latest release](https://github.com/NitramO-YT/youtube-auto-like/releases/latest) |
| **Beta** | The next version, to try it before everyone else. | [Beta release](https://github.com/NitramO-YT/youtube-auto-like/releases/tag/beta) (none published yet) |

Each release provides:

- `youtube-auto-like.crx`, the signed package for Chromium-based browsers: the simplest to install and to update;
- `youtube-auto-like-chromium.zip`, the same extension to load unpacked, from a folder you keep;
- `youtube-auto-like.xpi`, for Firefox 140 or later: the package Mozilla signed for its add-ons site.

Each package comes with a `.sha256` checksum file. The files of the latest release are always at
`https://github.com/NitramO-YT/youtube-auto-like/releases/latest/download/<file>`, for example
`https://github.com/NitramO-YT/youtube-auto-like/releases/latest/download/youtube-auto-like.crx`.

### Installing in Firefox

Install it from [its page on Mozilla's add-ons site](https://addons.mozilla.org/firefox/addon/youtube-auto-like-nitramo/): click **Add to Firefox**, then **Add** once Firefox shows its permission (access to `www.youtube.com`).

The `youtube-auto-like.xpi` file of a release is the same package. To install it, click it in Firefox, let Firefox continue past the notice that it prevented the site from installing software, then click **Add**.

Taknok's fork, one of the two projects this one builds on (see [About this fork](#about-this-fork)), keeps its own page on Mozilla's site under the same name, [YouTube Auto Like](https://addons.mozilla.org/firefox/addon/youtube_auto_like/): the link above is the one for this extension.

### Installing the CRX (Chrome, Brave, Edge…)

1. Download `youtube-auto-like.crx`.
2. Open `chrome://extensions` (`brave://extensions` in Brave, `edge://extensions` in Edge).
3. Turn on the **Developer mode**. Without it, the browser refuses a package that does not come from its store, with the error `CRX_REQUIRED_PROOF_MISSING`.
4. Drag the file onto the extensions page, then confirm.

Checked in Chrome and Brave on Linux.

### Installing the zip

1. Download `youtube-auto-like-chromium.zip` and unzip it into a folder you will keep (the browser loads the extension from there).
2. Open `chrome://extensions` (`brave://extensions` in Brave, `edge://extensions` in Edge).
3. Turn on the **Developer mode**.
4. Click **Load unpacked** and choose the unzipped folder.

### Updating

The extension checks for a new version on GitHub, every 30 minutes by default (settings, under More). When one is out, its icon shows a badge, and the popup links to it.

To update the CRX, drag the new one onto the extensions page, as for the installation. To update an unpacked extension, replace the content of its folder with the new zip, then click the reload button of the extension in the extensions page. Either way, your settings and lists are kept: the extension keeps the same ID from one version to the next.

Firefox updates the extension by itself from Mozilla's add-ons site, with nothing to download or to do, once a day by default, keeping your settings and lists. To get a new version at once, open `about:addons` and check for updates in the gear menu. A new version asking for one more permission would wait for your approval instead. Versions 3.0.0 and 3.1.0, installed from GitHub, reach the first version listed on Mozilla's site the same way, through the `updates.json` file of the latest release, then update from Mozilla's site.

### Checking a download

Put the `.sha256` file next to the downloaded file, then run:

```sh
sha256sum -c youtube-auto-like-chromium.zip.sha256
```

## Privacy

Everything the extension keeps stays in your browser: your settings, your lists, the history of the likes it made, and, only while the debug mode is on, its journal. Nothing is sent to the author, and there is no tracking.

Besides the YouTube pages you open, the extension connects to these places only:

- **GitHub** (`api.github.com`), to check for a new version, at the frequency you choose, or never. GitHub sees your IP address.
- **YouTube**, only when you add channels by link or import a list of links, to find which channel each link is, and when the settings page opens with a channel saved without its picture, to find that picture. These requests carry your YouTube cookies, as opening the page would.
- **YouTube's image servers** (`yt3.ggpht.com`, `yt3.googleusercontent.com`, `yt4.ggpht.com`), for the pictures of the channels in the popup, the lists and the history, as YouTube's pages load them.

In Firefox, Firefox itself, not the extension, also checks Mozilla's add-ons site for new versions, as for every extension it installs from there.

### Permissions

| Permission | Why |
| --- | --- |
| Access to `www.youtube.com` | Read the video you watch, click its like button, and find a channel from a link. |
| `storage` | Keep your settings, lists and history in the browser. |
| `alarms` | Check for a new version at the frequency you chose. |
| `scripting` | Start on the YouTube tabs already open when the extension is installed or updated, without reloading them. |

## I have a problem

Open the settings of the extension, then **About › Report a problem**. It opens an issue already holding the version, the browser and the settings. To include what the extension did, turn the **debug mode** on (settings, under More), do again what goes wrong, then report.

For a security vulnerability, follow the [security policy](SECURITY.md) instead.

This applies to the Firefox version of this project too. [Taknok's fork](https://github.com/Taknok/youtube-auto-like), which this project builds on and which Taknok keeps maintaining, has its own issues for its own extension.

## Supporting the project

The extension is free, and stays so. If it is useful to you, you can support its development on [Ko-fi](https://ko-fi.com/NitramO).

The projects it comes from can be supported too: Austen Morgan, who created it, on [Buy Me a Coffee](https://www.buymeacoffee.com/austen), and Taknok, who has kept it alive for Firefox since 2017, through [PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=F8J6T6WHJBRAA).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): how to build, test and try the extension, how the code is organized, and how to help with translations.

## License

[MIT](LICENSE). Copyright (c) 2016 Austen Morgan, Copyright (c) 2026 Martin (NitramO).
