export const dataRoles = [
  ["--data-categorical-blue", "fill-data-categorical-blue"],
  ["--data-categorical-orange", "fill-data-categorical-orange"],
  ["--data-categorical-purple", "fill-data-categorical-purple"],
  ["--data-categorical-green", "fill-data-categorical-green"],
  ["--data-categorical-pink", "fill-data-categorical-pink"],
  ["--data-categorical-cyan", "fill-data-categorical-cyan"],
  ["--data-categorical-red", "fill-data-categorical-red"],
  ["--data-categorical-teal", "fill-data-categorical-teal"],
  ["--data-categorical-brown", "fill-data-categorical-brown"],
  ["--data-categorical-indigo", "fill-data-categorical-indigo"],
  ["--data-neutral", "fill-data-neutral"],
  ["--data-blue-5", "fill-data-blue-5"],
  ["--data-blue-4", "fill-data-blue-4"],
  ["--data-blue-3", "fill-data-blue-3"],
  ["--data-blue-2", "fill-data-blue-2"],
  ["--data-blue-1", "fill-data-blue-1"],
  ["--data-shamrock-5", "fill-data-shamrock-5"],
  ["--data-shamrock-4", "fill-data-shamrock-4"],
  ["--data-shamrock-3", "fill-data-shamrock-3"],
  ["--data-shamrock-2", "fill-data-shamrock-2"],
  ["--data-shamrock-1", "fill-data-shamrock-1"],
  ["--data-orange-5", "fill-data-orange-5"],
  ["--data-orange-4", "fill-data-orange-4"],
  ["--data-orange-3", "fill-data-orange-3"],
  ["--data-orange-2", "fill-data-orange-2"],
  ["--data-orange-1", "fill-data-orange-1"],
  ["--data-pink-5", "fill-data-pink-5"],
  ["--data-pink-4", "fill-data-pink-4"],
  ["--data-pink-3", "fill-data-pink-3"],
  ["--data-pink-2", "fill-data-pink-2"],
  ["--data-pink-1", "fill-data-pink-1"],
  ["--data-purple-5", "fill-data-purple-5"],
  ["--data-purple-4", "fill-data-purple-4"],
  ["--data-purple-3", "fill-data-purple-3"],
  ["--data-purple-2", "fill-data-purple-2"],
  ["--data-purple-1", "fill-data-purple-1"],
  ["--data-red-5", "fill-data-red-5"],
  ["--data-red-4", "fill-data-red-4"],
  ["--data-red-3", "fill-data-red-3"],
  ["--data-red-2", "fill-data-red-2"],
  ["--data-red-1", "fill-data-red-1"],
  ["--data-teal-5", "fill-data-teal-5"],
  ["--data-teal-4", "fill-data-teal-4"],
  ["--data-teal-3", "fill-data-teal-3"],
  ["--data-teal-2", "fill-data-teal-2"],
  ["--data-teal-1", "fill-data-teal-1"],
  ["--data-yellow-5", "fill-data-yellow-5"],
  ["--data-yellow-4", "fill-data-yellow-4"],
  ["--data-yellow-3", "fill-data-yellow-3"],
  ["--data-yellow-2", "fill-data-yellow-2"],
  ["--data-yellow-1", "fill-data-yellow-1"],
  ["--data-gray-5", "fill-data-gray-5"],
  ["--data-gray-4", "fill-data-gray-4"],
  ["--data-gray-3", "fill-data-gray-3"],
  ["--data-gray-2", "fill-data-gray-2"],
  ["--data-gray-1", "fill-data-gray-1"],
] as const;

export const syntaxInks = [
  ["--syntax-keyword", "text-syntax-keyword"],
  ["--syntax-string", "text-syntax-string"],
  ["--syntax-comment", "text-syntax-comment"],
  ["--syntax-number", "text-syntax-number"],
  ["--syntax-function", "text-syntax-function"],
  ["--syntax-type", "text-syntax-type"],
  ["--syntax-variable", "text-syntax-variable"],
  ["--syntax-operator", "text-syntax-operator"],
  ["--syntax-constant", "text-syntax-constant"],
  ["--syntax-tag", "text-syntax-tag"],
  ["--syntax-attribute", "text-syntax-attribute"],
  ["--syntax-property", "text-syntax-property"],
  ["--syntax-punctuation", "text-syntax-punctuation"],
  ["--syntax-added-marker", "text-syntax-added-marker"],
  ["--syntax-removed-marker", "text-syntax-removed-marker"],
] as const;

