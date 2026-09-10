# Mindbreaker

One hybrid: brick-breaker plus trivia, built for a phone.

Pick a table before you play. **Cannon** aims once and empties a magazine of
10, 20, 30, or 50 balls. When the volley is done the surviving wall drops a row.
If bricks reach the floor, the run is over. Mid-volley speed goes 1× to 5×.
When the last `?` brick is gone, one fast pierce ball burns the leftover
numbers so the next wave's questions do not wait.
**Paddle** is the older fight: hold to aim, release to fire, then drag the bar
and keep the ball alive.

Pink `?` bricks stop the table and ask a question. A right answer changes the
board: extra balls, a wider paddle, slow-mo, a fireball, or a chip through the
wall. A wrong answer makes it meaner, and shows you the answer you missed.
Harder questions pay more and unlock louder rewards. Pair them with Hard or
Brutal and the numbered bricks grow extra hit points.

Four table levels. Chill hands a ball back each cleared wave. Normal gives you
three and no handouts. Hard starts with a thicker wall. Brutal is one life, fat
HP, and extra rows from the first wave.

Pick categories and a question floor, or leave both on auto. The bank will not
repeat an id until it is empty, and recent questions stay out of the next run.

Answer streaks pay a multiplier that rides along on every brick you break, so a
hot run visibly snowballs.

## Play on your phone

**https://yonatannudman.github.io/Cursor/**

Public, permanent, and no account needed. Pushes to `main` or this ship branch
rebuild and redeploy it, so the link never changes.

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
