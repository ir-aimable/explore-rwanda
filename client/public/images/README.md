# Images

The photos here are **generated**, small WebP files. Don't put full-size photos in this folder:
everything in `public/` is deployed as-is, and a 3 MB photo makes the site slow on phones.

To add or replace a built-in photo:

1. Put the original (any size, JPG or PNG) in `client/images-src/`.
2. Add or adjust its line in `JOBS` in `client/scripts/optimize-images.py`.
3. Run `python3 client/scripts/optimize-images.py` (needs Pillow: `pip install Pillow`).

Banner photos get a full-size copy (`hero.webp`, 1600px) and a phone copy (`hero-800.webp`).
`srcSetFor()` in `src/components/Cover.tsx` lists which photos have a phone copy, and the
browser picks the right one.

| File | Where it appears |
| --- | --- |
| `hero.webp`, `hero3.webp` | Home page hero slideshow (`hero3` also on About) |
| `destinations-hero.webp` | Destinations page banner |
| `trips-hero.webp` | Trips page banner |
| `auth.webp` | Left half of the Log in / Sign up pages |
| `about.webp` | Developer photo on the About page |
| `logo.webp`, `assistant.webp`, `assistant-icon.webp` | Logo and assistant mascot |
| `destinations/<slug>.jpg` | Destination cards, and trip cards / trip hero when the trip has no cover image (optional; an illustration is shown until the file exists). Keep these under ~150 KB (1200×750, quality ~75). |

Destination slugs from the seed data:

- `ibere-rya-bigogwe`
- `nyandungu-eco-park`
- `akagera-national-park`
- `nyungwe-national-park`
- `lake-kivu`
- `musanze-area`

Images uploaded through the admin/organizer dashboards (destination `image_path`,
trip `cover_image`) always take priority over these files.