export function DomainTokens() {
  return <main className="space-y-6 bg-body p-6 text-primary">
    <section aria-labelledby="domain-data-title">
      <h2 id="domain-data-title">数据配色</h2>
      <p>分类色用于区分系列，顺序色用于表达强度。示例数字和标签同时表达数据，颜色不单独承担信息。</p>
      <svg role="img" aria-label="十个分类系列的柱状图示例" viewBox="0 0 640 220" className="w-full max-w-2xl">
        {dataRoles.slice(0, 10).map(([name, className], index) => {
          const value = [62, 35, 81, 47, 93, 58, 72, 29, 67, 41][index];
          return <g key={name}>
            <rect data-data-role={name} className={className} x={index * 64 + 8} y={180 - value * 1.6} width={40} height={value * 1.6} />
            <text x={index * 64 + 28} y={172 - value * 1.6} textAnchor="middle" fill="currentColor">{value}</text>
            <text x={index * 64 + 28} y={205} textAnchor="middle" fill="currentColor">{index + 1}</text>
          </g>;
        })}
      </svg>
      <svg role="img" aria-label="中性与九组顺序色的强度色阶" viewBox="0 0 640 310" className="w-full max-w-2xl">
        {[5, 4, 3, 2, 1].map((level, index) => <text key={level} x={150 + index * 100} y={18} fill="currentColor">{level}</text>)}
        {dataRoles.slice(10).map(([name, className], index) => {
          const row = index === 0 ? 0 : 1 + Math.floor((index - 1) / 5), column = index === 0 ? 0 : (index - 1) % 5;
          return <g key={name}>
            {column === 0 && <text x={0} y={row * 28 + 48} fill="currentColor">{name.replace("--data-", "").replace(/-\d$/, "")}</text>}
            <rect data-data-role={name} className={className} x={120 + column * 100} y={row * 28 + 28} width={92} height={24} />
            <title>{name}</title>
          </g>;
        })}
      </svg>
    </section>
    <section aria-labelledby="domain-syntax-title">
      <h2 id="domain-syntax-title">代码与差异配色</h2>
      <p>这些角色供高亮器使用。当前笔记代码块保留普通文本，已接入背景角色。</p>
      <pre className="overflow-auto rounded-md bg-syntax-background p-4">
        <code className="text-syntax-variable">
          <span className="text-syntax-keyword">const</span>{" answer "}<span className="text-syntax-operator">=</span>{" "}<span className="text-syntax-number">42</span><span className="text-syntax-punctuation">;</span>{" "}<span className="text-syntax-comment">// 示例</span>{"\n"}
          <span className="text-syntax-function">print</span><span className="text-syntax-punctuation">(</span><span className="text-syntax-string">&quot;Hello&quot;</span><span className="text-syntax-punctuation">);</span>
        </code>
      </pre>
      <pre className="overflow-auto rounded-md bg-syntax-background p-4">
        <code className="text-syntax-variable">
          <span data-diff="header" className="block bg-syntax-diff-header">@@ line 1 @@</span>
          <span data-diff="removed" className="block bg-syntax-removed"><span className="text-syntax-removed-marker">−</span>{" const answer = 41;"}</span>
          <span data-diff="added" className="block bg-syntax-added"><span className="text-syntax-added-marker">+</span>{" const answer = 42;"}</span>
        </code>
      </pre>
      <div className="bg-syntax-background p-4">
        {syntaxInks.map(([name, className]) => <span key={name} data-syntax-role={name} className={`${className} mr-4 inline-block`}>{name.slice(9)}</span>)}
      </div>
    </section>
  </main>;
}
