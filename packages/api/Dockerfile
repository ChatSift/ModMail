FROM node:16-alpine
LABEL name "api builder"

WORKDIR /opt/build

RUN apk add --update \
&& apk add --no-cache ca-certificates \
&& apk add --no-cache --virtual .build-deps curl git python3 alpine-sdk

# First copy over dependencies separate from src for better caching
COPY package.json tsconfig.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn workspaces focus

# Next up, copy over our prisma schema and generate the prisma client. This could be done automatically by just
# copying the schema before-hand, but that'd cause dep cache invalidation just for schema changes, so this is better build speed wise
COPY prisma ./prisma
RUN yarn prisma generate

RUN yarn workspaces focus --production

# Next up, copy over our src and build it, then prune deps for prod
COPY . ./

WORKDIR /opt/build/packages/api

RUN yarn workspaces focus && yarn build && yarn workspaces focus --production

FROM node:16-alpine
LABEL name "api"
LABEL version "0.1.0-dev"

WORKDIR /usr/api
COPY --from=0 /opt/build ./

WORKDIR /usr/api/packages/api

# For some reason experimental feature warnings get spammed ONLY wthin Docker, so our fix for now is --no-warnings
CMD ["node", "--es-module-specifier-resolution=node", "--enable-source-maps", "--no-warnings", "./dist/index.js"]
