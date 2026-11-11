'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { WarrantyChannel, WarrantyDamage, WarrantyPhoto, WarrantyProductOption, WarrantyUsage } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { WARRANTY_COPY } from '@/lib/warranty/copy';
import { ACCEPTED_PHOTO_MIME, CHANNELS, DAMAGES, MAX_PHOTOS, PRODUCT_OTHER, USAGES, charLength, isOutsidePeriod, photoFileError, validateClaimInput, waLink, wibDate } from '@/lib/warranty/rules';
import { trackWarrantyEvent } from '@/lib/tracking';
import { WhatsApp } from '@/components/v2/icons';
import { ChipGroup, Field, describedBy, focusFirstError, submitJson, useCopy, useDraft, useFormToken } from '@/components/v2/warranty/form-kit';
import { UploadError, uploadWarrantyPhoto } from '@/components/v2/warranty/photo-upload';

// F-031 claim form (requirements 2.2–2.8): client checks with the same rules as the server, photos compressed and
// uploaded one by one with a signature, submit locked while an upload runs, errors next to the field with focus on the
// first, a text draft in sessionStorage, and the success panel with the ticket and the WhatsApp video button.

const C = WARRANTY_COPY.claim;
const S = WARRANTY_COPY.claimSuccess;
const O = WARRANTY_COPY.options;
const ERR = WARRANTY_COPY.errors;
const ID = 'gr';
const DRAFT_KEY = 'inzta.garansi.draft';

interface Values {
  name: string;
  whatsapp: string;
  location: string;
  product: string;
  productOther: string;
  channel: WarrantyChannel | '';
  purchaseDate: string;
  orderRef: string;
  usage: WarrantyUsage | '';
  damage: WarrantyDamage[];
  description: string;
  videoViaWhatsApp: boolean;
  consent: boolean;
}

const EMPTY: Values = { name: '', whatsapp: '', location: '', product: '', productOther: '', channel: '', purchaseDate: '', orderRef: '', usage: '', damage: [], description: '', videoViaWhatsApp: false, consent: false };

interface PhotoItem {
  key: number;
  name: string;
  preview: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  result?: WarrantyPhoto;
  error?: string;
  file: File;
  abort: AbortController;
}

const opts = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map(v => ({ value: v, label: labels[v] }));

