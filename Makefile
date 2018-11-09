all: prod

dev: compile
	./node_modules/.bin/webpack --mode development

prod: lint compile
	./node_modules/.bin/webpack --mode production

lint:
	npm run lint

compile:
	npm run compile

.PHONY: all dev prod lint compile
