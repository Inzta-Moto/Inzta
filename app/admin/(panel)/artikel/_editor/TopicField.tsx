'use client';

import type { ArticleTopic, MotorCategory } from '@/types';
import { ARTICLE_TOPICS, topicLabel } from '@/lib/v2/article-v2';
import { CATEGORY_SLUGS } from '@/lib/v2/motor-category';
import { categoryLabel } from '@/lib/v2/home-content';

/**
 * F-016 D3, S6.8.5: article topic for the /blog tabs, and the motor categories. Part of the editor draft like showCover
 * (dirty check, autosave, local copies, save, 409). Not a publish check (S6.8.6); the checklist warns without a topic.
 * F-017: the categories can be ticked for every topic (the "Untuk motor Anda" box on article pages); the category
 * pages still list "Per motor" articles only. Clearing the topic clears the categories, as the API does.
 */
export default function TopicField({
  topik,
  kategoriMotor,
  onChange,
}: {
  topik: ArticleTopic | '';
  kategoriMotor: MotorCategory[];
  onChange: (topik: ArticleTopic | '', kategoriMotor: MotorCategory[]) => void;
}) {
  const toggle = (c: MotorCategory, on: boolean) =>
    onChange(topik, CATEGORY_SLUGS.filter(s => (s === c ? on : kategoriMotor.includes(s))));

  return (
    <section className="article-panel" aria-labelledby="panel-topik">
      <h2 className="article-panel-title" id="panel-topik">Topik</h2>
      <div className="form-group">
        <select
          id="article-topik"
          className="form-input"
          value={topik}
          aria-labelledby="panel-topik"
          aria-describedby="article-topik-help"
          onChange={e => {
            const next = e.target.value as ArticleTopic | '';
            onChange(next, next ? kategoriMotor : []);
          }}
        >
          <option value="">Tanpa topik</option>
          {ARTICLE_TOPICS.map(t => (
            <option key={t} value={t}>{topicLabel(t)}</option>
          ))}
        </select>
        <p className="article-editor-help" id="article-topik-help">
          Artikel baru memakai Adventure, Touring, atau Motocamp. Artikel tanpa topik hanya tampil di tab Semua.
        </p>
      </div>
      {topik && (
        <fieldset className="form-group" style={{ border: 0, padding: 0, margin: 0 }} aria-describedby="article-kategori-help">
          <legend className="form-label">Kategori motor{topik === 'per-motor' ? '' : ' (opsional)'}</legend>
          {CATEGORY_SLUGS.map(c => (
            <label key={c} className="article-editor-check">
              <input type="checkbox" checked={kategoriMotor.includes(c)} onChange={e => toggle(c, e.target.checked)} /> {categoryLabel(c)}
            </label>
          ))}
          <p className="article-editor-help" id="article-kategori-help">
            {topik === 'per-motor'
              ? 'Artikel tampil di halaman kategori motor yang dicentang.'
              : 'Artikel disarankan di kotak "Untuk motor Anda" bagi pengunjung yang memilih kategori ini.'}
          </p>
        </fieldset>
      )}
    </section>
  );
}
