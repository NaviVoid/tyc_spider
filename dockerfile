FROM node:slim

LABEL tyc.author="Navi"

WORKDIR /app
COPY dist/ dist/
COPY package.json package.json

RUN npm i

VOLUME [ "res.csv", "names.txt" ]
EXPOSE 8000

CMD [ "node", "." ]
