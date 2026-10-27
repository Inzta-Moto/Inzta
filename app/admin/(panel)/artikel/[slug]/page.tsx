'use client';

import ArticleEditor from '../_editor/ArticleEditor';

export default function EditArticlePage({ params }: { params: { slug: string } }) {
  // key: a rename replaces the route, and the editor must start fresh for the new slug.
  return <ArticleEditor key={params.slug} slug={decodeURIComponent(params.slug)} />;
}
