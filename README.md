# Mindbreaker

One game. You break bricks. Pink `?` bricks stop the table and ask a question. A right answer changes the board — extra balls, a wider paddle, slow-mo, a fireball, or a chip through the wall. A wrong answer makes it meaner.

Hundreds of questions across eighteen sections. A run will not repeat a question until that bank is empty. Recent questions stay out of the next run too.

Built to play on a phone: drag to aim, tap to launch.

## Play on your phone

Open this on your phone. It stays up:

**https://rawcdn.githack.com/YonatanNudman/Cursor/7b99692f504bea4c0e43295802ef588f234aaf9c/docs/index.html**

Pretty URL after one GitHub toggle: **https://yonatannudman.github.io/Cursor/**  
Repo **Settings → Pages → Source: GitHub Actions**, then the deploy workflow publishes it.

## Play locally

```bash
npm install
npm run dev
```

## Deploy on Cloudflare

```bash
npm run deploy
```

That builds the static game and deploys it as a Workers static-assets site. After `wrangler login`, you get a stable `*.workers.dev` URL. The GitHub Pages link above stays up without that login.
