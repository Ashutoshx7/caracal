/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Static Markdown endpoint for each documentation page.
 */

import type { APIRoute, GetStaticPaths } from 'astro'
import { getCollection } from 'astro:content'

const site = 'https://docs.caracal.run'

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await getCollection('docs')

  return docs
    .filter((doc) => doc.id !== '404')
    .map((doc) => ({
      params: { slug: doc.id },
      props: { doc },
    }))
}

export const GET: APIRoute = ({ props }) => {
  return new Response(formatPage(props.doc), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}

function formatPage(doc: Awaited<ReturnType<typeof getCollection<'docs'>>>[number]) {
  const data = doc.data as Record<string, unknown>
  const canonicalUrl = doc.id === 'index' ? `${site}/` : `${site}/${doc.id}/`
  const lines = [
    `# ${doc.data.title}`,
    '',
    `Canonical URL: ${canonicalUrl}`,
    `Description: ${doc.data.description}`,
    `Page type: ${(data.pageType as string | undefined) ?? 'page'}`,
    `Concepts: ${((data.concepts as string[] | undefined) ?? []).join(', ') || 'none'}`,
    `Requires: ${((data.requires as string[] | undefined) ?? []).join(', ') || 'none'}`,
    '',
    '---',
    '',
    doc.body ?? '',
    '',
  ]

  return lines.join('\n')
}
