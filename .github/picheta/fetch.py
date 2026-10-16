#!/usr/bin/env python3
"""TEMPORANEO — istantanea del sito ufficiale di Picheta per la demo di redesign.

L'ambiente di sviluppo non raggiunge picheta.mx; il runner di GitHub sì.
Salva in picheta/_source/: pagine (HTML renderizzato + testo + DOM), screenshot,
miniature di tutte le immagini con l'URL originale (manifest.json), loghi/SVG e PDF.
Le foto scelte si scaricano poi a piena risoluzione (select.py). Da rimuovere dopo l'uso.
"""
import io
import json
import re
import socket
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

OUT = Path('picheta/_source')
for d in ('pages', 'shots', 'thumbs', 'files'):
    (OUT / d).mkdir(parents=True, exist_ok=True)

LOG = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    print(s, flush=True)
    LOG.append(s)


UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36')
IMG_RE = re.compile(r'\.(jpe?g|png|webp|avif|gif|svg)(\?|$)', re.I)

for h in ('picheta.mx', 'www.picheta.mx'):
    try:
        log('DNS', h, socket.gethostbyname(h))
    except Exception as e:  # noqa: BLE001
        log('DNS', h, 'FAIL', e)

images: dict[str, dict] = {}
pdfs: set[str] = set()
captured: list[dict] = []


def slug(url: str) -> str:
    p = urllib.parse.urlparse(url)
    s = (p.netloc + p.path).strip('/').replace('/', '_') or 'root'
    if p.query:
        s += '_' + p.query
    return re.sub(r'[^a-zA-Z0-9_.-]', '-', s)[:110]


def add_img(u: str, page_url: str, alt: str = '') -> None:
    if not u or u.startswith('data:') or u.startswith('blob:'):
        return
    u = urllib.parse.urljoin(page_url, u.strip())
    e = images.setdefault(u, {'pages': set(), 'alt': set()})
    e['pages'].add(page_url)
    if alt:
        e['alt'].add(alt[:200])


def fetch(url: str, limit: int = 40_000_000, referer: str | None = None):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*',
                                               **({'Referer': referer} if referer else {})})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.status, r.headers.get('Content-Type', ''), r.read(limit)


DOM_JS = '''() => {
  const out = {title: document.title, lang: document.documentElement.lang, imgs: [], bgs: [], links: [], metas: [], fonts: [], colors: {}};
  document.querySelectorAll('img, source').forEach(i => out.imgs.push({
    src: i.currentSrc || i.src || '', srcset: i.srcset || i.getAttribute('data-srcset') || '',
    dsrc: i.getAttribute('data-src') || i.getAttribute('data-lazy-src') || i.getAttribute('data-bg') || '',
    alt: i.alt || '', w: i.naturalWidth || 0, h: i.naturalHeight || 0}));
  const fonts = new Set(); const colors = {};
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage.includes('url(')) out.bgs.push(cs.backgroundImage);
    fonts.add(cs.fontFamily);
    colors[cs.color] = (colors[cs.color] || 0) + 1;
    colors['bg ' + cs.backgroundColor] = (colors['bg ' + cs.backgroundColor] || 0) + 1;
  });
  out.fonts = [...fonts]; out.colors = colors;
  document.querySelectorAll('a[href], iframe[src], form[action]').forEach(a => out.links.push({
    tag: a.tagName, href: a.href || a.src || a.action, text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 120)}));
  document.querySelectorAll('meta, link[rel]').forEach(m => out.metas.push({
    k: m.getAttribute('property') || m.getAttribute('name') || m.getAttribute('rel') || m.getAttribute('itemprop'),
    v: m.getAttribute('content') || m.getAttribute('href')}));
  out.jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent);
  return out;
}'''


