# Ariba Academy – SAP Ariba 6-Week Course Website

Static landing page + Decap CMS admin, hosted free on Netlify.

- **Website content** lives in `content/site.json` (price, batch date, curriculum, FAQs, trainer, contact…).
- **Admin panel:** `https://<your-site>.netlify.app/admin/` – log in with GitHub. Every save commits to this repo and Netlify redeploys automatically (~30 s).
- **Enquiries** from the enroll form appear in Netlify → Site → Forms (free: 100 submissions/month). Turn on email notifications under Forms → Notifications.

## Files
| Path | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | The website |
| `thank-you.html` | Shown after enquiry form submit |
| `admin/` | Decap CMS (GitHub backend) |
| `images/uploads/` | Images uploaded from the admin |
| `netlify.toml` | Netlify settings |

## Giving someone else admin access
Add them as a collaborator (Settings → Collaborators) on this GitHub repo with Write access. They can then log in at `/admin/`.
