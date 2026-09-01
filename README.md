# Mindbreaker

One game. Hold anywhere to aim, release to fire. The shot leaves faster than a
tap ever would. Once the ball is loose, drag to move the paddle and keep it
alive.

Pink `?` bricks stop the table and ask a question. A right answer changes the
board: extra balls, a wider paddle, slow-mo, a fireball, or a chip through the
wall. A wrong answer makes it meaner, and shows you the answer you missed.

Four levels, picked on the pause panel or after a loss, never before you play.
Chill hands a ball back each wave. Normal gives you three and no handouts. Hard
gives two and a faster table. Brutal gives one.

648 questions across eighteen sections, each tagged easy, medium, or hard. Early
waves ask warm-ups and the deep waves stop being polite. A run will not repeat a
question until that bank is empty, and recent questions stay out of the next run.

Answer streaks pay a multiplier that rides along on every brick you break, so a
hot run visibly snowballs.

Built for a phone, and it opens straight into a live board. There is no menu.

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
