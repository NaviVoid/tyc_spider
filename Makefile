.PHONY: build upload

VERSION=1.0.0
NAME=tyc

build:
	@rm -rf dist
	@pnpm tsc
	@docker build -t ${NAME}:${VERSION}  .
	@docker save -o ./deploy/${NAME}.tar ${NAME}:${VERSION}

upload:
	@rsync -rP --rsh=ssh ./deploy/${NAME}.tar root@47.108.252.52:/root/smoger

report:
	@rsync -rP --rsh=ssh root@47.108.252.52:/root/smoger/tyc/res.csv ./