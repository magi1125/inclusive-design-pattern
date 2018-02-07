cd epub
FILENAME=`git show -s --date=short --format="../inclusive_%cd_%ct.epub"`
zip -0 -X $FILENAME mimetype
zip -r $FILENAME * -x mimetype