def capture(page, url: str, shot: bool = True):
    log('GOTO', url)
    try:
        resp = page.goto(url, wait_until='domcontentloaded', timeout=60000)
    except Exception as e:  # noqa: BLE001
        log('  FAIL', str(e).splitlines()[0])
        return None
    status = resp.status if resp else None
    log('  status', status, 'final', page.url)
    try:
        page.wait_for_load_state('networkidle', timeout=20000)
    except Exception:  # noqa: BLE001
        pass
    try:
        y, h = 0, page.evaluate('document.body.scrollHeight')
        while y < h and y < 60000:
            y += 600
            page.evaluate(f'window.scrollTo(0,{y})')
            page.wait_for_timeout(300)
            h = page.evaluate('document.body.scrollHeight')
        page.evaluate('window.scrollTo(0,0)')
        page.wait_for_timeout(1200)
    except Exception as e:  # noqa: BLE001
        log('  scroll err', e)
    name = slug(page.url)
    html = page.content()
    (OUT / 'pages' / f'{name}.html').write_text(html[:4_000_000], encoding='utf-8')
    try:
        (OUT / 'pages' / f'{name}.txt').write_text(page.evaluate('document.body.innerText'), encoding='utf-8')
    except Exception:  # noqa: BLE001
        pass
    if shot:
        try:
            png = page.screenshot(full_page=True, type='png')
            im = Image.open(io.BytesIO(png)).convert('RGB')
            if im.width > 1000:
                im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
            # le pagine molto lunghe in più pezzi da 2400 px
            for i, top in enumerate(range(0, im.height, 2400)):
                im.crop((0, top, im.width, min(im.height, top + 2400))).save(
                    OUT / 'shots' / f'{name}-{i:02d}.jpg', 'JPEG', quality=62)
        except Exception as e:  # noqa: BLE001
            log('  shot err', e)
    try:
        data = page.evaluate(DOM_JS)
    except Exception as e:  # noqa: BLE001
        log('  dom err', e)
        return {'status': status, 'final': page.url, 'links': []}
    (OUT / 'pages' / f'{name}.dom.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    for im in data['imgs']:
        cands = [im['src'], im['dsrc']] + [s.strip().split(' ')[0] for s in im['srcset'].split(',') if s.strip()]
        for u in cands:
            add_img(u, page.url, im['alt'])
    for b in data['bgs']:
        for u in re.findall(r'url\(["\']?([^"\')]+)', b):
            add_img(u, page.url)
    for m in data['metas']:
        if m['v'] and IMG_RE.search(m['v']):
            add_img(m['v'], page.url, 'meta:' + str(m['k']))
    for link in data['links']:
        if re.search(r'\.pdf(\?|$)', link['href'] or '', re.I):
            pdfs.add(link['href'])
    rec = {'url': url, 'status': status, 'final': page.url, 'name': name, 'links': data['links']}
    captured.append({k: v for k, v in rec.items() if k != 'links'})
    return rec


def same_site(href: str, host_suffix: str) -> bool:
    p = urllib.parse.urlparse(href)
    if p.scheme not in ('http', 'https'):
        return False
    if 'web.archive.org' in p.netloc:
        m = re.search(r'/web/\d+[a-z_]*/(https?://[^?#]+)', href)
        return bool(m) and host_suffix in urllib.parse.urlparse(m.group(1)).netloc
    return p.netloc.endswith(host_suffix)


SKIP = re.compile(r'(wp-admin|wp-login|/feed|xmlrpc|/wp-json|\.(pdf|jpe?g|png|webp|svg|gif|zip|mp4)(\?|$)|/tag/|/author/|/category/|#)', re.I)


def crawl(page, seeds: list[str], host_suffix: str, max_pages: int = 22) -> int:
    queue, seen, ok = list(seeds), set(), 0
    while queue and len(seen) < max_pages:
        u = queue.pop(0).split('#')[0]
        if u in seen:
            continue
        seen.add(u)
        rec = capture(page, u)
        if not rec or not rec['status'] or rec['status'] >= 400:
            continue
        ok += 1
        for link in rec['links']:
            h = (link['href'] or '').split('#')[0]
            if h and same_site(h, host_suffix) and not SKIP.search(h) and h not in seen and h not in queue:
                queue.append(h)
    return ok


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, user_agent=UA, locale='es-MX')
    page = ctx.new_page()

    def on_resp(r):
        try:
            if r.request.resource_type == 'image' or 'image/' in (r.headers.get('content-type') or ''):
                add_img(r.url, page.url, 'net')
            elif 'font' in (r.headers.get('content-type') or '') or r.request.resource_type == 'font':
                log('  font', r.url)
        except Exception:  # noqa: BLE001
            pass

    page.on('response', on_resp)

    seeds = ['https://picheta.mx/', 'https://picheta.mx/menu/', 'https://picheta.mx/contacto/']
    ok = crawl(page, seeds, 'picheta.mx')
    log('LIVE pages ok:', ok)
    if ok == 0:
        log('Sito non raggiungibile: provo con Wayback Machine')
        wb = ['https://web.archive.org/web/2026/' + s for s in seeds]
        ok = crawl(page, wb, 'picheta.mx', max_pages=14)
        log('WAYBACK pages ok:', ok)

    # Schede di terzi (solo come riferimento per dati e canali di prenotazione)
    for u in ('https://www.opentable.com.mx/r/picheta-merida', 'https://www.opentable.com/r/picheta-merida'):
        capture(page, u)

    # Versione mobile della home (riferimento per l'identità attuale)
    m = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, user_agent=UA, locale='es-MX').new_page()
    try:
        m.goto('https://picheta.mx/', wait_until='networkidle', timeout=45000)
        m.screenshot(path=str(OUT / 'shots' / 'mobile-home.jpg'), type='jpeg', quality=60)
    except Exception as e:  # noqa: BLE001
        log('mobile err', str(e).splitlines()[0])
    browser.close()

