FROM nginx:alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY HeroLottie5.json /usr/share/nginx/html/
COPY HeroLottie5.js /usr/share/nginx/html/
COPY dds-icon-256-2.png /usr/share/nginx/html/
CMD ["nginx", "-g", "daemon off;"]
