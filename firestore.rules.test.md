# Règles Firestore « mode test » (ouvertes)

Copiez le bloc ci-dessous dans **Firebase Console → Firestore Database → Règles** uniquement pour un environnement de démo, jusqu’au 4 décembre 2026.

**Ne pas utiliser en production.** Les règles d’isolation par utilisateur (fichier `firestore.rules`) sont celles à coller pour un usage réel.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if
          request.time < timestamp.date(2026, 12, 4);
    }
  }
}
```
