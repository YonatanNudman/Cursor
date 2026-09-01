# Mindbreaker

One game. You break bricks. Pink `?` bricks stop the table and ask a question. A right answer changes the board — extra balls, a wider paddle, slow-mo, a fireball, or a chip through the wall. A wrong answer makes it meaner.

648 questions across eighteen sections, each tagged easy, medium, or hard. Early
waves ask warm-ups and the deep waves stop being polite. A run will not repeat a
question until that bank is empty, and recent questions stay out of the next run.

Answer streaks pay a multiplier that rides along on every brick you break, so a
hot run visibly snowballs. Miss one and the game shows you the right answer.

Built to play on a phone: drag to move, tap to launch. No setup screen, just Play.

## Play on your phone

The permanent link:

**https://mindbreaker.third-sun.workers.dev**

That is a Cloudflare Workers deployment. It does not expire, so the link keeps
working and can be shared as-is. Once the repo secrets below are set, every push
to `main` redeploys to that same URL, so it never goes stale.

If it ever stops resolving, redeploy it by hand:

```bash
npx wrangler login
npm run deploy
```

There is also an older stopgap on a third-party CDN, pinned to one commit. It
does not follow new commits and is not a permanent home:

`https://rawcdn.githack.com/YonatanNudman/Cursor/7b99692f504bea4c0e43295802ef588f234aaf9c/docs/index.html`

### Connecting Cloudflare (one time)

1. In the Cloudflare dashboard, create an API token from the
   **Edit Cloudflare Workers** template, and copy your Account ID from the
   Workers & Pages sidebar.
2. In this repo, go to Settings -> Secrets and variables -> Actions, and add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Merge the game branch into `main`.

The Deploy workflow does the rest, and prints the live URL in its log. After
that, pushing to `main` is the whole deploy process. You can also run it by hand
from the Actions tab with **Run workflow**.

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
