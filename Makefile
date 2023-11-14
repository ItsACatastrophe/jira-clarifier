build:
	tsc src/* --outDir ./dist

clean-build:
	rm -rf ./dist

deploy-all: build
	mv node_modules/ node_modules_temp/
	npm install --production
	zip -q -r deploy.zip dist/* node_modules/*
	rm -rf node_modules/
	mv node_modules_temp/ node_modules/
	cdk deploy --require-approval never --all
	$(MAKE) clean-up
	$(MAKE) clean-build

deploy-sns:
	cdk deploy --require-approval never sns-stack 

deploy-lambda: build
	mv node_modules/ node_modules_temp/
	npm install --production
	zip -q -r deploy.zip dist/* node_modules/*
	rm -rf node_modules/
	mv node_modules_temp/ node_modules/
	cdk deploy --require-approval never lambda-stack 
	$(MAKE) clean-up
	$(MAKE) clean-build

clean-up:
	rm -rf deploy.zip