# Mindbreaker

One game. You break bricks. Pink `?` bricks stop the table and ask a question. A right answer changes the board — extra balls, a wider paddle, slow-mo, a fireball, or a chip through the wall. A wrong answer makes it meaner.

648 questions across eighteen sections, each tagged easy, medium, or hard. Early
waves ask warm-ups and the deep waves stop being polite. A run will not repeat a
question until that bank is empty, and recent questions stay out of the next run.

Answer streaks pay a multiplier that rides along on every brick you break, so a
hot run visibly snowballs. Miss one and the game shows you the right answer.

Built to play on a phone: drag to move, tap to launch. No setup screen, just Play.

## Play on your phone

**https://yonatannudman.github.io/Cursor/**

Public, permanent, and no account needed. Every push to `main` rebuilds and
redeploys it, so the link never changes and never goes stale.

A mirror that serves the same build straight from the branch, useful if Pages is
ever mid-deploy:

`https://raw.githack.com/YonatanNudman/Cursor/main/docs/index.html`

## Play locally

```bash
npm install
npm run dev
```

## Deploy on Cloudflare

CI deploys for you on every push to `main`. To deploy by hand instead:

```bash
npx wrangler login
npm run deploy
```

That builds the static game and deploys it as a Workers static-assets site,
serving `dist/` at a stable `*.workers.dev` URL.
