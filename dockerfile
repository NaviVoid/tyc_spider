FROM node:slim

LABEL tyc.author="Navi"

WORKDIR /app
COPY dist/ dist/
COPY package.json package.json

RUN npm i

VOLUME [ "/app/txts", "/app/logs" ]

CMD [ "node", "." ]
