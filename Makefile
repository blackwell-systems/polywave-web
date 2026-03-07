.PHONY: build clean web

build: web
	go build -o saw ./cmd/saw

web:
	cd web && npm install && npm run build

clean:
	rm -f saw
	rm -rf web/dist web/node_modules
