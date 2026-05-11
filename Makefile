.PHONY: build clean web

build: web
	go build -o polywave ./cmd/polywave

web:
	cd web && npm install && npm run build

clean:
	rm -f polywave
	rm -rf web/dist web/node_modules
