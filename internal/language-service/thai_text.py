"""Thai text for the 4.7 beta client (CN client, e.g. StarRail_4.6.53_CN_ReversedRooms).

The beta only ships English, Chinese, Japanese and Korean text, but its language table still has the Thai row
(Thai fonts and Thai line breaking). This script builds a Thai TextMap for the beta from the live client's Thai
TextMap, turns Thai on in the beta client and has the dispatch serve it:

    python thai_text.py build    # (re)build and switch the beta's text language to Thai
    python thai_text.py restore  # back to what the client had before build (e.g. hsrlingo's English)

Paths default to the ones below; pass --beta / --live to use others.

Which text a row gets: every row of the beta's English TextMap is kept, in the beta's order. A row takes the live
Thai text when the live client has Thai for that key. Rows without a matching Thai key stay in English.

What build does:
- reads the beta's design data index from the CDN URL in the local server's versions.json, adds the two Thai TextMap
  files (the full one, lang "th", and the small one the client loads at start) with the same table hashes the live
  client uses, and writes index + files to <repo>/design_override/<version>/<cdn folder>/client/Windows/. The client
  starts its update by asking for M_Design_ArchiveV.bytes and loads the DesignV named in its "M_DesignV" line, so
  that file is written too (pointing at the new index), with M_DesignV.bytes and the Design_PatchV file it names.
  The dispatch hands the client that folder instead of the CDN and redirects every other file to the CDN. The client
  re-reads the index on every start and deletes design files its index does not list, so editing the client's own
  copy does not last.
- copies index and Thai files into the beta's Persistent/DesignData so the next start does not download them.
- adds the small Thai TextMap to the beta's StreamingAssets index too (new DesignV, M_DesignV and
  M_Design_ArchiveV): before it reaches the server the client loads the start TextMap of its text language
  ("TextmapMain_th") from the StreamingAssets index only, and without it the start throws and the screen stays black.
- sets the text language list in the beta's start config (StreamingAssets, the table hsrlingo patches) to Thai.
  The voice language is left alone.
The StreamingAssets files as they were are kept in design_override/<version>/boot_backup/ (added.txt lists the files
build added there) for restore.

Formats (big-endian index, varint tables), worked out from the 4.6.53 beta and 4.6 live clients:
- M_Design_ArchiveV.bytes: JSON lines; "M_DesignV" = DesignV md5 (ContentHash) and size (FileSize),
  "M_Design_PatchV" = Design_PatchV_<md5>.bytes, the hpatch list from the previous version.
- M_DesignV.bytes (66 bytes): "SRMI", ..., u32le patch version at 0x18, DesignV md5 as 4 u32le words at 0x1c,
  u64le DesignV size at 0x2c, u32le time at 0x34.
- DesignV_<md5>.bytes: u32 0xff, u32 4, i32 file count, i32 table count, then per file: u64 hash, md5[16],
  i64 size, i32 n, n * (u64 table hash, u32 size, u32 offset), u16 + language ("" for most files), u8 0x80.
  Files are stored as <md5>.bytes, or <language>/<md5>.bytes when the language is set.
- TextMap table: zigzag varint row count, rows of varint field mask; bit 0 = key (zigzag varint hash32 + varint
  hash64), bit 1 = text (varint length + UTF-8), bit 2 = HasParam (u8). Its index table: zigzag count, rows of mask
  0x0f, hash64, zigzag offset and zigzag length of the row inside the TextMap table, 0.
- Region language table: 0x00, zigzag count, rows of mask; bit 0 = region ("cn"/"os"), bit 1 = kind (absent =
  text, 1 = voice), bit 2 = zigzag count + language codes, bit 3 = default language.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))

DEFAULT_BETA = r'D:\Games\StarRail_4.6.53_CN_ReversedRooms'
DEFAULT_LIVE = r'H:\Games\Star Rail Games'

# Table hashes. They are hashes of the table names and the same in every client version.
EN_MAIN, EN_MAIN_INDEX = 0x12676d4ed6e604f2, 0x8cb9a9c1c48a185f  # full English TextMap, file lang "en"
EN_START, EN_START_INDEX = 0xf90c090cbf12fd1f, 0xd726e9f28dfd8ac7  # small English TextMap used at start
TH_MAIN, TH_MAIN_INDEX = 0xf7a4de4a0a526a66, 0xf4bd7ab48af1b6da  # full Thai TextMap, file lang "th"
TH_START, TH_START_INDEX = 0x1573487e8c3d61ca, 0xafb36ae446fcc629  # small Thai TextMap used at start
START_CONFIG = 0x058690e656a0f775  # StreamingAssets-only config file (language and font tables)
REGION_TABLE = 0xb804dbc76d81fb75  # its text/voice language list per region

PLACEHOLDER = '...'


# ---------------------------------------------------------------- varints

def read_varint(d, p):
    result = shift = 0
    while True:
        b = d[p]
        p += 1
        result |= (b & 0x7f) << shift
        shift += 7
        if b < 0x80:
            return result, p


def unzigzag(n):
    return (n >> 1) ^ -(n & 1)


def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7f
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def zigzag(n):
    return varint((n << 1) ^ (n >> 63) if n < 0 else n << 1)


def read_string(d, p):
    n, p = read_varint(d, p)
    return d[p:p + n].decode('utf-8'), p + n


def string(s):
    b = s.encode('utf-8')
    return varint(len(b)) + b


# ---------------------------------------------------------------- design data index

def md5_hex(data):
    return hashlib.md5(data).hexdigest()


def parse_m_designv(d):
    assert len(d) == 66 and d[:4] == b'SRMI', 'not an M_DesignV.bytes'
    words = struct.unpack_from('<4I', d, 0x1c)
    md5 = b''.join(struct.pack('>I', w) for w in words).hex()
    size, = struct.unpack_from('<Q', d, 0x2c)
    return md5, size


def make_m_designv(template, md5, size):
    d = bytearray(template)
    raw = bytes.fromhex(md5)
    struct.pack_into('<4I', d, 0x1c, *struct.unpack('>4I', raw))
    struct.pack_into('<Q', d, 0x2c, size)
    return bytes(d)


def parse_archive(data):
    """M_Design_ArchiveV.bytes: one JSON object per line (CRLF), e.g. FileName "M_DesignV" with the DesignV md5."""
    lines = data.split(b'\r\n')
    assert lines[-1] == b'', 'M_Design_ArchiveV.bytes does not end with a line break'
    entries = [json.loads(line) for line in lines[:-1]]
    assert make_archive(entries) == data, 'M_Design_ArchiveV.bytes round trip failed'
    return entries


def make_archive(entries):
    return b''.join(json.dumps(e, separators=(',', ':'), ensure_ascii=False).encode() + b'\r\n' for e in entries)


def archive_entry(entries, file_name):
    for e in entries:
        if e['FileName'] == file_name:
            return e
    raise SystemExit(f'M_Design_ArchiveV.bytes has no {file_name}')


def parse_designv(d):
    head = d[:8]
    count, = struct.unpack_from('>i', d, 8)
    p = 16
    files = []
    for _ in range(count):
        file_hash, = struct.unpack_from('>Q', d, p)
        md5 = d[p + 8:p + 24].hex()
        size, n = struct.unpack_from('>qi', d, p + 24)
        p += 36
        tables = []
        for _ in range(n):
            tables.append(struct.unpack_from('>QII', d, p))
            p += 16
        lang_len, = struct.unpack_from('>H', d, p)
        lang = d[p + 2:p + 2 + lang_len].decode()
        p += 2 + lang_len
        flag = d[p]
        p += 1
        files.append({'hash': file_hash, 'md5': md5, 'size': size, 'tables': tables, 'lang': lang, 'flag': flag})
    assert p == len(d), 'DesignV has trailing bytes'
    return head, files


def make_designv(head, files):
    out = bytearray(head)
    out += struct.pack('>ii', len(files), sum(len(f['tables']) for f in files))
    for f in files:
        out += struct.pack('>Q', f['hash']) + bytes.fromhex(f['md5']) + struct.pack('>qi', f['size'], len(f['tables']))
        for t in f['tables']:
            out += struct.pack('>QII', *t)
        lang = f['lang'].encode()
        out += struct.pack('>H', len(lang)) + lang + bytes([f['flag']])
    return bytes(out)


def file_by_hash(files, file_hash):
    for f in files:
        if f['hash'] == file_hash:
            return f
    raise SystemExit(f'design data index has no file {file_hash:016x}')


def table_bytes(data, f, table_hash):
    for h, size, offset in f['tables']:
        if h == table_hash:
            return data[offset:offset + size]
    raise SystemExit(f'file {f["md5"]} has no table {table_hash:016x}')


# ---------------------------------------------------------------- TextMap

def parse_textmap(t):
    """Rows of (mask, hash32, hash64, text, has_param) in file order."""
    n, p = read_varint(t, 0)
    rows = []
    for _ in range(unzigzag(n)):
        mask, p = read_varint(t, p)
        if mask & ~7 or not mask & 1:
            raise SystemExit(f'unexpected TextMap row mask {mask:#x}')
        h32, p = read_varint(t, p)
        h64, p = read_varint(t, p)
        text = has_param = None
        if mask & 2:
            text, p = read_string(t, p)
        if mask & 4:
            has_param = t[p]
            p += 1
        rows.append((mask, unzigzag(h32), h64, text, has_param))
    assert p == len(t), 'TextMap table has trailing bytes'
    return rows


def make_textmap(rows):
    """The TextMap table and its index table."""
    head = zigzag(len(rows))
    body = bytearray(head)
    index = bytearray(head)
    for mask, h32, h64, text, has_param in rows:
        start = len(body)
        body += varint(mask) + zigzag(h32) + varint(h64)
        if mask & 2:
            body += string(text)
        if mask & 4:
            body.append(has_param)
        index += b'\x0f' + varint(h64) + zigzag(start) + zigzag(len(body) - start) + b'\x00'
    return bytes(body), bytes(index)


def text_file(main_hash, index_hash, rows):
    body, index = make_textmap(rows)
    tables = [(main_hash, len(body), 0), (index_hash, len(index), len(body))]
    return body + index, tables


MINOR_WORDS = {'a', 'an', 'the', 'to', 'is', 'and', 'of', 's'}


def words(text):
    """The words that carry meaning: lower case, no punctuation or line breaks, no a/the/to..., no doubled words."""
    out = []
    for w in re.findall(r"[a-z0-9#%\[\]]+", text.lower().replace('\\n', ' ')):
        if w not in MINOR_WORDS and not (out and out[-1] == w):
            out.append(w)
    return out


def merge(beta_en, live_th, stats):
    """Beta rows with live Thai text wherever the key exists."""
    th = {r[2]: r for r in live_th}
    rows = []
    for row in beta_en:
        mask, h32, h64, text, has_param = row
        t = th.get(h64)
        if t is not None and t[3] is not None:
            stats['thai'] += 1
            rows.append(((mask & 1) | (t[0] & 6), h32, h64, t[3], t[4]))
        else:
            stats['untranslated'] += 1
            rows.append(row)
    return rows


# ---------------------------------------------------------------- region language table

def parse_region_table(t):
    assert t[0] == 0, 'region table does not start with 0'
    n, p = read_varint(t, 1)
    rows = []
    for _ in range(unzigzag(n)):
        mask, p = read_varint(t, p)
        if mask & ~0xf:
            raise SystemExit(f'unexpected region table row mask {mask:#x}')
        row = {'mask': mask, 'region': None, 'kind': 0, 'langs': None, 'default': None}
        if mask & 1:
            row['region'], p = read_string(t, p)
        if mask & 2:
            row['kind'], p = read_varint(t, p)
        if mask & 4:
            k, p = read_varint(t, p)
            row['langs'] = []
            for _ in range(unzigzag(k)):
                s, p = read_string(t, p)
                row['langs'].append(s)
        if mask & 8:
            row['default'], p = read_string(t, p)
        rows.append(row)
    # Some client versions append fields after the language rows. Return the parsed length
    # so callers can preserve those unknown bytes when patching the table.
    return rows, p


def make_region_table(rows):
    out = bytearray(b'\x00') + zigzag(len(rows))
    for row in rows:
        out += varint(row['mask'])
        if row['mask'] & 1:
            out += string(row['region'])
        if row['mask'] & 2:
            out += varint(row['kind'])
        if row['mask'] & 4:
            out += zigzag(len(row['langs'])) + b''.join(string(s) for s in row['langs'])
        if row['mask'] & 8:
            out += string(row['default'])
    return bytes(out)


def text_rows_to(rows, lang):
    """Enable `lang` for text and select it as default without changing voice languages."""
    for row in rows:
        if row['kind'] == 0:
            if row['langs'] is None:
                row['langs'] = []
                row['mask'] |= 4
            if lang not in row['langs']:
                row['langs'].append(lang)
            if row['default'] is not None:
                row['default'] = lang
    return rows


# ---------------------------------------------------------------- client folders

def design_dir(client, where):
    return os.path.join(client, 'StarRail_Data', where, 'DesignData', 'Windows')


def client_version(beta):
    with open(os.path.join(beta, 'StarRail_Data', 'StreamingAssets', 'BinaryVersion.bytes'), 'rb') as f:
        m = re.search(rb'(?:CN|OS)[A-Z]*(?:Win|Android)\d+\.\d+\.\d+', f.read())
    if not m:
        raise SystemExit('cannot read the client version from BinaryVersion.bytes')
    return m.group().decode()


def local_file(client, f):
    """The client's copy of an index file if it has one with the right content."""
    name = f['md5'] + '.bytes'
    for where in ('Persistent', 'StreamingAssets'):
        path = os.path.join(design_dir(client, where), f['lang'], name) if f['lang'] else \
            os.path.join(design_dir(client, where), name)
        if os.path.exists(path):
            with open(path, 'rb') as fh:
                data = fh.read()
            if md5_hex(data) == f['md5']:
                return data
    return None


