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
cp -r tmp/send-to-socials-emails/src/templates/auth-link-01.html ../../src/templates/auth-link-01.tmpl
```

## Email Notes

Layouts don't work so you have to copy the layout template into each email template. Also locals are accessed without the `page` prefix.
