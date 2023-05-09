.PHONY: build upload

VERSION=1.0.0
NAME=tyc

build:
	@rm -rf dist
	@pnpm tsc
	@docker build -t ${NAME}:${VERSION}  .
	@docker save -o ./deploy/${NAME}.tar ${NAME}:${VERSION}