def fetch(url, cache_path=None):
    print('  download', url)
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.read()
    except Exception as exc:
        if cache_path and os.path.isfile(cache_path):
            print('  CDN unavailable; using cached file', cache_path)
            with open(cache_path, 'rb') as fh:
                return fh.read()
        raise SystemExit(f'download failed and no cached copy is available: {url}: {exc}') from exc


def design_file(base, client, f):
    data = local_file(client, f)
    if data is None:
        rel = f'{f["lang"]}/{f["md5"]}.bytes' if f['lang'] else f'{f["md5"]}.bytes'
        data = fetch(f'{base}/client/Windows/{rel}')
        if md5_hex(data) != f['md5']:
            raise SystemExit(f'{rel} from the CDN has the wrong md5')
    return data


def client_index(client):
    """The index the client itself last saved (its Persistent copy)."""
    folder = design_dir(client, 'Persistent')
    with open(os.path.join(folder, 'M_DesignV.bytes'), 'rb') as fh:
        md5, _ = parse_m_designv(fh.read())
    with open(os.path.join(folder, f'DesignV_{md5}.bytes'), 'rb') as fh:
        return parse_designv(fh.read())[1]


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as fh:
        fh.write(data)


# ---------------------------------------------------------------- commands

def build(beta, live, dispatch_root, hotfix_path):
    version = client_version(beta)
    with open(hotfix_path, encoding='utf-8') as fh:
        hotfix = json.load(fh).get(version)
    if not hotfix:
        raise SystemExit(f'versions.json has no {version}: start the game once with the server first')
    base = hotfix['ex_resource_url'].rstrip('/')
    cdn_folder = base.rsplit('/', 1)[1]
    print(f'{version}, design data {base}')
    cache_root = os.path.join(dispatch_root, 'design_override', version, cdn_folder, 'client', 'Windows')

    # The client asks for M_Design_ArchiveV.bytes and takes the DesignV md5 from its "M_DesignV" line.
    archive = parse_archive(fetch(
        f'{base}/client/Windows/M_Design_ArchiveV.bytes',
        os.path.join(cache_root, 'M_Design_ArchiveV.bytes'),
    ))
    design_entry = archive_entry(archive, 'M_DesignV')
    index_md5 = design_entry['ContentHash']
    m_designv = fetch(f'{base}/client/Windows/M_DesignV.bytes', os.path.join(cache_root, 'M_DesignV.bytes'))
    if parse_m_designv(m_designv)[0] != index_md5:
        raise SystemExit('the CDN\'s M_DesignV.bytes and M_Design_ArchiveV.bytes disagree: try again later')
    index = fetch(
        f'{base}/client/Windows/DesignV_{index_md5}.bytes',
        os.path.join(cache_root, f'DesignV_{index_md5}.bytes'),
    )
    if md5_hex(index) != index_md5:
        raise SystemExit('DesignV from the CDN has the wrong md5')
    head, files = parse_designv(index)
    assert make_designv(head, files) == index, 'DesignV round trip failed'
    files = [f for f in files if f['hash'] not in (TH_MAIN, TH_START)]  # a CDN that ever ships Thai: use ours

    print('reading the TextMaps')
    en_main = file_by_hash(files, EN_MAIN)
    en_start = file_by_hash(files, EN_START)
    beta_en = parse_textmap(table_bytes(design_file(base, beta, en_main), en_main, EN_MAIN))
    beta_en_start = parse_textmap(table_bytes(design_file(base, beta, en_start), en_start, EN_START))

    live_files = client_index(live)
    f = file_by_hash(live_files, TH_MAIN)
    data = local_file(live, f)
    if data is None:
        raise SystemExit('the live client has no Thai TextMap: set its text language to Thai once and let it download')
    live_th = parse_textmap(table_bytes(data, f, TH_MAIN))

    stats = {'thai': 0, 'untranslated': 0}
    th_rows = merge(beta_en, live_th, stats)
    start_stats = dict.fromkeys(stats, 0)
    th_start_rows = merge(beta_en_start, live_th, start_stats)
    total = len(th_rows)
    thai = stats['thai']
    print(f'TextMap rows {total}: Thai {thai}, untranslated {stats["untranslated"]} '
          f'({100 * thai / total:.1f}% Thai)')
    print(f'start TextMap rows {len(th_start_rows)}: Thai {sum(v for k, v in start_stats.items() if k.startswith("thai"))}')

    th_main_data, th_main_tables = text_file(TH_MAIN, TH_MAIN_INDEX, th_rows)
    th_start_data, th_start_tables = text_file(TH_START, TH_START_INDEX, th_start_rows)
    assert parse_textmap(th_main_data[:th_main_tables[0][1]]) == th_rows
    th_main = {'hash': TH_MAIN, 'md5': md5_hex(th_main_data), 'size': len(th_main_data),
               'tables': th_main_tables, 'lang': 'th', 'flag': 0x80}
    th_start = {'hash': TH_START, 'md5': md5_hex(th_start_data), 'size': len(th_start_data),
                'tables': th_start_tables, 'lang': '', 'flag': 0x80}
    new_index = make_designv(head, files + [th_main, th_start])
    new_index_md5 = md5_hex(new_index)
    new_m_designv = make_m_designv(m_designv, new_index_md5, len(new_index))
    design_entry['ContentHash'], design_entry['FileSize'] = new_index_md5, len(new_index)

    out = {
        'M_DesignV.bytes': new_m_designv,
        f'DesignV_{new_index_md5}.bytes': new_index,
        f'th/{th_main["md5"]}.bytes': th_main_data,
        f'{th_start["md5"]}.bytes': th_start_data,
    }
    served = dict(out)
    served['M_Design_ArchiveV.bytes'] = make_archive(archive)
    # The update step also fetches the patch list named here; keep it local instead of a redirect to the CDN.
    for e in archive:
        if e['FileName'] == 'M_Design_PatchV':
            name = f'Design_PatchV_{e["ContentHash"]}.bytes'
            served[name] = fetch(f'{base}/client/Windows/{name}', os.path.join(cache_root, name))
            if md5_hex(served[name]) != e['ContentHash']:
                raise SystemExit(f'{name} from the CDN has the wrong md5')
    version_dir = os.path.join(dispatch_root, 'design_override', version)
    if os.path.isdir(version_dir):  # older builds of this version, e.g. for a CDN folder that is gone
        for name in os.listdir(version_dir):
            if name != 'boot_backup':
                path = os.path.join(version_dir, name)
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
    write(os.path.join(version_dir, '.cyrene-thai-text'), b'Cyrene Thai beta text patch\n')
    target = os.path.join(version_dir, cdn_folder)
    for rel, data in served.items():
        write(os.path.join(target, 'client', 'Windows', rel), data)
    write(os.path.join(target, 'upstream.txt'), base.encode())
    print('dispatch files in', target)

    persistent = design_dir(beta, 'Persistent')
    for rel, data in out.items():
        write(os.path.join(persistent, rel), data)
    print('copied into', persistent)

    start_config_data, start_config_table_delta = set_text_language(beta, dispatch_root, version, 'th', base)
    add_start_textmap(
        beta, dispatch_root, version, th_start, th_start_data,
        start_config_data, start_config_table_delta,
    )
    print('done: make sure the updated local server is running, then restart the game')


