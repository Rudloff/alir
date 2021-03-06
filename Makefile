js =	lib/polyfill.js lib/remotestorage.js lib/webL10n/l10n.js lib/htmlparser.js lib/showdown.js js/touch.js js/utils.js js/view.js js/articles.js js/feeds.js addon/data/lib/readabilitySAX/DOMasSAX.js addon/data/lib/readabilitySAX/readabilitySAX.js js/scrap.js
css = css/alir.css css/form.css css/font.css css/widgetCss.css css/theme.css
cached = css/build.css css/dynamic.css css/user.css css/theme.css css/fonts/icomoon.woff index.html js/alir.js lib/build.js locales/locales.ini cache.manifest img/icon-128.png img/icon-120.png img/icon-256.png img/icon-30.png img/icon-32.png img/icon-48.png img/icon-60.png img/icon-64.png img/icon-72.png img/icon-90.png img/icon-96.png



default: help

help:
	@echo "help   - display this text"
	@echo "build  - merge js libraries"
	@echo "zip    - create packaged app"
	@echo "all    - build + zip"
	@echo "watch  - build on file updated"
	@echo "test   - run tests"

all: init build zip

.PHONY: build zip tests watch clean debug init

init:
	test -s lib/webL10n/.git || ( git submodule update --init --recursive && git submodule foreach git pull origin master )

debug: 
	echo -e "\n\n####################\nBuilding at" `date`
	$$(export CACHEDATE=`date -Iseconds` && sed -i "s/^# v0.*$$/# v0.1 $$CACHEDATE/" cache.manifest)
	uglifyjs 	$(js) \
						-o lib/build.js \
						-b indent-level=2 \
						--source-map build.js.map --source-map-url /build.js.map --screw-ie8
	cat $(css) > css/build.css

build: 
	echo -e "\n\n####################\nBuilding at" `date`
	$$(export CACHEDATE=`date -Iseconds` && sed -i "s/^# v0.*$$/# v0.1 $$CACHEDATE/" cache.manifest)
	uglifyjs 	$(js) \
						-o lib/build.js \
						--screw-ie8
	cat $(css) > css/build.css

zip:
	rm -f alir.zip
	zip -r alir.zip $(cached) manifest.webapp
	echo "0.1."`git ls | wc -l` > VERSION

tests:
	xvfb-run casperjs --engine=slimerjs test tests/suites/

watch:
	while true; do inotifywait -e close_write,moved_to,create,modify js/* css/alir.css css/theme.css lib/remotestorage.js; make debug; done

clean:
	git checkout alir.zip VERSION build.js.map css/build.css lib/build.js cache.manifest
