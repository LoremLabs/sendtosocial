# Dev Notes

## Email Templates

We use Maizzle for email creation, but only the output is included in the repo. To set it up:

```bash
cd tmp
npx degit maizzle/maizzle send-to-social-emails
```

Install dependencies:

```
cd send-to-social-emails

pnpm install
```

Start local development:

```
pnpm run dev
```

Build emails for production:

```
pnpm run build
```

Copy emails to the right place:

```
cp -r dist/* ../../packages/fairpass-emails/
```

