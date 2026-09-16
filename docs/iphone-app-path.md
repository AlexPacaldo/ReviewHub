# Hachi iPhone App Path

Hachi stays website-first. The production web app remains the source of truth, and a future iPhone app should wrap the same React/Vite build with Capacitor instead of forking the app.

## Current Native-Ready State

- The app builds to `dist`, which is the Capacitor `webDir`.
- `capacitor.config.json` is prepared with the Hachi app name and bundle id placeholder.
- Auth redirect can be overridden with `VITE_AUTH_REDIRECT_URL`.
- Offline app behavior is already implemented through local storage, service worker cache, and a sync queue.
- Privacy and Terms pages already describe AI generation, local storage, cloud data, sharing, and diagnostics.

## Later iOS Setup

Run this only when you are ready to create the native iOS project:

```bash
npm run ios:add
npm run ios:sync
npm run ios:open
```

After Xcode opens:

- Set the Apple developer team.
- Replace the placeholder bundle id if needed.
- Add real app icons and launch images.
- Test Google sign-in, cloud sync, file upload, and offline mode on a real iPhone.

## Auth Setup For iOS

For the website, keep:

```env
VITE_AUTH_REDIRECT_URL=https://hachi-review.vercel.app
```

For a native app later, create a URL scheme such as:

```env
VITE_AUTH_REDIRECT_URL=app.hachi.review://auth/callback
```

Then add that callback to:

- Supabase Authentication URL configuration
- Google OAuth authorized redirect/client settings
- The native iOS URL scheme in Xcode or Capacitor config

## Native Storage And Files

Keep browser storage for the website. When the iPhone app is created, replace only the device-specific storage/file edges:

- Use Capacitor Preferences for small settings and sync queue metadata.
- Use Capacitor Filesystem for larger reviewer backups and imported files.
- Keep Supabase as the cloud source for signed-in users.
- Keep the existing local/offline reviewer behavior as the app-level contract.

## App Store Readiness

Before App Store submission:

- Use the Hachi name, icon, and screenshots consistently.
- Confirm the Privacy Policy and Terms URLs are public.
- Disclose AI-generated study content and uploaded study material handling.
- Confirm Google OAuth consent branding matches the app name and domain.
- Test account deletion/data deletion flows.
- Test offline launch, offline quiz use, queued sync, and cloud sync recovery.
