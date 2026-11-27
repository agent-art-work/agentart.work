"""Check the additive creation handoff without executing browser or SDK code."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit


class ModuleScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('type') == 'module':
            self.sources.append(attrs.get('src', ''))


def check_create_assets(root, output, base=''):
    errors, allowed = [], set()
    try:
        config = json.loads((root/'site/create-agent.json').read_text())
        page = ModuleScripts()
        page.feed((output/'create/index.html').read_text())
        entries = [source for source in page.sources if '/assets/agent-art-create.' in source]
        if len(entries) != 1:
            raise ValueError('Create must select one immutable creation adapter')
        match = re.fullmatch(re.escape(base) + r'/assets/(agent-art-create\.([a-f0-9]{64})\.mjs)', entries[0])
        if not match:
            raise ValueError('Invalid creation adapter path')
        adapter_name, adapter_hash = match.groups()
        adapter_path = Path('assets')/adapter_name
        adapter_file = output/adapter_path
        if adapter_file.is_symlink(): raise ValueError('Linked creation adapter')
        adapter = adapter_file.read_bytes()
        if hashlib.sha256(adapter).hexdigest() != adapter_hash:
            raise ValueError('Creation adapter digest mismatch')
        imports = re.findall(r"from './(agent-art-create-work\.([a-f0-9]{64})\.mjs)'", adapter.decode())
        if len(imports) != 1:
            raise ValueError('Creation adapter must import one immutable Work')
        work_name, work_hash = imports[0]
        work_path = Path('assets')/work_name
        if (output/work_path).is_symlink(): raise ValueError('Linked creation Work')
        work_bytes = (output/work_path).read_bytes()
        if hashlib.sha256(work_bytes).hexdigest() != work_hash:
            raise ValueError('Creation Work digest mismatch')
        if not work_bytes.startswith(b'export default ') or not work_bytes.endswith(b';\n'):
            raise ValueError('Invalid creation Work module')
        work = json.loads(work_bytes[len(b'export default '):-2])
        expected = dict(id=config['id'], version=config['version'], title=config['label'],
                        purpose=config['purpose'], capabilities=['handoff'], conditions=config['conditions'],
                        context=[dict(id='creation-invitation', kind='text', mode='snapshot',
                                      text='\n\n'.join(config['invitation'])),
                                 *[dict(id=item['id'], kind='reference', mode='live', url=item['url'])
                                   for item in config['references']]])
        if work != expected:
            raise ValueError('Creation Work differs from its site-owned invitation')
        source = (root/'site/assets/agent-art-create.mjs').read_text()
        if source.count("'./agent-art-create-work.mjs'") != 1:
            raise ValueError('Invalid creation adapter source')
        if adapter != source.replace("'./agent-art-create-work.mjs'", "'./"+work_name+"'").encode():
            raise ValueError('Creation adapter differs from its source')
        for file in output.rglob('*.html'):
            if file != output/'create/index.html' and entries[0] in file.read_text():
                raise ValueError('Creation adapter must be loaded only on Create')
        if (output/'assets/agent-art-create.mjs').exists():
            raise ValueError('Unversioned creation adapter must not be published')
        allowed.update([adapter_path, work_path])
    except (OSError, ValueError, TypeError, KeyError, UnicodeError) as error:
        errors.append(f'cannot verify creation handoff: {error}')
    return errors, allowed
