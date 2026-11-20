"""Crop the rendered frames around the action, lay the logo in, ease the loop point, write PNGs for ffmpeg."""
import sys, os, glob
from PIL import Image, ImageFilter, ImageDraw

T = sys.argv[1]
src = sorted(glob.glob(os.path.join(T, 'frames', 'f*.png')))
out = os.path.join(T, 'comp')
os.makedirs(out, exist_ok=True)
for f in glob.glob(os.path.join(out, '*.png')):
    os.remove(f)

CW, CH = 768, 432  # a 3x crop: 256x144 world pixels around the camera
FADE = 8

logo = Image.open(os.path.join(T, 'logo.png')).convert('RGBA')
scale = 0.82
logo = logo.resize((int(logo.width * scale), int(logo.height * scale)), Image.LANCZOS)

def vignette(w, h):
    """darken the corner the logo sits in so it always reads"""
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((-int(w * 0.25), int(h * 0.48), int(w * 0.62), int(h * 1.45)), fill=150)
    return m.filter(ImageFilter.GaussianBlur(48))

shade = vignette(CW, CH)
black = Image.new('RGB', (CW, CH), (6, 4, 10))

n = len(src)
for i, f in enumerate(src):
    im = Image.open(f).convert('RGB')
    x0 = (im.width - CW) // 2
    y0 = (im.height - CH) // 2
    im = im.crop((x0, y0, x0 + CW, y0 + CH))
    im = Image.composite(black, im, shade)
    im.paste(logo, (14, CH - logo.height - 8), logo)
    # dip toward dark at the loop point so the end flows into the start
    k = 1.0
    if i < FADE:
        k = (i + 1) / (FADE + 1)
    elif i >= n - FADE:
        k = (n - i) / (FADE + 1)
    if k < 1:
        im = Image.blend(black, im, 0.35 + 0.65 * k)
    im.save(os.path.join(out, f'c{i:04d}.png'))
print('frames', n)
