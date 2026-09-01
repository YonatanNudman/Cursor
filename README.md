# Mindbreaker

One game. You break bricks. Pink `?` bricks stop the table and ask a question. A right answer changes the board — extra balls, a wider paddle, slow-mo, a fireball, or a chip through the wall. A wrong answer makes it meaner.

648 questions across eighteen sections, each tagged easy, medium, or hard. Early
waves ask warm-ups and the deep waves stop being polite. A run will not repeat a
question until that bank is empty, and recent questions stay out of the next run.

Answer streaks pay a multiplier that rides along on every brick you break, so a
hot run visibly snowballs. Miss one and the game shows you the right answer.

Built to play on a phone: drag to move, tap to launch. No setup screen, just Play.

## Play on your phone

### Share this now, no account needed

**https://raw.githack.com/YonatanNudman/Cursor/main/docs/index.html**

This repository is public, so that link serves `docs/` straight from the `main`
branch to anyone, with no sign-in. It follows the branch rather than a pinned
commit, so pushing a new build to `main` updates it.

### The permanent link, one switch away

Pages is not enabled yet, and only a repository admin can turn it on the first
time. The Actions token is not allowed to, which is why the Pages workflow stops
at `Create Pages site failed: Resource not accessible by integration`.

To finish it, in this repository go to **Settings, then Pages**, and set
**Source** to **GitHub Actions**. Do not pick "Deploy from a branch", the
workflow handles it.

That is the whole setup. The next push to `main` publishes to:

**https://yonatannudman.github.io/Cursor/**

which is permanent, public, needs no account, and rebuilds itself on every push
from then on. To publish immediately after flipping the switch, run the **Pages**
workflow from the Actions tab.

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
