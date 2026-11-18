# PWA

Used instead of a native app stack. Goal: installable, fast app shell, safe updates — never stale or leaked personal data.

## Manifest

- `name`, `short_name`, `start_url`, `scope`, `display: standalone`, `theme_color`, `background_color`, icons (192, 512, maskable, apple-touch). Generate icons from one SVG (`@vite-pwa/assets-generator`) and keep the command in `package.json`.
- iOS: `apple-touch-icon`, `apple-mobile-web-app-*` meta; no install prompt API — show a short "홈 화면에 추가" hint instead.

## Service worker caching

- Precache the app shell (HTML, JS, CSS, fonts, icons) only.
- **Never cache `/api` responses** (personal data; a shared device would show the previous user's data). `NetworkOnly` for `/api/*`.
- Fonts and images: cache on use (`CacheFirst` with expiry).
- Register the service worker in production builds only; dev and tests use the MSW worker at the same scope.
- Updates: don't auto-reload (unsaved input is lost). Show a "새 버전이 있습니다 [새로고침]" prompt (`registerType: 'prompt'`, `onNeedRefresh`).
- Serve `sw.js` with `Cache-Control: no-cache` so updates reach installed apps.

## Back button (Android)

In standalone mode the Android back button walks browser history; at the first entry it closes the app. A native-style exit popup ("뒤로가기를 한 번 더 누르면 종료됩니다") on home **and every bottom-nav tab screen** **is possible**, but the web has no "app exit" event: the app catches **one** back press on an exit screen, and if the user wants to leave, the next back press closes it.

Researched 2026-11 (checked on desktop Chromium; Android device check still pending — confirm on a device before relying on it):

| Approach | Use |
|---|---|
| **CloseWatcher**, one instance while an exit screen is shown | **first choice** (Chrome 120+). Android back closes the watcher before touching history, so it does not interfere with the router |
| History guard entry (push the same URL once above the root, catch `popstate`) | fallback when `CloseWatcher` is missing. Push only **after a user activation** (click/keydown) — Chrome's history-manipulation intervention skips entries added without one, and the app then just closes |
| Navigation API `navigate` + `preventDefault()` | not for exit (leaving from the first entry fires no event); fine for "discard unsaved changes?" inside the app |
| `beforeunload` | does not fire when back closes the app |
| `window.close()` | unreliable in installed PWAs — don't design around it |
| TWA (Bubblewrap) | Chrome still handles back; no gain for this. Full native control needs a WebView wrapper (Capacitor) — against the reason for choosing a PWA |
| iOS home-screen app | no back button; no exit prompt. Provide an in-app back button instead |

Rules:

- Enable only for Android + standalone: `/Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches`. In a normal browser tab it would trap users leaving the site.
- **Exit screens are a list, not just home**: every bottom-navigation tab root, plus any screen the product names (e.g. a post-checkout "완료" screen). Keep it in one constant (`EXIT_ROUTES`) and pass `atRoot = EXIT_ROUTES.includes(pathname)`. Sub-screens (lists → detail, forms) keep normal back.
- **Bottom-nav switches use `replace`** (tab → tab, and home → tab). History then stays one entry deep at any tab root, so back from any tab shows the exit prompt just like home, instead of walking back through visited tabs. Opening a sub-screen from a tab is a normal push, so back from it returns to that tab.
- **Prompt shape**: back → an exit popup "뒤로가기를 한 번 더 누르면 종료됩니다" with [취소]. While it is shown the watcher stays gone, so the next back closes the app; [취소] or a timeout (~2–3 s for a toast, none for a popup) re-creates the watcher. Use a plain overlay element for this popup, not `<dialog>.showModal()` — an open modal dialog is closed by back first (same close-request mechanism), which would turn the second back into "close the popup".
- An "앱을 종료할까요? [취소][종료]" dialog is possible, but [종료] cannot reliably close the app (`window.close()` is unconfirmed in installed PWAs): try it, and if the app is still open after ~300 ms, switch the popup to the "한 번 더 누르면 종료" text. Prefer the first shape.
- Leaving an exit screen → `destroy()` the watcher.
- Deep links (a detail page opened first): insert the home route underneath on the first activation so back reaches home before exiting (guard approach only).

Hook (router-independent; pass whether the current route is an exit screen). `onFirstBack` gets a `rearm` function: the popup's [취소] calls it. With `autoRearmMs` (toast) it also re-arms by itself; `null` (popup) waits for [취소].

```tsx
import { useEffect, useRef } from 'react';

export const EXIT_ROUTES = ['/', '/search', '/orders', '/my']; // bottom-nav tab roots + named screens

const isAndroidStandalone = () =>
  /Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches;

export function useExitGuard(
  atExitScreen: boolean,
  onFirstBack: (rearm: () => void) => void, // show the popup / toast
  autoRearmMs: number | null = null,        // 2000 for a toast, null for a popup with [취소]
) {
  const onFirstBackRef = useRef(onFirstBack);
  onFirstBackRef.current = onFirstBack;

  useEffect(() => {
    if (!atExitScreen || !isAndroidStandalone() || !('CloseWatcher' in window)) return;
    let watcher: CloseWatcher | null = null;
    let timer: number | undefined;
    let disposed = false;
    const arm = () => {
      if (disposed || watcher) return;
      clearTimeout(timer);
      watcher = new CloseWatcher();
      watcher.onclose = () => {
        watcher = null; // no watcher now → the next back closes the app
        onFirstBackRef.current(arm);
        if (autoRearmMs != null) timer = window.setTimeout(arm, autoRearmMs);
      };
    };
    arm();
    return () => { disposed = true; clearTimeout(timer); watcher?.destroy(); };
  }, [atExitScreen, autoRearmMs]);
}
```

The popup component: `role="alertdialog"` overlay (not `<dialog>`), text "뒤로가기를 한 번 더 누르면 종료됩니다", [취소] → hide and `rearm()`. Hide it too when the route changes. Moving between two exit screens keeps the same watcher (the effect only re-runs when `atExitScreen` changes).

- TanStack Router: call it in `__root.tsx` with `useRouterState({ select: (s) => EXIT_ROUTES.includes(s.location.pathname) })`; bottom-nav links use `<Link to=… replace>`. If the guard fallback is needed, push via `router.history.push(href, { exitGuard: true })`, not `window.history.pushState` — the router keys entries by its own state index. `useBlocker` cannot catch leaving from the first entry.
- Next.js App Router: a `'use client'` component in the root `layout.tsx` with `EXIT_ROUTES.includes(usePathname())`; bottom-nav links use `<Link href=… replace>`. Use CloseWatcher; the guard fallback needs Next.js ≥ 14.1 (native `pushState` integration) and `window.history.pushState(null, '', location.href)` rather than `router.push` (which refetches RSC).
- Add a `CloseWatcher` type declaration if `lib.dom` lacks it.
- Device check (still to do on a real Android device): install over `chrome://inspect` port forwarding to `localhost`, then test on each exit screen: back right after launch → popup; second back → app closes; [취소] → back shows the popup again; tab A → tab B → back → popup (not tab A); tab → sub-screen → back → that tab. Whether a re-created watcher catches back without a new user activation is the main open question.

## Checks

- Lighthouse PWA/installability in Chrome DevTools; Application tab → Service Workers / Cache Storage shows no `/api` entries.
- Test an update: deploy twice, the prompt appears, reload keeps you on the same route.