def boot_backup(dispatch_root, version, name=''):
    return os.path.join(dispatch_root, 'design_override', version, 'boot_backup', name)


def keep_original(dispatch_root, version, path):
    """Copies a StreamingAssets file into boot_backup the first time build changes it."""
    backup = boot_backup(dispatch_root, version, os.path.basename(path))
    if not os.path.exists(backup):
        os.makedirs(os.path.dirname(backup), exist_ok=True)
        shutil.copy2(path, backup)


def start_index(beta):
    folder = design_dir(beta, 'StreamingAssets')
    with open(os.path.join(folder, 'M_DesignV.bytes'), 'rb') as fh:
        m_designv = fh.read()
    md5, _ = parse_m_designv(m_designv)
    with open(os.path.join(folder, f'DesignV_{md5}.bytes'), 'rb') as fh:
        head, files = parse_designv(fh.read())
    return folder, m_designv, head, files


def start_config(beta, base):
    folder, _, _, files = start_index(beta)
    f = file_by_hash(files, START_CONFIG)
    rel = os.path.join(f['lang'], f['md5'] + '.bytes') if f['lang'] else f['md5'] + '.bytes'
    path = os.path.join(folder, rel)
    if not os.path.isfile(path):
        # Some beta installs keep the start config only in Persistent or have not cached it yet.
        # The CDN index still gives its hash, so recover a verified copy before editing it.
        data = design_file(base, beta, f)
        write(path, data)
    return path, f


