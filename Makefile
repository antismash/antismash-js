SOURCE_FILES := $(wildcard src/*.ts)

dev: dist/antismash_dev.js

dist/antismash_dev.js: $(SOURCE_FILES)
	rm -f dist/antismash.js
	./node_modules/.bin/webpack --mode development

prod: dist/antismash.js

dist/antismash.js: $(SOURCE_FILES)
	npm run lint
	./node_modules/.bin/webpack --mode production

lint:
	npm run lint

.DEFAULT_GOAL=prod
.PHONY: all lint