# File di supporto (WordPress / sitemap / robots), se esistono
for path in ('robots.txt', 'sitemap.xml', 'sitemap_index.xml', 'wp-sitemap.xml',
             'wp-json/wp/v2/media?per_page=100', 'wp-json/wp/v2/media?per_page=100&page=2',
             'wp-json/wp/v2/pages?per_page=50'):
    url = 'https://picheta.mx/' + path
    try:
        st, ct, body = fetch(url, 6_000_000)
        name = re.sub(r'[^a-zA-Z0-9_.-]', '-', path)
        (OUT / 'files' / name).write_bytes(body)
        log('GET', url, st, ct, len(body))
        if 'media' in path and 'json' in ct:
            for it in json.loads(body):
                add_img(it.get('source_url', ''), url, it.get('alt_text') or (it.get('title') or {}).get('rendered', ''))
    except Exception as e:  # noqa: BLE001
        log('GET', url, 'FAIL', str(e).splitlines()[0][:120])


def originals(u: str) -> list[str]:
    base = u.split('?')[0]
    cands = []
    m = re.match(r'(https?://static\.wixstatic\.com/media/[^/]+)', u)
    if m:
        cands.append(m.group(1))
    if 'squarespace-cdn.com' in u:
        cands.append(base + '?format=2500w')
    wp = re.sub(r'-\d{2,5}x\d{2,5}(?=\.(jpe?g|png|webp|avif)$)', '', base, flags=re.I)
    if wp != base:
        cands.append(wp)
    wp2 = re.sub(r'-scaled(?=\.(jpe?g|png|webp)$)', '', wp, flags=re.I)
    if wp2 != wp:
        cands.append(wp)  # "-scaled" è già la versione grande servita da WordPress
    cands.append(u)
    out = []
    for c in cands:
        if c not in out:
            out.append(c)
    return out


groups: dict[str, dict] = {}
for u, e in images.items():
    key = originals(u)[0]
    g = groups.setdefault(key, {'cands': [], 'pages': set(), 'alt': set()})
    for c in originals(u):
        if c not in g['cands']:
            g['cands'].append(c)
    g['pages'] |= e['pages']
    g['alt'] |= e['alt']

log('immagini uniche:', len(groups))
manifest = []
n = 0
for key, g in sorted(groups.items()):
    if n >= 260:
        break
    for cand in g['cands']:
        try:
            st, ct, body = fetch(cand, referer='https://picheta.mx/')
        except Exception as e:  # noqa: BLE001
            log('IMG FAIL', cand[:160], str(e).splitlines()[0][:80])
            continue
        rec = {'id': f'{n:03d}', 'url': cand, 'all': g['cands'], 'ctype': ct, 'bytes': len(body),
               'pages': sorted(g['pages']), 'alt': sorted(g['alt'])}
        if 'svg' in ct or cand.lower().split('?')[0].endswith('.svg'):
            (OUT / 'files' / f'{n:03d}.svg').write_bytes(body)
            rec['file'] = f'files/{n:03d}.svg'
        else:
            try:
                im = Image.open(io.BytesIO(body))
                rec['w'], rec['h'] = im.size
                rec['mode'] = im.mode
                if max(im.size) < 120:
                    log('IMG tiny', cand[:120], im.size)
                    break
                is_logo = 'logo' in cand.lower() or im.mode in ('RGBA', 'LA', 'P')
                if is_logo and len(body) < 3_000_000:
                    ext = 'png' if 'png' in ct or im.mode != 'RGB' else 'jpg'
                    (OUT / 'files' / f'{n:03d}.{ext}').write_bytes(body)
                    rec['file'] = f'files/{n:03d}.{ext}'
                t = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
                t.thumbnail((900, 900), Image.LANCZOS)
                if t.mode == 'RGBA':
                    bg = Image.new('RGB', t.size, (128, 128, 128))
                    bg.paste(t, mask=t.split()[3])
                    t = bg
                t.save(OUT / 'thumbs' / f'{n:03d}.jpg', 'JPEG', quality=74)
                rec['thumb'] = f'thumbs/{n:03d}.jpg'
            except Exception as e:  # noqa: BLE001
                log('IMG decode FAIL', cand[:120], e)
                break
        manifest.append(rec)
        log('IMG ok', rec['id'], rec.get('w'), rec.get('h'), rec['bytes'], cand[:150])
        n += 1
        break

for i, p in enumerate(sorted(pdfs)):
    try:
        st, ct, body = fetch(p, 25_000_000)
        (OUT / 'files' / f'doc-{i:02d}.pdf').write_bytes(body)
        log('PDF', p, len(body))
    except Exception as e:  # noqa: BLE001
        log('PDF FAIL', p, e)

(OUT / 'manifest.json').write_text(json.dumps({'pages': captured, 'images': manifest, 'pdfs': sorted(pdfs)},
                                              ensure_ascii=False, indent=1), encoding='utf-8')
(OUT / 'log.txt').write_text('\n'.join(LOG), encoding='utf-8')
log('fine')