def add_start_textmap(beta, dispatch_root, version, th_start, th_start_data,
                      start_config_data, start_config_table_delta):
    """Indexes the Thai start TextMap and language config with hashes the client will accept."""
    folder, m_designv, head, files = start_index(beta)
    m_path = os.path.join(folder, 'M_DesignV.bytes')
    archive_path = os.path.join(folder, 'M_Design_ArchiveV.bytes')
    with open(archive_path, 'rb') as fh:
        entries = parse_archive(fh.read())
    keep_original(dispatch_root, version, m_path)
    keep_original(dispatch_root, version, archive_path)

    config = file_by_hash(files, START_CONFIG)
    old_config_name = f"{config['md5']}.bytes"
    region_offset = next(offset for h, _, offset in config['tables'] if h == REGION_TABLE)
    if start_config_table_delta:
        updated_tables = []
        for table_hash, table_size, table_offset in config['tables']:
            if table_hash == REGION_TABLE:
                table_size += start_config_table_delta
            elif table_offset > region_offset:
                table_offset += start_config_table_delta
            updated_tables.append((table_hash, table_size, table_offset))
        config['tables'] = updated_tables
    config['md5'] = md5_hex(start_config_data)
    config['size'] = len(start_config_data)
    index_files = [f for f in files if f['hash'] not in (TH_START, START_CONFIG)] + [config, th_start]
    index = make_designv(head, index_files)
    index_md5 = md5_hex(index)
    config_name = f'{config["md5"]}.bytes'
    new_files = {
        f'DesignV_{index_md5}.bytes': index,
        f'{th_start["md5"]}.bytes': th_start_data,
        config_name: start_config_data,
    }

    # A previous builder wrote over the original config while leaving its old hash in DesignV.
    # Restore that cached original (when available) before storing the correctly hashed Thai copy.
    old_config_path = os.path.join(folder, old_config_name)
    if os.path.isfile(old_config_path) and md5_hex(open(old_config_path, 'rb').read()) != config['md5']:
        backup = boot_backup(dispatch_root, version, old_config_name)
        if os.path.isfile(backup) and md5_hex(open(backup, 'rb').read()) == old_config_name[:-6]:
            shutil.copy2(backup, old_config_path)
    for name, data in new_files.items():
        write(os.path.join(folder, name), data)
    e = archive_entry(entries, 'M_DesignV')
    e['ContentHash'], e['FileSize'] = index_md5, len(index)
    write(archive_path, make_archive(entries))
    write(m_path, make_m_designv(m_designv, index_md5, len(index)))

    # Files an earlier build added and this one no longer uses.
    added_path = boot_backup(dispatch_root, version, 'added.txt')
    added = set()
    if os.path.exists(added_path):
        with open(added_path, encoding='utf-8') as fh:
            added = set(fh.read().split())
    for name in added - set(new_files):
        if os.path.exists(os.path.join(folder, name)):
            os.remove(os.path.join(folder, name))
    with open(added_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(sorted(new_files)) + '\n')
    print('start language config indexed', config_name)
    print('start TextMap added to the StreamingAssets index', f'DesignV_{index_md5}.bytes')


