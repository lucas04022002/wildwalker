#syntax=docker/dockerfile:1.4

FROM node:20-alpine

# hadolint ignore=DL3018
RUN apk add --no-cache libc6-compat

WORKDIR /usr/src/app

COPY . .

RUN npm install
