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
# Journal content (manifest + markdown) fetched by the site.
COPY content/ /usr/share/nginx/html/content/
CMD ["nginx", "-g", "daemon off;"]
