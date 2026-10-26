import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { createRequire } from 'node:module';
import { checkTokenConsumption } from './check-token-consumption.mjs';
import { productionGraph } from './check-design-inventory.mjs';
import { collectTokenConsumers, inspectConsumerText } from './token-consumers.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const categories = ['color', 'typography', 'spacing', 'sizing', 'shape', 'effects', 'layering', 'motion', 'responsive'];
const layers = ['primitive', 'semantic', 'component', 'adapter'];
const types = ['color', 'dimension', 'fontFamily', 'shadow', 'percentage', 'typography', 'number', 'duration', 'cubicBezier', 'position', 'policy'];
const statuses = ['active', 'alias', 'reserved', 'component-owned', 'platform-owned', 'upstream-owned'];
const axes = ['mode', 'palette', 'neutral', 'radius', 'font', 'typography', 'state', 'density'];
const references = value => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]);
const properties = css => { const names = new Set(); postcss.parse(css).walkDecls(declaration => { if (declaration.prop.startsWith('--')) names.add(declaration.prop); }); return names; };
const publicDeclaration = declaration => {
  const owner = declaration.parent;
  return owner.type === 'atrule' && owner.name === 'theme'
    || owner.type === 'rule' && owner.selectors.some(selector => selector.replace(/\[[^\]]*\]/g, '').replace(/:(?:is|where|not)\(([^()]*)\)/g, '$1').split(',')
      .some(part => /^(?::root|html|body|\.dark|\.light|\.ui-next-theme)(?=$|[.#:])/.test(part.trim()) && !/[\s>+~]/.test(part.trim())));
};
const context = declaration => { const parts = []; for (let node = declaration.parent; node?.type !== 'root'; node = node.parent) parts.unshift(node.selector ?? `@${node.name} ${node.params}`); return parts.join(' / '); };

export async function checkSourcePath(path) {
  // access() alone accepts incorrect filename casing on default macOS volumes.
  await access(path);
  if (!(await readdir(dirname(path))).includes(basename(path))) throw new Error(`Missing source or filename case mismatch: ${path}`);
}

function validateEntry(entry) {
  if (entry.overrides !== undefined && (!Array.isArray(entry.overrides) || new Set(entry.overrides).size !== entry.overrides.length || entry.overrides.some(path => typeof path !== 'string' || !path.trim() || path === entry.source))) throw new Error(`Invalid CSS override sources: ${entry.id}`);
  if (typeof entry.id !== 'string' || !entry.id || typeof entry.description !== 'string' || !entry.description
    || !Array.isArray(entry.consumers) || !entry.consumers.length || entry.consumers.some(path => typeof path !== 'string' || !path.trim()) || !Array.isArray(entry.axes)
    || !categories.includes(entry.category) || !layers.includes(entry.layer) || !types.includes(entry.type)
    || !statuses.includes(entry.status) || entry.axes.some(axis => !axes.includes(axis))) throw new Error(`Invalid token metadata: ${entry.id}`);
}

export function inspectRuntimeTokens(code, expected, source, format) {
  if (format === 'swift-javascript') {
    const scripts = [...code.matchAll(/\.callAsyncJavaScript\(("(?:[^"\\]|\\.)*")/g)].map(([, literal]) => JSON.parse(literal));
    if (!scripts.length) throw new Error(`Missing embedded JavaScript: ${source}`);
    code = scripts.join('\n');
  } else if (format !== undefined) throw new Error(`Unsupported runtime source format: ${format}`);
  const ts = createRequire(resolve(repository, 'apps/ui/package.json'))('typescript');
  const ast = ts.createSourceFile(source, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), found = new Set();
  function visit(node) {
    const name = ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) ? node.name.text
      : ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'setProperty'
        && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : '';
    if (name.startsWith('--')) found.add(name);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const name of found) if (!expected[name]) throw new Error(`Unregistered runtime token: ${source} ${name}`);
  for (const [name, token] of Object.entries(expected)) {
    if (!found.has(name)) throw new Error(`Missing runtime output: ${source} ${name}`);
    if (!({ fontFamily: [null], number: [null], dimension: ['px', 'em', 'rem'] }[token.type]?.includes(token.unit))) throw new Error(`Invalid runtime token type/unit: ${name}`);
  }
}

export function inspectCSSTokens(families, documents, externalNames = []) {
  const records = new Map(), matched = new Set(), definitions = new Set();
  for (const family of families) validateEntry(family);
  for (const [source, css] of documents) {
    postcss.parse(css, { from: source }).walkDecls(declaration => {
      if (!declaration.prop.startsWith('--')) return;
      const name = declaration.prop;
      const owners = families.filter(family => (family.source === source || family.overrides?.includes(source)) && new RegExp(family.pattern).test(name));
      if (!owners.length && !publicDeclaration(declaration)) return;
      if (owners.length !== 1) throw new Error(`${owners.length ? 'Ambiguous' : 'Unregistered'} CSS token: ${source} ${name}`);
      const family = owners[0], scope = context(declaration), key = `${source}:${scope}:${name}`;
      if (definitions.has(key)) throw new Error(`Duplicate CSS definition: ${key}`);
      definitions.add(key); matched.add(family.id);
      const record = records.get(name) ?? { name, family, declarations: [] };
      if (record.family.id !== family.id) throw new Error(`Multiple CSS owners: ${name}`);
      record.declarations.push({ source, scope, value: declaration.value, line: declaration.source.start.line });
      records.set(name, record);
    });
  }
  for (const family of families) if (!matched.has(family.id)) throw new Error(`Empty token family: ${family.id}`);
  const known = new Set([...externalNames, ...records.keys()]);
  for (const record of records.values()) for (const declaration of record.declarations) {
    for (const name of references(declaration.value)) if (!known.has(name)) throw new Error(`Unknown CSS reference: ${record.name} -> ${name}`);
  }
  // Check default aliases and each authored scope. This does not simulate CSS specificity or combined preference axes.
  const scopes = new Set([...records.values()].flatMap(record => record.declarations.map(declaration => declaration.scope)));
  for (const scope of scopes) {
    const graph = new Map([...records].map(([name, record]) => [name, references((record.declarations.find(declaration => declaration.scope === scope) ?? record.declarations[0]).value).filter(reference => reference !== name || !scope.startsWith('@theme reference inline'))]));
    const active = new Set(), done = new Set();
    function visit(name) {
      if (active.has(name)) throw new Error(`Cyclic CSS alias in ${scope}: ${name}`);
      if (done.has(name) || !graph.has(name)) return;
      active.add(name); for (const dependency of graph.get(name)) visit(dependency); active.delete(name); done.add(name);
    }
    for (const name of graph.keys()) visit(name);
  }
  return [...records.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

export function checkPublicPlacement(css, path) {
  const ast = postcss.parse(css);
  ast.walkAtRules('property', rule => { throw new Error(`Public CSS token outside registered sources: ${path} ${rule.params}`); });
  ast.walkDecls(declaration => {
    if (!declaration.prop.startsWith('--')) return;
    if (publicDeclaration(declaration)) throw new Error(`Public CSS token outside registered sources: ${path} ${declaration.prop}`);
  });
}

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? cssFiles(resolve(directory, entry.name)) : entry.name.endsWith('.css') ? [resolve(directory, entry.name)] : []))).flat();
}

async function reachableCSS(root, graph) {
  const reached = new Set();
  async function visit(path) {
    if (reached.has(path)) return;
    reached.add(path);
    const imports = [];
    postcss.parse(await readFile(path, 'utf8')).walkAtRules('import', rule => {
      const target = rule.params.match(/^(?:url\(\s*)?["']([^"']+)["']/)?.[1];
      if (target?.startsWith('.')) imports.push(resolve(dirname(path), target));
    });
    for (const target of imports) await visit(target);
  }
  for (const [module, entry] of graph) for (const target of entry.imports) {
    if (target.endsWith('.css') && target.startsWith('.')) await visit(resolve(root, dirname(module), target));
    else if (target.endsWith('.css') && target.startsWith('@/')) await visit(resolve(root, 'apps/ui/src', target.slice(2)));
  }
  return reached;
}

export async function buildTokenCatalog({ root = repository, registryPath = 'design/tokens/registry.json', outputPath = 'design/token-coverage.generated.md', check = false } = {}) {
  const registry = JSON.parse(await readFile(resolve(root, registryPath), 'utf8'));
  if (registry.version !== 1) throw new Error('Unsupported token registry version.');
  const ids = new Set(), covered = new Set();
  for (const entry of [...registry.families, ...registry.owned]) {
    validateEntry(entry);
    if (ids.has(entry.id)) throw new Error(`Duplicate token contract: ${entry.id}`);
    ids.add(entry.id); covered.add(entry.category);
    if (entry.source && (typeof entry.source !== 'string' || typeof entry.pattern !== 'string' || !entry.pattern.startsWith('^--') || !entry.pattern.endsWith('$'))) throw new Error(`Unbounded token pattern: ${entry.id}`);
    if (!entry.source && (!Array.isArray(entry.sources) || !entry.sources.length || entry.sources.some(path => typeof path !== 'string' || !path.trim()))) throw new Error(`Missing owning sources: ${entry.id}`);
    for (const path of [...(entry.source ? [entry.source, ...(entry.overrides ?? [])] : entry.sources), ...entry.consumers]) await checkSourcePath(resolve(root, path));
  }
  const runtime = [], runtimeNames = new Set();
  for (const entry of registry.runtimeSources) {
    if (!ids.has(entry.contract)) throw new Error(`Unknown runtime contract: ${entry.contract}`);
    await access(resolve(root, entry.defaults));
    inspectRuntimeTokens(await readFile(resolve(root, entry.source), 'utf8'), entry.tokens, entry.source, entry.format);
    for (const [name, metadata] of Object.entries(entry.tokens)) {
      if (runtimeNames.has(name)) throw new Error(`Multiple runtime writers: ${name}`);
      runtimeNames.add(name); runtime.push({ name, ...metadata, source: entry.source, defaults: entry.defaults, contract: entry.contract });
    }
  }
  const documents = new Map();
  for (const source of new Set(registry.families.flatMap(family => [family.source, ...(family.overrides ?? [])]))) documents.set(source, await readFile(resolve(root, source), 'utf8'));
  const externalNames = new Set(runtimeNames);
  for (const source of [...registry.upstreamSources, ...registry.generatedSources]) for (const name of properties(await readFile(resolve(root, source), 'utf8'))) externalNames.add(name);
  for (const entry of registry.externalSources ?? []) {
    const code = await readFile(resolve(root, entry.source), 'utf8');
    if (!ids.has(entry.contract)) throw new Error(`Unknown external contract: ${entry.contract}`);
    for (const [name, token] of Object.entries(entry.tokens)) {
      if (!types.includes(token.type) || !code.includes(`"${name}"`)) throw new Error(`Missing upstream token: ${name}`);
      externalNames.add(name);
    }
  }
  const records = inspectCSSTokens(registry.families, documents, externalNames);
  for (const token of runtime) {
    const definition = records.find(record => record.name === token.name);
    if (definition && definition.family.type !== token.type) throw new Error(`Runtime/CSS type mismatch: ${token.name}`);
  }
  const registered = new Set([...documents.keys(), ...registry.generatedSources].map(path => resolve(root, path)));
  const graph = await productionGraph(root), reached = await reachableCSS(root, graph);
  const producerKeys = new Set();
  for (const producer of registry.dynamicProducers ?? []) {
    const owner = registry.owned.find(entry => entry.id === producer.contract);
    const key = `${producer.source}:${producer.expression}`;
    if (!owner?.sources.includes(producer.source) || producerKeys.has(key)
      || typeof producer.expression !== 'string' || !/^`--[a-z-]+\$\{[a-zA-Z]+\}`$/.test(producer.expression)
      || typeof producer.pattern !== 'string' || !producer.pattern.startsWith('^--') || !producer.pattern.endsWith('$')
      || !records.some(record => new RegExp(producer.pattern).test(record.name))) throw new Error('Invalid dynamic producer contract.');
    const inferred = inspectConsumerText(producer.expression, new Set(records.map(record => record.name)));
    const declared = records.filter(record => new RegExp(producer.pattern).test(record.name)).map(record => record.name).sort();
    if (JSON.stringify(inferred) !== JSON.stringify(declared)) throw new Error('Dynamic producer pattern does not match its output expression.');
    const code = await readFile(resolve(root, producer.source), 'utf8');
    if (code.split(producer.expression).length !== 2) throw new Error(`Stale dynamic producer contract: ${producer.source}`);
    producerKeys.add(key);
  }
  const optional = registry.optionalStylesheets ?? [];
  if (!Array.isArray(optional)) throw new Error('Invalid optional stylesheet entries.');
  const optionalPaths = new Set();
  for (const entry of optional) {
    if (!entry || typeof entry.source !== 'string' || !entry.source.endsWith('.css') || !documents.has(entry.source)
      || typeof entry.example !== 'string' || typeof entry.verification !== 'string'
      || !entry.example.endsWith('.tsx') || !entry.verification.endsWith('.browser.tsx')
      || optionalPaths.has(resolve(root, entry.source))) throw new Error('Invalid optional stylesheet entry.');
    for (const path of [entry.source, entry.example, entry.verification]) await checkSourcePath(resolve(root, path));
    if (reached.has(resolve(root, entry.source))) throw new Error(`Optional stylesheet is already production-reachable: ${entry.source}`);
    postcss.parse(documents.get(entry.source)).walkAtRules('import', rule => {
      const target = rule.params.match(/^["']([^"']+)["']/)?.[1];
      if (!target?.startsWith('.') || !registered.has(resolve(root, dirname(entry.source), target))) throw new Error(`Unregistered optional CSS import: ${entry.source} ${rule.params}`);
    });
    optionalPaths.add(resolve(root, entry.source));
  }
  const ownedSources = new Set(registry.owned.flatMap(entry => entry.sources).map(path => resolve(root, path)));
  for (const source of documents.keys()) if (!reached.has(resolve(root, source)) && !optionalPaths.has(resolve(root, source))) throw new Error(`Unreachable token CSS: ${source}`);
  for (const source of reached) if (!registered.has(source) && !ownedSources.has(source)) throw new Error(`Unowned production stylesheet: ${relative(root, source)}`);
  for (const entry of registry.runtimeSources) if (!graph.has(entry.source) && !(entry.format === 'swift-javascript' && /^apps\/apple\/Sources\/[^/]+\.swift$/.test(entry.source))) throw new Error(`Unreachable runtime token writer: ${entry.source}`);
  for (const directory of ['apps/ui/src', 'apps/ui/ui-next']) for (const path of await cssFiles(resolve(root, directory))) {
    if (reached.has(path) && !registered.has(path)) checkPublicPlacement(await readFile(path, 'utf8'), relative(root, path));
  }
  const portable = [];
  for (const entry of registry.portableSources) {
    await checkTokenConsumption({ tokenPath: resolve(root, entry.source), mappingPath: resolve(root, entry.consumption) });
    const tokens = JSON.parse(await readFile(resolve(root, entry.source), 'utf8'));
    const map = await readFile(resolve(root, entry.consumption), 'utf8');
    const states = new Map([...map.matchAll(/^\| `([^`]+)` \| (active|alias|baseline-only) \|/gm)].map(([, name, state]) => [name, state]));
    for (const [group, tokensInGroup] of Object.entries(tokens).filter(([name]) => !name.startsWith('$'))) {
      const metadata = entry.groups[group];
      if (!metadata || !categories.includes(metadata.category) || !layers.includes(metadata.layer)) throw new Error(`Unregistered portable group: ${group}`);
      covered.add(metadata.category);
      for (const [name, token] of Object.entries(tokensInGroup).filter(([name]) => !name.startsWith('$'))) portable.push({ name: `${group}.${name}`, category: metadata.category, type: token.$type ?? tokensInGroup.$type, status: states.get(`${group}.${name}`), value: typeof token.$value === 'string' ? token.$value : `${token.$value.value}${token.$value.unit}`, description: token.$description ?? '', source: entry.consumption });
    }
    for (const group of Object.keys(entry.groups)) if (!tokens[group]) throw new Error(`Empty portable group: ${group}`);
  }
  for (const category of categories) if (!covered.has(category)) throw new Error(`Uncovered token category: ${category}`);
  const consumption = await collectTokenConsumers({ root, registry, graph, reached, records, runtime, portable });
  for (const record of records.filter(record => record.family.status === 'reserved')) {
    for (const row of consumption.rows.filter(row => !documents.has(row.source))) {
      if ([...row.direct, ...row.utilities, ...row.styles].includes(record.name)) throw new Error(`Reserved token has a production consumer: ${record.name} ${row.source}`);
    }
  }
  const link = path => `[${path}](${relative(dirname(resolve(root, outputPath)), resolve(root, path)).split('\\').join('/')})`;
  const cell = value => String(value).replaceAll('|', '\\|').replace(/\s+/g, ' ');
  const lines = [
    '<!-- Generated from design/tokens/registry.json and owning sources. Run pnpm tokens:build; do not edit. -->',
    '# Token 覆盖清单', '',
    `登记 ${records.length} 个静态公开 CSS 名称、${runtime.length} 项 Web/原生运行时输出、${portable.length} 个可移植尺寸和 ${registry.owned.length} 项组件/平台/上游契约；另逐项登记 Base UI 的上游运行时变量。运行时输出包含对既有 CSS 字体默认值的覆盖，不按新名称重复计数。覆盖全部 ${categories.length} 类；登记状态与浏览器验收范围分别记录。`, '',
    '默认表达式来自该名称在权威 CSS 源中的首个声明，不是解析后的颜色或最终组件值；覆盖数包括不同 selector / 主题轴，按原始 CSS 优先级运行。完整定义和所有覆盖请读取源码。', '',
    '## 公开 CSS 定义', '',
    '| 名称 | 类别与层级 | 类型与状态 | 默认表达式 | 后续声明数 | 权威来源 |',
    '| --- | --- | --- | --- | ---: | --- |',
    ...records.map(record => `| \`${record.name}\` | ${record.family.category} / ${record.family.layer} | ${record.family.type} / ${record.family.status} | \`${cell(record.declarations[0].value)}\` | ${record.declarations.length - 1} | ${link(record.family.source)} |`), '',
    '## 可选 CSS 模块', '',
    '这些模块提供完整默认值和工具类接口，按需导入，不计作生产依赖图的既有消费者。必须显式登记示例与浏览器验证；未登记来源仍受导入可达性检查。', '',
    '| 入口 | 渲染示例 | 浏览器验证 |', '| --- | --- | --- |',
    ...optional.map(entry => `| ${link(entry.source)} | ${link(entry.example)} | ${link(entry.verification)} |`), '',
    '## 运行时输出（偏好与原生安全区）', '',
    'Web 偏好默认选项、校验和存储由 preferences 拥有；数值转换与派生公式由输出源码拥有。与静态 CSS 同名的字体项为明确的偏好覆盖。原生安全区由 WebView 的 scrollInsets 写入，消费端 CSS 以 0px 回退。检查静态字符串键和 setProperty 的字面量参数，Swift 只提取 callAsyncJavaScript 的普通字符串，不解释任意动态代码。', '',
    '| 名称 | 类型与单位 | 契约 | 默认或回退来源 | 输出与派生 |', '| --- | --- | --- | --- | --- |',
    ...runtime.map(token => `| \`${token.name}\` | ${token.type} / ${token.unit ?? '无单位'} | ${token.contract} | ${link(token.defaults)} | ${link(token.source)} |`), '',
    '## 上游运行时变量', '',
    'Base UI Positioner 提供浮层可用空间、锚点宽度与变换原点，不能当作全局固定默认值。逐项核对锁定安装包的声明；组件仅在 Positioner 后代作用域消费。', '',
    '| 名称 | 类型 | 契约 | 上游声明 |', '| --- | --- | --- | --- |',
    ...(registry.externalSources ?? []).flatMap(entry => Object.entries(entry.tokens).map(([name, token]) => `| \`${name}\` | ${token.type} | ${entry.contract} | ${link('apps/ui/package.json')} · \`${entry.source}\` |`)), '',
    '## 可移植尺寸', '',
    '每项的平台消费者与边界见链接中的逐项消费表；保留 alias 与 baseline-only，未将未消费基准标成生产接入。', '',
    '| 名称 | 类别 | 类型与状态 | 定义值或别名 | 平台消费 |',
    '| --- | --- | --- | --- | --- |',
    ...portable.map(token => `| \`${token.name}\` | ${token.category} | ${token.type} / ${token.status} | \`${token.value}\` | ${link(token.source)} |`), '',
    '## CSS 族的用途与消费', '',
    '| 契约 | 主题轴 | 用途 | 已登记消费入口 |', '| --- | --- | --- | --- |',
    ...registry.families.map(family => `| ${family.id} | ${family.axes.join(', ') || '固定'} | ${family.description} | ${family.consumers.map(link).join('<br>')} |`), '',
    '## 生产源码消费索引', '',
    `扫描 main.tsx 的 ${consumption.modules} 个可达模块、${consumption.stylesheets} 份可达 CSS 和全部 Apple Sources。以下是逐文件的直接引用、局部覆盖和由锁定 Tailwind 编译器解析的工具类变量依赖，包含产品变量、生成尺寸、上游定位变量及实际引用的 Tailwind 原始标尺；上游名称不计入前述产品静态定义数。主题源内部的别名引用也保留，以便追踪依赖链。样式类及模板的有界前后缀列出可能消费集合；原生 palette 的无界键由显式契约及测试核对。已内联为固定值的断点/度量继续由所有权契约登记。静态可达不等于每个运行分支都被执行。`, '',
    '| 来源 | 直接引用 | 工具类解析依赖 | 样式类依赖（可能集） | 同名定义或局部覆盖 |', '| --- | --- | --- | --- | --- |',
    ...consumption.rows.map(row => `| ${link(row.source)} | ${row.direct.map(name => `\`${name}\``).join(', ') || '—'} | ${row.utilities.map(name => `\`${name}\``).join(', ') || '—'} | ${row.styles.map(name => `\`${name}\``).join(', ') || '—'} | ${row.overrides.map(name => `\`${name}\``).join(', ') || '—'} |`), '',
    '| Apple 来源（含 DEBUG 预览） | 生成尺寸引用与 CSS 输出 |', '| --- | --- |',
    ...consumption.native.map(row => `| ${link(row.source)} | ${[...row.tokens, ...row.outputs].map(name => `\`${name}\``).join(', ')} |`), '',
    '## 组件 平台 与上游所有权', '',
    '| 契约 | 类别与类型 | 状态 | 当前规则 | 权威来源 | 验证或消费入口 |', '| --- | --- | --- | --- | --- | --- |',
    ...registry.owned.map(entry => `| ${entry.id} | ${entry.category} / ${entry.type} | ${entry.status} | ${entry.description} | ${entry.sources.map(link).join('<br>')} | ${entry.consumers.map(link).join('<br>')} |`), '',
    '生成检查覆盖名称归属、元数据、定义及消费者引用、默认/单独声明作用域的别名环、公开定义放置、生产 CSS 导入可达性与所有权、Web/原生运行时输出、上游变量、保留状态与消费索引漂移；不模拟完整 CSS cascade、全部运行分支、可访问性或真实设备。组合外观与组件行为另由浏览器验证。', '',
  ];
  const content = lines.join('\n'), destination = resolve(root, outputPath);
  let current;
  try { current = await readFile(destination, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (check && current !== content) throw new Error('Token coverage is stale. Run pnpm tokens:build.');
  if (!check && current !== content) await writeFile(destination, content);
  const catalog = JSON.stringify({
    version: registry.version,
    css: records.map(({ name, family, declarations }) => ({ name, ...family, declarations })),
    runtime, portable, owned: registry.owned, optionalStylesheets: optional,
    external: (registry.externalSources ?? []).flatMap(entry => Object.entries(entry.tokens).map(([name, metadata]) => ({ name, ...metadata, contract: entry.contract, source: entry.source }))),
  }, null, 2) + '\n';
  const catalogPath = destination.replace(/\.md$/, '.json');
  if (catalogPath === destination) throw new Error('Token coverage output must end in .md.');
  let currentCatalog;
  try { currentCatalog = await readFile(catalogPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (check && currentCatalog !== catalog) throw new Error('Storybook token catalog is stale. Run pnpm tokens:build.');
  if (!check && currentCatalog !== catalog) await writeFile(catalogPath, catalog);
  return { css: records.length, runtime: runtime.length, portable: portable.length, owned: registry.owned.length, categories: covered.size, consumerFiles: consumption.rows.length, nativeConsumerFiles: consumption.native.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(argument => argument !== '--check')) throw new Error('Usage: node scripts/build-token-catalog.mjs [--check]');
  console.log(`Token registry ${process.argv.includes('--check') ? 'checked' : 'generated'}: ${JSON.stringify(await buildTokenCatalog({ check: process.argv.includes('--check') }))}`);
}
