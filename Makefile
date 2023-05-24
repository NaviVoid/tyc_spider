.PHONY: build run

VERSION=1.1.1
NAME=tyc

build:
	@rm -rf dist
	@pnpm tsc
	@docker build -t ${NAME}:${VERSION}  .
	@docker save -o ./deploy/${NAME}.tar ${NAME}:${VERSION}

run:
	@mongodb=mongodb://tyc:tyc233@127.0.0.1:27017/tyc?authSource=tyc pnpm start
