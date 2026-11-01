# MD Fit desktop app (Tauri)

A native Mac / Windows / Linux app that opens MD Fit in its own locked-down window, using the same Tauri approach as `omniverse-core/desktop`.

## Security model
- **No native access.** The site gets no Tauri plugins, commands or capabilities: no files, shell, clipboard, processes or OS APIs. Even a compromised page couldn't touch the computer.
- **Pinned navigation.** The window may only show `https://mdfit-srq.vercel.app` and Stripe's hosted checkout and billing pages. Anything else is refused: other sites, look-alike domains, plain `http`, `file://`. This is unit-tested in `src-tauri/src/main.rs`.
- **Encrypted end to end.** HTTPS with HSTS. The API behind the site only answers through MD Fit's edge guard (US only, bots blocked), and all stored data is encrypted at rest.
- **Small, hardened build.** Release builds are LTO-optimized and stripped, and `freezePrototype` is on.

## Build it (on the computer you want the app for)
1. Install Rust (https://rustup.rs) and Node 20+.
   - Mac: also run `xcode-select --install`.
   - Windows: also install WebView2 (already on Windows 11) and the Visual Studio C++ build tools.
2. From this `desktop` folder:
   ```bash
   npm install
   npm run icons    # generates .icns / .ico from the MD Fit icon
   npm run build    # installers land in src-tauri/target/release/bundle/
   ```
3. To try it without installing: `npm run dev`

To share it with patients, sign the build: Apple Developer ID on Mac, a code-signing certificate on Windows. Otherwise the operating system shows an "unidentified developer" warning.
