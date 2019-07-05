.PHONY: all
all: README.md

README.md: README.jq.md index.js Makefile
	jq '[.,{ syntax: $$syntax }] | add' package.json \
		--arg syntax "$$(node index.js -h)" | jq -rf $< > $@
