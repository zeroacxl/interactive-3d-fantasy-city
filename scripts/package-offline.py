"""Execute npm run build antes de empacotar. Apenas biblioteca padrao."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
html = root / 'dist/index.html'
if not html.is_file():
    raise SystemExit('Execute npm run build primeiro.')
out = root / 'downloads/Aqua-City-Offline-Windows.zip'
out.parent.mkdir(exist_ok=True)
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    archive.write(html, 'Aqua-City/index.html')
    for source in sorted((root / 'offline').iterdir()):
        if source.is_file():
            archive.write(source, 'Aqua-City/' + source.name)
with ZipFile(out) as archive:
    assert archive.testzip() is None
print(out)
