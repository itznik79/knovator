# knovator client

Simple Next.js admin UI to view import history from the server.

Run locally:

```bash
cd client
npm install
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev
```

The UI calls `/api/imports` which proxies to the backend API defined by `NEXT_PUBLIC_API_URL`.
