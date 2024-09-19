SOURCE_FILES := $(shell find src -name '*.ts')
BUILD_FILES := $(shell find build -name '*.ts')
.DELETE_ON_ERROR:

dev: dist/antismash_dev.js

build/index.js: $(SOURCE_FILES)
	npm run compile

dist/antismash_dev.js: build/index.js $(SOURCE_FILES)
	rm -f dist/antismash.js
	./node_modules/.bin/webpack --mode development

prod: dist/antismash.js

dist/antismash.js: lint build/index.js $(SOURCE_FILES)
	./node_modules/.bin/webpack --mode production

lint:
	npm run lint

clean:
	rm -rf dist build

.DEFAULT_GOAL=prod
.PHONY: all lint
