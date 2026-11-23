# Architecture rules

- KeyProvider handles key revocation centrally and clears local Auth sessions on revalidation, so every active device loses panel access without relying on push permission.
- A database trigger emits targeted revocation push events through notify-admin; the handler checks the server-created notice and current key state so every revocation path shares the same notification logic.