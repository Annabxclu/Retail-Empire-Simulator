"""Bundle src/ into a single self-contained index.html."""
from pathlib import Path
root = Path(__file__).parent
src = root / 'src'
html = (src / 'shell.html').read_text()
html = (html.replace('/*CSS*/', (src / 'style.css').read_text())
            .replace('/*ENGINE*/', (src / 'engine.js').read_text())
            .replace('/*UI*/', (src / 'ui.js').read_text()))
(root / 'index.html').write_text(html)
print(f'Wrote index.html ({len(html):,} bytes)')
