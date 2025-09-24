.PHONY: build docker test run

build:
	npm --prefix backend ci

docker:
	docker build -t midlevelbot:latest .

test:
	npm --prefix backend test

run:
	npm --prefix backend run dev
