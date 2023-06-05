.PHONY: build run rev rev_csv upd

VERSION=1.2.1
NAME=tyc
MONGODB=mongodb://tyc:tyc233@127.0.0.1:27017/tyc?authSource=tyc
TOKEN=eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxOTEzNjM0MzEzNyIsImlhdCI6MTY4NDgyNTQ2MywiZXhwIjoxNjg3NDE3NDYzfQ.0HtNE0AI_7L7g7JYBLywDZ3awhfn7fhQ0uWBXVRuKUSLkKFWkMNxH5XJLxEzsw7AmdJTJ3zf6qIbFPqMT0bbAw

build:
	@rm -rf dist
	@pnpm tsc
	@docker build -t ${NAME}:${VERSION}  .
	@docker save -o ./deploy/${NAME}.tar ${NAME}:${VERSION}

run:
	@mongodb=${MONGODB} token=${TOKEN} pnpm start

upd:
	@mongodb=${MONGODB} token=${TOKEN} action=update pnpm start

rev:
	@mongodb=${MONGODB} token=${TOKEN} action=rev pnpm start

rev_csv:
	@mongodb=${MONGODB} token=${TOKEN} action=rev_csv pnpm start
