# The Collation Ledger

A small app for collecting data by category (e.g. "Thanksgiving": Name, Phone Number, Email)
and turning it into CSV reports. Built to match the same architecture as your other SU apps:
a static `public/` frontend, Netlify Functions as the backend, and Netlify Blobs for storage.

## How it works

- **Categories** hold a set of fields (e.g. Thanksgiving → Name, Phone Number, Email). Each
  category has its own private **shareable link** — that link is the *only* way anyone can
  submit into that category.
- **Entries** are the individual submissions. Every entry requires a **point of contact
  name** before it can be submitted — this is separate from the category's own fields, so
  you always know who added what.
- **Permissions**:
  - Anyone with a category's share link can add entries, and can see everyone's entries.
  - A contributor can only delete their **own** entries (tracked with a private per-browser
    token, no login required for contributors).
  - The **admin** can add or delete any category or entry, and can mark an entry as
    **reviewed**, which greys it out. Once an entry is greyed out, contributors can no longer
    edit or delete it — only the admin can.
- **Reports**: from the Admin Desk, pick a category and click "Export report (CSV)" to
  download all of its entries.

The first time you sign in to the Admin Desk, a **Thanksgiving** category (Name, Phone
Number, Email) is created for you automatically.

## Project structure

```
public/
  index.html      landing page
  entry.html       the page contributors reach via a category's share link
  admin.html       admin desk: manage categories, review entries, export CSV
  style.css
netlify/
  functions/
    _utils.js       shared helpers (Blobs stores, admin auth)
    categories.js    add / list / delete categories
    entries.js       add / list / delete / mark-reviewed entries
netlify.toml
package.json
```

## 1. Set the admin password

Before deploying, set an environment variable so the default password isn't left in place:

- In Netlify: **Site settings → Environment variables → Add a variable**
  - Key: `ADMIN_PASSWORD`
  - Value: whatever you want the admin password to be

If you don't set this, the app falls back to `psalm119:105` — you can still override it with
your own `ADMIN_PASSWORD` env var at any time without touching code.

## 2. Push to GitHub

```bash
cd data-collate-app
git add .
git commit -m "Initial commit: Collation Ledger"
gh repo create data-collate-app --private --source=. --push
# or manually: create a repo on github.com, then
# git remote add origin https://github.com/<you>/data-collate-app.git
# git branch -M main
# git push -u origin main
```

## 3. Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing
   project** → choose the GitHub repo you just pushed.
2. Build settings should auto-detect from `netlify.toml`:
   - Build command: `npm install`
   - Publish directory: `public`
3. Enable **Netlify Blobs** — it's on by default for any site on Netlify (no extra setup),
   but if you see storage errors, go to **Site configuration → Environment variables** and
   confirm the site has blob storage access (it does automatically once deployed).
4. Add the `ADMIN_PASSWORD` environment variable (step 1) before your first deploy, then
   **Deploy site**.

## 4. First use

1. Visit `https://<your-site>.netlify.app/admin.html` and sign in with your admin password.
2. The **Thanksgiving** category is auto-created. Copy its share link and send it to whoever
   needs to add entries.
3. To add another category, use the "Add a category" panel — give it a name and list the
   fields you want collected (e.g. for a new category: `name` → "Name", `unit` → "Unit
   Number").
4. As entries come in, review them from the "Review entries" panel and click **Mark
   reviewed** to grey an entry out (it becomes locked from further edits by contributors).
5. Click **Export report (CSV)** any time to download the current entries for a category.

## Verifying the right code is live

After deploying, visit `https://<your-site>.netlify.app/api/categories` directly in your
browser. You should get a JSON response (even a small one, e.g. `{"categories":[...]}` or a
permission message) — **not** a 404 or "Page not found". If you get a 404, the Netlify
Functions didn't deploy; check the **Deploys** and **Functions** tabs on that site in Netlify
to confirm this exact repo/commit is what's connected and published.

If you're deploying to a site that already existed for something else (a reused Netlify site
name), double-check under **Site configuration → Build & deploy → Continuous deployment**
that it's linked to *this* GitHub repo, not a different project.



- Contributor identity is a private token stored in their browser's local storage — there's
  no login for contributors, so "my entries" only persists on the same device/browser they
  used to submit.
- Deleting a category does not delete its entries from storage, but since its share link and
  form are gone, they become effectively archived. Export a report first if you want a copy.
