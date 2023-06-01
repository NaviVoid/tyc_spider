.PHONY: build run rev rev_csv

VERSION=1.1.1
NAME=tyc
MONGODB=mongodb=mongodb://tyc:tyc233@127.0.0.1:27017/tyc?authSource=tyc

build:
	@rm -rf dist
	@pnpm tsc
	@docker build -t ${NAME}:${VERSION}  .
	@docker save -o ./deploy/${NAME}.tar ${NAME}:${VERSION}

run:
	@${MONGODB} pnpm start

rev:
	@${MONGODB} action=rev pnpm start

rev_csv:
	@${MONGODB} action=rev_csv pnpm start
