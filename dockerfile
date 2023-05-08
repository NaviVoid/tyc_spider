FROM node:slim

LABEL tyc.author="Navi"

WORKDIR /app
COPY dist/ dist/
COPY package.json package.json

RUN npm i

VOLUME [ ".env", "res.csv", "names.txt" ]

CMD [ "node", "." ]
