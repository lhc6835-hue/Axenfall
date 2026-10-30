"""Builds dist-single/axenfall.html: one self-contained file (JS, fonts, sounds inlined) that runs by double-click."""
import base64, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist = os.path.join(root, 'dist')
html = open(os.path.join(dist, 'index.html'), encoding='utf-8').read()

def data_uri(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()

MIME = {'.ogg': 'audio/ogg', '.json': 'application/json', '.woff2': 'font/woff2'}
assets = {}
for sub in ['audio']:
    for d, _, files in os.walk(os.path.join(dist, sub)):
        for f in files:
            ext = os.path.splitext(f)[1]
            if ext not in MIME: continue
            full = os.path.join(d, f)
            assets[os.path.relpath(full, dist).replace(os.sep, '/')] = data_uri(full, MIME[ext])

html = re.sub(r"url\('fonts/([^']+)'\)", lambda m: "url('" + data_uri(os.path.join(dist, 'fonts', m.group(1)), 'font/woff2') + "')", html)
m = re.search(r'<script type="module" crossorigin src="\./(assets/[^"]+)"></script>', html)
js = open(os.path.join(dist, m.group(1)), encoding='utf-8').read().replace('</script', '<\\/script')
import json
inline = '<script>window.__ASSETS=' + json.dumps(assets) + ';</script>\n<script type="module">' + js + '</script>'
html = html.replace(m.group(0), '')
html = html.replace('</body>', inline + '\n</body>')
os.makedirs(os.path.join(root, 'dist-single'), exist_ok=True)
out = os.path.join(root, 'dist-single', 'axenfall.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, round(os.path.getsize(out) / 1e6, 2), 'MB')
