#!/usr/bin/env python3
import re, glob, os

files = sorted(glob.glob('src/dashboards/*.tsx'))
ORDER = ['NAVY','GOLD','SUCCESS','ERROR','WARNING','MUTED']

for f in files:
    with open(f) as fh:
        content = fh.read()

    # Which colors does this file actually use (beyond the declarations)?
    uses = set()
    for c in ORDER:
        # Check usage beyond just the const declaration
        pattern = re.compile(r'\b' + c + r'\b')
        decl_pattern = re.compile(r"const\s+" + c + r"\s*=")
        matches = pattern.findall(content)
        decls = decl_pattern.findall(content)
        if len(matches) > len(decls):
            uses.add(c)

    # Remove local const declarations
    content_new = re.sub(
        r"const\s+(NAVY|GOLD|SUCCESS|ERROR|WARNING|MUTED)\s*=\s*['\"][^'\"]+['\"]\s*;?\s*\n",
        '', content
    )

    if not uses:
        if content_new != content:
            with open(f, 'w') as fh:
                fh.write(content_new)
            print(f'{os.path.basename(f)}: removed unused color consts')
        continue

    imports = sorted(uses, key=lambda c: ORDER.index(c))
    import_line = "import { " + ", ".join(imports) + " } from '../theme/jfsdTheme';"

    if "from '../theme/jfsdTheme'" in content_new:
        m = re.search(r"import \{([^}]+)\} from '../theme/jfsdTheme';", content_new)
        if m:
            existing = [x.strip() for x in m.group(1).split(',')]
            combined = existing + [c for c in imports if c not in existing]
            new_import = "import { " + ", ".join(combined) + " } from '../theme/jfsdTheme';"
            content_new = content_new.replace(m.group(0), new_import)
    else:
        lines = content_new.split('\n')
        import_indices = [i for i, line in enumerate(lines) if line.startswith('import ')]
        if import_indices:
            lines.insert(import_indices[-1] + 1, import_line)
        content_new = '\n'.join(lines)

    # Clean up excessive blank lines
    content_new = re.sub(r'\n{3,}', '\n\n', content_new)

    with open(f, 'w') as fh:
        fh.write(content_new)

    print(f'{os.path.basename(f)}: removed {len(uses)} local consts, added import')
