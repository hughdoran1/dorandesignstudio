FROM nginx:alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
# New homepage: grid-system.html served as index.html, plus everything it loads.
COPY grid-system.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/
COPY dds-icon-engine.js /usr/share/nginx/html/
COPY HeroLottie5.js /usr/share/nginx/html/
COPY HeroLottie5.json /usr/share/nginx/html/
COPY graph-schema.svg /usr/share/nginx/html/
COPY 2.png /usr/share/nginx/html/
COPY 3.png /usr/share/nginx/html/
COPY 4.png /usr/share/nginx/html/
COPY IconGenerator.png /usr/share/nginx/html/
COPY dds-icon-256-2.png /usr/share/nginx/html/
COPY Schemavisualisation.png /usr/share/nginx/html/
COPY share-card.png /usr/share/nginx/html/
# Self-hosted fonts. The Material Symbols @font-face lives ONLY in fonts/fonts.css — without this every
# icon on the site renders its ligature NAME as literal text (arrow_back, download, delete, …).
COPY fonts/ /usr/share/nginx/html/fonts/
# Logo + trophy art. Named individually, NOT `COPY files/` — that folder is a scratch dir and a
# whole-folder copy would publish NOTES.md and the prototype .html files to the public web root.
COPY files/dds-logo-blue.png files/trophy-graffold.png /usr/share/nginx/html/files/
# Tournament Lottie: ship BOTH — the .js is the fast path, the .json is mountCompLottie's fallback.
COPY CompetitionLottie.js /usr/share/nginx/html/
COPY CompetitionLottie.json /usr/share/nginx/html/
# Crawler surface.
COPY robots.txt /usr/share/nginx/html/
COPY sitemap.xml /usr/share/nginx/html/
# Journal content (manifest + markdown) fetched by the site.
COPY content/ /usr/share/nginx/html/content/
CMD ["nginx", "-g", "daemon off;"]
