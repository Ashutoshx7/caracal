/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Remark plugin that converts mermaid code blocks to client-renderable HTML before expressive-code processes them.
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function transformMermaidNodes(node) {
  if (!Array.isArray(node.children)) return
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    if (child.type === 'code' && child.lang === 'mermaid') {
      node.children[i] = {
        type: 'html',
        value: `<div class="mermaid-diagram"><pre class="mermaid">${escapeHtml(child.value)}</pre></div>`,
      }
    } else {
      transformMermaidNodes(child)
    }
  }
}

export function remarkMermaid() {
  return (tree) => transformMermaidNodes(tree)
}
