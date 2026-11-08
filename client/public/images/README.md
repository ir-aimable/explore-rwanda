# Images

Drop photos here; the UI picks them up automatically. Until a file exists, an
illustrated placeholder is shown (in `npm run dev` a small dashed label shows the
exact path to add).

| File | Where it appears | Suggested size |
| --- | --- | --- |
| `hero.jpg` | Home page hero (e.g. a gorilla / volcano landscape) | 2400×1200 |
| `destinations-hero.jpg` | Destinations page banner | 2400×700 |
| `trips-hero.jpg` | Trips page banner | 2400×700 |
| `auth.jpg` | Left half of the Log in / Sign up pages | 1400×1800 |
| `destinations/<slug>.jpg` | Destination cards, and trip cards / trip hero when the trip has no cover image | 1200×750 |

Destination slugs from the seed data:

- `ibere-rya-bigogwe`
- `nyandungu-eco-park`
- `akagera-national-park`
- `nyungwe-national-park`
- `lake-kivu`
- `musanze-area`

Images uploaded through the admin/organizer dashboards (destination `image_path`,
trip `cover_image`) always take priority over these files.
