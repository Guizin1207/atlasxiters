# Architecture rules

- KeyProvider handles key revocation centrally and clears local Auth sessions on revalidation, so every active device loses panel access without relying on push permission.
- A database trigger emits targeted revocation push events through notify-admin; the handler checks the server-created notice and current key state so every revocation path shares the same notification logic.
- Account controls validate the administrator on the server and revoke keys before deletion; account unblocking restores only keys revoked by that block so prior revocations stay effective.
- Function history records settings transitions through a database trigger and stores the account at event time; only password-validated admin RPCs expose it, so shared universal-key activity is not attributed to an individual client.
- Admin account and catalog tools remain separate components and reuse validated RPCs; catalog edits require explicit proposal confirmation without an AI call.