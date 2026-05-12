.PHONY: build clean web

build: web
	go build -o polywave-web ./cmd/polywave-web

web:
	cd web && npm install && npm run build

clean:
	rm -f polywave-web
	rm -rf web/dist web/node_modules