def set_text_language(beta, dispatch_root, version, lang, base):
    path, f = start_config(beta, base)
    keep_original(dispatch_root, version, path)
    with open(path, 'rb') as fh:
        data = fh.read()
    for h, size, offset in f['tables']:
        if h == REGION_TABLE:
            break
    else:
        raise SystemExit('start config has no region language table')
    old = data[offset:offset + size]
    rows, parsed_size = parse_region_table(old)
    assert make_region_table(rows) == old[:parsed_size], 'region table round trip failed'
    new = make_region_table(text_rows_to(rows, lang))
    replacement = new + old[parsed_size:]
    updated = data[:offset] + replacement + data[offset + size:]
    print(f'text language in {os.path.basename(path)}:',
          ', '.join(f'{r["region"]} {r["default"]}' for r in rows if r['kind'] == 0))
    return updated, len(replacement) - size


def restore(beta, dispatch_root):
    version = client_version(beta)
    version_dir = os.path.join(dispatch_root, 'design_override', version)
    marker = os.path.join(version_dir, '.cyrene-thai-text')
    if not os.path.isfile(marker):
        raise SystemExit(f'no Cyrene Thai text build found for {version}; nothing was restored')
    folder = design_dir(beta, 'StreamingAssets')
    backups = boot_backup(dispatch_root, version)
    if os.path.isdir(backups):
        added_path = os.path.join(backups, 'added.txt')
        if os.path.exists(added_path):
            with open(added_path, encoding='utf-8') as fh:
                for name in fh.read().split():
                    if os.path.exists(os.path.join(folder, name)):
                        os.remove(os.path.join(folder, name))
        for name in os.listdir(backups):
            if name != 'added.txt':
                shutil.copy2(os.path.join(backups, name), os.path.join(folder, name))
                print('restored', name)
    else:
        print('no StreamingAssets backup for', version)
    if os.path.isdir(version_dir):
        shutil.rmtree(version_dir)
        print('removed', version_dir)
    # The client's index is ours: without it the client fetches the CDN's on the next start.
    m_designv = os.path.join(design_dir(beta, 'Persistent'), 'M_DesignV.bytes')
    if os.path.exists(m_designv):
        os.remove(m_designv)
    print('done: the next start downloads the CDN index again')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('command', choices=['build', 'restore'])
    ap.add_argument('--beta', default=DEFAULT_BETA, help='the beta client folder (has StarRail.exe)')
    ap.add_argument('--live', default=DEFAULT_LIVE, help='the live client folder with Thai text downloaded')
    ap.add_argument('--dispatch-root', default=os.getcwd(), help='server working directory (contains versions.json)')
    args = ap.parse_args()
    versions_path = os.path.join(args.dispatch_root, 'versions.json')
    if args.command == 'build':
        build(args.beta, args.live, args.dispatch_root, versions_path)
    else:
        restore(args.beta, args.dispatch_root)


if __name__ == '__main__':
    main()
