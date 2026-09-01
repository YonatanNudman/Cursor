# Mindbreaker

One game. You break bricks. Pink `?` bricks stop the table and ask a question. A right answer changes the board — extra balls, a wider paddle, slow-mo, a fireball, or a chip through the wall. A wrong answer makes it meaner.

Hundreds of questions across eighteen sections. A run will not repeat a question until that bank is empty. Recent questions stay out of the next run too.

Built to play on a phone: drag to aim, tap to launch.

## Play on your phone

The permanent link, once Cloudflare is connected (see below):

**https://mindbreaker.<your-subdomain>.workers.dev**

Every push to `main` rebuilds and redeploys to that same URL, so the link never
changes and never goes stale.

Until then there is a stopgap on a third-party CDN, pinned to one commit. It
works, but it does not follow new commits and it is not a permanent home:

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
