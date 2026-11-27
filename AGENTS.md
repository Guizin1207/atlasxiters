# Architecture rules

- App appearance lives in app_config behind an admin-validated RPC; a shared provider applies holiday CSS tokens and rasterized small logos across headers without AI generation or new storage dependencies.

- KeyProvider handles key revocation centrally and clears local Auth sessions on revalidation, so every active device loses panel access without relying on push permission.
- A database trigger emits targeted revocation push events through notify-admin; the handler checks the server-created notice and current key state so every revocation path shares the same notification logic.
- Account controls validate the administrator on the server and revoke keys before deletion; a key trigger enforces account blocks on newly assigned keys, and unblocking restores only keys revoked by that block so independent revocations stay effective.
- Function history records settings transitions through a database trigger and stores the account at event time; only password-validated admin RPCs expose it, so shared universal-key activity is not attributed to an individual client.
- Admin account and catalog tools remain separate components and reuse validated RPCs; catalog edits require explicit proposal confirmation without an AI call.
- Foreground support notices reuse the key-validated support history RPC, remember the latest seen message per key on the device, and open the existing panel chat without changing push delivery.