export default function ClaimForm({ products }: { products: WarrantyProductOption[] }) {
  const [v, setV] = useState<Values>(EMPTY);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ticket: string; video: boolean } | null>(null);
  const [announce, setAnnounce] = useState('');
  const [trap, setTrap] = useState('');
  const { token, renew } = useFormToken();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);
  const keySeq = useRef(0);
  const productNames = useMemo(() => Object.fromEntries(products.map(p => [p.slug, p.name])), [products]);

  const clearDraft = useDraft(DRAFT_KEY, { ...v, consent: false }, d => setV(cur => ({ ...cur, ...sanitizeDraft(d) })), !done);

  // Object URLs of the previews are released when the form goes away.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach(p => URL.revokeObjectURL(p.preview)), []);

  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV(cur => ({ ...cur, [k]: val }));
    if (errors[k as string]) setErrors(e => ({ ...e, [k as string]: '' }));
  };

  const uploading = photos.some(p => p.status === 'uploading');
  const outside = v.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(v.purchaseDate) ? isOutsidePeriod(v.purchaseDate, Date.now()) : false;

  const startUpload = (item: PhotoItem, n: number) => {
    setAnnounce(C.photoUploading(n, 0));
    uploadWarrantyPhoto(
      item.file,
      token,
      pct => setPhotos(ps => ps.map(p => (p.key === item.key ? { ...p, progress: pct } : p))),
      item.abort.signal,
    )
      .then(result => {
        setPhotos(ps => ps.map(p => (p.key === item.key ? { ...p, status: 'done', progress: 100, result } : p)));
        setAnnounce(C.photoDone(n));
      })
      .catch((e: unknown) => {
        if (item.abort.signal.aborted) return;
        const msg = e instanceof UploadError ? e.message : ERR.photoUpload;
        setPhotos(ps => ps.map(p => (p.key === item.key ? { ...p, status: 'error', error: msg } : p)));
        setAnnounce(`${C.photoFailed(n)}. ${msg}`);
      });
  };

  const onPick = (files: FileList | null) => {
    if (!files || !files.length) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = [...files];
    const refused = picked.map(f => photoFileError(f)).find(Boolean);
    const ok = picked.filter(f => !photoFileError(f)).slice(0, Math.max(0, room));
    const msg = refused || (picked.filter(f => !photoFileError(f)).length > room ? ERR.photosTooMany : '');
    setErrors(e => ({ ...e, photos: msg || '' }));
    const items: PhotoItem[] = ok.map(file => ({ key: ++keySeq.current, name: file.name, preview: URL.createObjectURL(file), status: 'uploading', progress: 0, file, abort: new AbortController() }));
    setPhotos(ps => [...ps, ...items]);
    items.forEach((it, i) => startUpload(it, photos.length + i + 1));
  };

  const removePhoto = (key: number) => {
    setPhotos(ps => {
      const p = ps.find(x => x.key === key);
      if (p) {
        p.abort.abort();
        URL.revokeObjectURL(p.preview);
      }
      return ps.filter(x => x.key !== key);
    });
  };

  const retryPhoto = (key: number) => {
    const idx = photos.findIndex(p => p.key === key);
    const p = photos[idx];
    if (!p) return;
    const fresh = { ...p, status: 'uploading' as const, progress: 0, error: undefined, abort: new AbortController() };
    setPhotos(ps => ps.map(x => (x.key === key ? fresh : x)));
    startUpload(fresh, idx + 1);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || uploading) return;
    setFormError('');
    const body = {
      name: v.name,
      whatsapp: v.whatsapp,
      location: v.location,
      product: v.product,
      productOther: v.product === PRODUCT_OTHER ? v.productOther : undefined,
      channel: v.channel,
      purchaseDate: v.purchaseDate || null,
      orderRef: v.orderRef.trim() || null,
      usage: v.usage,
      damage: v.damage,
      description: v.description,
      photos: photos.filter(p => p.status === 'done' && p.result).map(p => p.result as WarrantyPhoto),
      videoViaWhatsApp: v.videoViaWhatsApp,
      consent: v.consent,
      formToken: token,
      trap,
    };
    const local = validateClaimInput(body, { now: Date.now(), productNames });
    const fields: Record<string, string> = local.ok ? {} : { ...local.errors };
    if (photos.some(p => p.status === 'error')) fields.photos = ERR.photosInvalid;
    if (Object.keys(fields).length) {
      setErrors(fields);
      setFormError(ERR.summary);
      requestAnimationFrame(() => focusFirstError(formRef.current, fields, ID));
      return;
    }
    setSubmitting(true);
    const out = await submitJson('/api/garansi', body, 'ticket');
    setSubmitting(false);
    if (out.kind === 'ok') {
      clearDraft();
      trackWarrantyEvent('warranty_claim_submit');
      setDone({ ticket: out.id, video: v.videoViaWhatsApp });
      return;
    }
    if (out.kind === 'fields') {
      setErrors(out.fields);
      setFormError(ERR.summary);
      requestAnimationFrame(() => focusFirstError(formRef.current, out.fields, ID));
      return;
    }
    if (out.renew) renew();
    setFormError(out.message);
  };

  if (done) return <ClaimSuccess ticket={done.ticket} video={done.video} headingRef={successRef} />;

  const productOptions = [...products.map(p => ({ value: p.slug, label: p.name })), { value: PRODUCT_OTHER, label: C.productOther }];
  const err = (k: string) => errors[k] || undefined;

  return (
    <form
      ref={formRef}
      className="iz-gr-form"
      noValidate
      onSubmit={onSubmit}
      onFocusCapture={() => {
        if (started.current) return;
        started.current = true;
        trackWarrantyEvent('warranty_claim_start');
      }}
      aria-labelledby="gr-form-title"
    >
      <h2 className="iz-gr-formtitle" id="gr-form-title">
        {C.sectionTitle}
      </h2>
      {/* Honeypot (3.3): off screen, out of the tab order, ignored by autofill. */}
      <div className="iz-gr-trap" aria-hidden="true">
        <label htmlFor="gr-trap">Jangan diisi</label>
        <input id="gr-trap" name="trap" type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} />
      </div>

      <div className="iz-gr-group">
        <h3 className="iz-gr-grouptitle">{C.groupYou}</h3>
        <Field id={`${ID}-name`} label={C.name} error={err('name')}>
          <input id={`${ID}-name`} className="iz-gr-input" type="text" autoComplete="name" maxLength={120} value={v.name} onChange={e => set('name', e.target.value)} aria-invalid={Boolean(err('name'))} aria-describedby={describedBy(`${ID}-name`, false, err('name'))} />
        </Field>
        <Field id={`${ID}-whatsapp`} label={C.whatsapp} hint={C.whatsappHint} error={err('whatsapp')}>
          <input id={`${ID}-whatsapp`} className="iz-gr-input" type="tel" inputMode="tel" autoComplete="tel" maxLength={24} value={v.whatsapp} onChange={e => set('whatsapp', e.target.value)} aria-invalid={Boolean(err('whatsapp'))} aria-describedby={describedBy(`${ID}-whatsapp`, true, err('whatsapp'))} />
        </Field>
        <Field id={`${ID}-location`} label={C.location} error={err('location')}>
          <input id={`${ID}-location`} className="iz-gr-input" type="text" autoComplete="address-level2" maxLength={120} value={v.location} onChange={e => set('location', e.target.value)} aria-invalid={Boolean(err('location'))} aria-describedby={describedBy(`${ID}-location`, false, err('location'))} />
        </Field>
      </div>

      <div className="iz-gr-group">
        <h3 className="iz-gr-grouptitle">{C.groupProduct}</h3>
        <Field id={`${ID}-product`} label={C.product} error={err('product')}>
          <select id={`${ID}-product`} className="iz-gr-input iz-gr-select" value={v.product} onChange={e => set('product', e.target.value)} aria-invalid={Boolean(err('product'))} aria-describedby={describedBy(`${ID}-product`, false, err('product'))}>
            <option value="">{C.productPlaceholder}</option>
            {productOptions.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {v.product === PRODUCT_OTHER && (
          <Field id={`${ID}-productOther`} label={C.productOtherName} error={err('productOther')}>
            <input id={`${ID}-productOther`} className="iz-gr-input" type="text" maxLength={120} value={v.productOther} onChange={e => set('productOther', e.target.value)} aria-invalid={Boolean(err('productOther'))} aria-describedby={describedBy(`${ID}-productOther`, false, err('productOther'))} />
          </Field>
        )}
        <ChipGroup id={`${ID}-channel`} legend={C.channel} error={err('channel')} options={opts(CHANNELS, O.channel)} value={v.channel} onChange={c => set('channel', c)} />
        <div className="iz-gr-pair">
          <Field id={`${ID}-purchaseDate`} label={C.purchaseDate} hint={C.purchaseDateHint} error={err('purchaseDate')} optional>
            <input id={`${ID}-purchaseDate`} className="iz-gr-input" type="date" min="2020-01-01" max={wibDate(Date.now())} value={v.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} aria-invalid={Boolean(err('purchaseDate'))} aria-describedby={describedBy(`${ID}-purchaseDate`, true, err('purchaseDate'))} />
            {outside && !err('purchaseDate') && (
              <p className="iz-gr-note" role="status">
                {C.outsidePeriodHint}
              </p>
            )}
          </Field>
          <Field id={`${ID}-orderRef`} label={C.orderRef} hint={C.orderRefHint} error={err('orderRef')} optional>
            <input id={`${ID}-orderRef`} className="iz-gr-input" type="text" maxLength={40} autoComplete="off" value={v.orderRef} onChange={e => set('orderRef', e.target.value)} aria-invalid={Boolean(err('orderRef'))} aria-describedby={describedBy(`${ID}-orderRef`, true, err('orderRef'))} />
          </Field>
        </div>
        <ChipGroup id={`${ID}-usage`} legend={C.usage} error={err('usage')} options={opts(USAGES, O.usage)} value={v.usage} onChange={u => set('usage', u)} />
      </div>

      <div className="iz-gr-group">
        <h3 className="iz-gr-grouptitle">{C.groupProblem}</h3>
        <ChipGroup
          id={`${ID}-damage`}
          legend={C.damage}
          hint={C.damageHint}
          error={err('damage')}
          options={opts(DAMAGES, O.damage)}
          value={v.damage}
          multiple
          optional
          onChange={d => set('damage', v.damage.includes(d) ? v.damage.filter(x => x !== d) : [...v.damage, d])}
        />
        <Field id={`${ID}-description`} label={C.description} hint={C.descriptionHint} error={err('description')} counter={`${charLength(v.description.trim())}/2000`}>
          <textarea id={`${ID}-description`} className="iz-gr-input iz-gr-textarea" rows={5} maxLength={2400} value={v.description} onChange={e => set('description', e.target.value)} aria-invalid={Boolean(err('description'))} aria-describedby={describedBy(`${ID}-description`, true, err('description'))} />
        </Field>

        <fieldset className="iz-gr-field" id={`${ID}-photos`} tabIndex={-1} aria-describedby={describedBy(`${ID}-photos`, true, err('photos'))} data-invalid={err('photos') ? '' : undefined}>
          <legend className="iz-gr-label">{C.photos}</legend>
          <p className="iz-gr-hint" id={`${ID}-photos-hint`}>
            {C.photosHint}
          </p>
          <ul className="iz-gr-photos">
            {photos.map((p, i) => (
              <li key={p.key} className="iz-gr-photo" data-status={p.status}>
                <img src={p.preview} alt="" width={96} height={96} />
                <div className="iz-gr-photo__meta">
                  <span className="iz-gr-photo__name">{p.name}</span>
                  {p.status === 'uploading' && (
                    <span className="iz-gr-bar" role="progressbar" aria-label={`Foto ${i + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.progress}>
                      <span style={{ width: `${p.progress}%` }} />
                    </span>
                  )}
                  {p.status === 'done' && <span className="iz-gr-photo__ok">{C.photoDone(i + 1)}</span>}
                  {p.status === 'error' && (
                    <span className="iz-gr-err">
                      {p.error}{' '}
                      <button type="button" className="iz-gr-textbtn" onClick={() => retryPhoto(p.key)}>
                        {C.photoRetry}
                      </button>
                    </span>
                  )}
                </div>
                <button type="button" className="iz-gr-remove" aria-label={C.photoRemove(i + 1)} onClick={() => removePhoto(p.key)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          {photos.length < MAX_PHOTOS && (
            <label className="iz-gr-add">
              <input className="iz-sr" type="file" accept={ACCEPTED_PHOTO_MIME} multiple onChange={e => { onPick(e.target.files); e.target.value = ''; }} />
              <span aria-hidden="true">+</span> {C.photosAdd} ({photos.length}/{MAX_PHOTOS})
            </label>
          )}
          {err('photos') && (
            <p className="iz-gr-err" id={`${ID}-photos-err`}>
              {err('photos')}
            </p>
          )}
          <p className="iz-sr" aria-live="polite">
            {announce}
          </p>
        </fieldset>

        <div className="iz-gr-field">
          <label className="iz-gr-check">
            <input type="checkbox" checked={v.videoViaWhatsApp} onChange={e => set('videoViaWhatsApp', e.target.checked)} aria-describedby={`${ID}-video-hint`} />
            <span>{C.video}</span>
          </label>
          <p className="iz-gr-hint" id={`${ID}-video-hint`}>
            {C.videoHint}
          </p>
        </div>
      </div>

      <div className="iz-gr-field" data-invalid={err('consent') ? '' : undefined}>
        <label className="iz-gr-check">
          <input id={`${ID}-consent`} type="checkbox" checked={v.consent} onChange={e => set('consent', e.target.checked)} aria-invalid={Boolean(err('consent'))} aria-describedby={describedBy(`${ID}-consent`, false, err('consent'))} />
          <span>
            {C.consent} <Link href="/kebijakan-privasi#garansi">{C.consentLink}</Link>
          </span>
        </label>
        {err('consent') && (
          <p className="iz-gr-err" id={`${ID}-consent-err`}>
            {err('consent')}
          </p>
        )}
      </div>

      <div className="iz-gr-submit">
        <p className="iz-gr-formerr" role="alert">
          {formError}
        </p>
        <button className="iz-btn iz-btn--primary iz-gr-submitbtn" type="submit" disabled={submitting || uploading} aria-describedby={uploading ? `${ID}-wait` : undefined}>
          {submitting ? C.submitting : C.submit}
        </button>
        {uploading && (
          <p className="iz-gr-hint" id={`${ID}-wait`}>
            {C.waitUpload}
          </p>
        )}
      </div>
    </form>
  );
}

function sanitizeDraft(d: Partial<Values>): Partial<Values> {
  const out: Partial<Values> = {};
  for (const k of ['name', 'whatsapp', 'location', 'product', 'productOther', 'purchaseDate', 'orderRef', 'description'] as const) if (typeof d[k] === 'string') out[k] = d[k] as string;
  if (typeof d.channel === 'string' && (CHANNELS as readonly string[]).includes(d.channel)) out.channel = d.channel as WarrantyChannel;
  if (typeof d.usage === 'string' && (USAGES as readonly string[]).includes(d.usage)) out.usage = d.usage as WarrantyUsage;
  if (Array.isArray(d.damage)) out.damage = DAMAGES.filter(x => (d.damage as unknown[]).includes(x));
  if (typeof d.videoViaWhatsApp === 'boolean') out.videoViaWhatsApp = d.videoViaWhatsApp;
  return out;
}

function ClaimSuccess({ ticket, video, headingRef }: { ticket: string; video: boolean; headingRef: React.RefObject<HTMLHeadingElement> }) {
  const { copied, copy } = useCopy();
  return (
    <section className="iz-gr-success" aria-labelledby="gr-success-title">
      <h2 className="iz-gr-formtitle" id="gr-success-title" tabIndex={-1} ref={headingRef}>
        {S.title}
      </h2>
      <p className="iz-gr-ticket">
        <span>{S.ticketLabel}</span>
        <strong>{ticket}</strong>
      </p>
      <button type="button" className="iz-btn iz-btn--secondary iz-gr-copy" onClick={() => copy(ticket)}>
        {S.copy}
      </button>
      <p className="iz-sr" aria-live="polite">
        {copied ? S.copied : ''}
      </p>
      {copied && <p className="iz-gr-note" aria-hidden="true">{S.copied}</p>}
      <p>{S.keep}</p>
      <p>{S.next}</p>
      <div className="iz-gr-actions">
        {video && (
          <a className="iz-btn iz-btn--primary iz-btn--wa" href={waLink(WA_NUMBER, S.videoMessage(ticket))} target="_blank" rel="noopener noreferrer">
            <span className="iz-btn__icon">
              <WhatsApp />
            </span>
            <span>{S.video}</span>
          </a>
        )}
        <a className={`iz-btn ${video ? 'iz-btn--secondary' : 'iz-btn--primary iz-btn--wa'}`} href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer">
          {!video && (
            <span className="iz-btn__icon">
              <WhatsApp />
            </span>
          )}
          <span>{S.chat}</span>
        </a>
      </div>
    </section>
  );
}
