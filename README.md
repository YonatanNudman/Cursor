# Mindbreaker

One hybrid: brick-breaker plus trivia, built for a phone.

**Cannon** aims once and empties a magazine. When the volley runs dry the
surviving wall drops toward you, and if it reaches the floor it costs you as
many lives as it drops rows. **Paddle** is the older fight: hold to aim,
release to fire, then drag the bar and keep the ball alive.

Coloured bricks are questions. The hue tells you the subject and the glyph
tells you the stake: `?` risks one life, `??` two, `!?` three. Get it right and
you win that many lives; get it wrong and you pay them. A brutal miss also
drops a fresh row on the wall, and a hard miss armours every brick. Rows near
the top of the wall ask harder questions than rows near the bottom, so the
wall reads as a gradient and you can choose your fight before you swing.

Pale gold `★` bricks let you choose outright: three subjects, then three
prices. The subjects you played most recently are held back, so you cannot
farm one category all run.

Levels rotate through ten layouts, and every fifth is a boss built from three
layouts that never appear otherwise. As you climb, the wall thickens, the
magazine shrinks, and the wall drops further per volley. `scripts/balance.ts`
plays the game headless if you want to check the curve after a change:

```bash
npx vite-node scripts/balance.ts            # summary across presets
npx vite-node scripts/balance.ts --per-level
```

Four presets set the starting lives and how thick the wall begins. Chill hands
a life back each cleared level; Brutal gives you one life and a taller wall.

Answer streaks pay a multiplier that rides along on every brick you break, so
a hot run visibly snowballs. The bank holds several thousand questions and
will not repeat an id until it is empty, and recent questions stay out of the
next run.

The board also drops a random original gag every so often — farts, honks, sad
trombone, that kind of thing. Nothing ripped off a reel, and nothing printed
on screen; they are sounds, so they only ever play.

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
