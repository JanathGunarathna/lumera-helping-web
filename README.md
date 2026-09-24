# Luméra Fragrance Lab

React + Firebase web app for managing fragrance oils and creating printable fragrance test records.

## Pages

1. **Fragrance Oils** — add oils and store them in Firestore.
2. **New Fragrance Test** — select oils, enter amounts, target volume, and test name.
3. **Test Details / Print** — clean printable test record.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Put your Firebase Web App configuration into `.env`.

### Firestore

The app uses these collections:

- `fragranceOils`
- `fragranceTests`

For a first local prototype, Firestore rules can be configured for authenticated users only. Add Firebase Authentication before deploying publicly.

## Build

```bash
npm run build
```
