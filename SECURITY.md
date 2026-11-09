# Security policy

YouTube Auto Like runs in your browser, on YouTube pages, with access to the
storage of the extension. A vulnerability in it could let a page or another
extension act through it, or read what it keeps: your lists of channels, the
history of its likes and, when the debug mode is on, its journal.

## How to report a vulnerability

Report it through
[private vulnerability reporting](https://github.com/NitramO-YT/youtube-auto-like/security/advisories/new),
which keeps the report hidden until a fix is published. Describe what an
attacker could do, and how: the steps, the page or the message involved, and
the version of the extension and of the browser.

**Please do not report security vulnerabilities through public issues,
discussions or pull requests.** A public report tells everyone how to exploit
the problem before anyone can install a fix.

This project grew from
[austencm/youtube-auto-like](https://github.com/austencm/youtube-auto-like),
which is no longer maintained, like the Firefox extension
[Taknok/youtube-auto-like](https://github.com/Taknok/youtube-auto-like), a fork
of the same project. A problem found in the code of this repository is
reported here; one found only in the Firefox extension belongs to Taknok's
repository.

## What to expect

This is a small project maintained on personal time, so an answer may take a
few days. You will be told what was understood of the report, whether it is
considered a vulnerability, and when a fixed version is published.

## Supported versions

Only the latest release receives fixes. The extension tells you when a newer
version is out (settings, under More), so that you can update.
