"""Generate small web delivery assets; keep the original logo files untouched.
Requires Pillow. Run from the repository root: python scripts/optimize-brand-assets.py
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'src/assets/logo-png.png'
logo = Image.open(source).convert('RGBA')
web_logo = logo.resize((192, 192), Image.Resampling.LANCZOS)
web_path = root / 'src/assets/logo-web.webp'
web_logo.save(web_path, 'WEBP', lossless=True, exact=True, method=6)
assert web_logo.tobytes() == Image.open(web_path).convert('RGBA').tobytes()

social_source = root / 'public/bz-logo.png'
social = Image.open(social_source).convert('RGBA')
for name, size in [('favicon-64.png', 64), ('apple-touch-icon.png', 180), ('bz-logo-social.png', 512)]:
    destination = root / 'public' / name
    social.resize((size, size), Image.Resampling.LANCZOS).save(destination, optimize=True)
    print(f'{name}: {destination.stat().st_size} bytes')
print(f'Web logo: {source.stat().st_size} -> {web_path.stat().st_size} bytes ({100 * (1 - web_path.stat().st_size / source.stat().st_size):.2f}% smaller)')
