FROM node:20-alpine AS builder

WORKDIR /app
# Only local test builds set this; production builds never show demo sign-in buttons
ARG VITE_SHOW_DEMO_LOGINS=false
ENV VITE_SHOW_DEMO_LOGINS=$VITE_SHOW_DEMO_LOGINS
# Map key is built into the page (map keys are public by design; restrict it to your domain in MapTiler)
ARG VITE_MAPTILER_KEY=
ENV VITE_MAPTILER_KEY=$VITE_MAPTILER_KEY
# Shown on the landing, privacy and terms pages
ARG VITE_OPERATOR_NAME=
ARG VITE_CONTACT_EMAIL=
ARG VITE_CITY=
ENV VITE_OPERATOR_NAME=$VITE_OPERATOR_NAME VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL VITE_CITY=$VITE_CITY
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
