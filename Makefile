.PHONY: all
all: README.md

README.md: README.jq.md Makefile
	echo '{}' | jq '[{ syntax: $$syntax }] | add' \
		--arg syntax "$$(node index.js -h)" | jq -rf $< > $@
