'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { FeedbackKind, WarrantyProductOption } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { WARRANTY_COPY } from '@/lib/warranty/copy';
import { FEEDBACK_KINDS, PRODUCT_OTHER, charLength, validateFeedbackInput } from '@/lib/warranty/rules';
import { trackWarrantyEvent } from '@/lib/tracking';
import { WhatsApp } from '@/components/v2/icons';
import { ChipGroup, Field, describedBy, focusFirstError, submitJson, useFormToken } from '@/components/v2/warranty/form-kit';

// F-031 feedback form (requirements 10.1–10.5): its own fields, submit, and success message; no photos in release 1.
// Feedback is never shown publicly (10.5).

const F = WARRANTY_COPY.feedback;
const S = WARRANTY_COPY.feedbackSuccess;
const ERR = WARRANTY_COPY.errors;
const ID = 'mk';

interface Values {
  kind: FeedbackKind | '';
  message: string;
  product: string;
  productOther: string;
  name: string;
  whatsapp: string;
  consent: boolean;
}

const EMPTY: Values = { kind: '', message: '', product: '', productOther: '', name: '', whatsapp: '', consent: false };

export default function FeedbackForm({ products }: { products: WarrantyProductOption[] }) {
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ref: string; contact: boolean } | null>(null);
  const [trap, setTrap] = useState('');
  const { token, renew } = useFormToken();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const productNames = useMemo(() => Object.fromEntries(products.map(p => [p.slug, p.name])), [products]);

  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV(cur => ({ ...cur, [k]: val }));
    if (errors[k as string]) setErrors(e => ({ ...e, [k as string]: '' }));
  };
  const err = (k: string) => errors[k] || undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const body = {
      kind: v.kind,
      message: v.message,
      product: v.product,
      productOther: v.product === PRODUCT_OTHER ? v.productOther : undefined,
      name: v.name,
      whatsapp: v.whatsapp,
      consent: v.consent,
      formToken: token,
      trap,
    };
    const local = validateFeedbackInput(body, { productNames });
    if (!local.ok) {
      setErrors(local.errors);
      setFormError(ERR.summary);
      requestAnimationFrame(() => focusFirstError(formRef.current, local.errors, ID));
      return;
    }
    setSubmitting(true);
    const out = await submitJson('/api/masukan', body, 'ref');
    setSubmitting(false);
    if (out.kind === 'ok') {
      trackWarrantyEvent('feedback_submit');
      setDone({ ref: out.id, contact: Boolean(local.value.whatsapp) });
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

  if (done) {
    return (
      <section className="iz-gr-success" aria-labelledby="mk-success-title">
        <h3 className="iz-gr-formtitle" id="mk-success-title" tabIndex={-1} ref={successRef}>
          {S.title}
        </h3>
        <p className="iz-gr-ticket">
          <span>{S.refLabel}</span>
          <strong>{done.ref}</strong>
        </p>
        {done.contact && <p>{S.contact}</p>}
        <div className="iz-gr-actions">
          <a className="iz-btn iz-btn--secondary" href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer">
            <WhatsApp width={20} height={20} />
            <span>{S.chat}</span>
          </a>
          <button
            type="button"
            className="iz-gr-textbtn"
            onClick={() => {
              setV(EMPTY);
              setDone(null);
              renew();
            }}
          >
            {S.again}
          </button>
        </div>
      </section>
    );
  }

  return (
    <form ref={formRef} className="iz-gr-form" noValidate onSubmit={onSubmit} aria-label={F.sectionTitle}>
      <div className="iz-gr-trap" aria-hidden="true">
        <label htmlFor="mk-trap">Jangan diisi</label>
        <input id="mk-trap" name="trap" type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} />
      </div>
      <ChipGroup id={`${ID}-kind`} legend={F.kind} error={err('kind')} options={FEEDBACK_KINDS.map(k => ({ value: k, label: WARRANTY_COPY.options.feedbackKind[k] }))} value={v.kind} onChange={k => set('kind', k)} />
      <Field id={`${ID}-message`} label={F.message} hint={F.messageHint} error={err('message')} counter={`${charLength(v.message.trim())}/1000`}>
        <textarea id={`${ID}-message`} className="iz-gr-input iz-gr-textarea" rows={5} maxLength={1200} value={v.message} onChange={e => set('message', e.target.value)} aria-invalid={Boolean(err('message'))} aria-describedby={describedBy(`${ID}-message`, true, err('message'))} />
      </Field>
      <div className="iz-gr-pair">
        <Field id={`${ID}-product`} label={F.product} error={err('product')} optional>
          <select id={`${ID}-product`} className="iz-gr-input iz-gr-select" value={v.product} onChange={e => set('product', e.target.value)} aria-invalid={Boolean(err('product'))} aria-describedby={describedBy(`${ID}-product`, false, err('product'))}>
            <option value="">{F.productNone}</option>
            {products.map(p => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
            <option value={PRODUCT_OTHER}>{WARRANTY_COPY.claim.productOther}</option>
          </select>
        </Field>
        {v.product === PRODUCT_OTHER ? (
          <Field id={`${ID}-productOther`} label={F.productOtherName} error={err('productOther')}>
            <input id={`${ID}-productOther`} className="iz-gr-input" type="text" maxLength={120} value={v.productOther} onChange={e => set('productOther', e.target.value)} aria-invalid={Boolean(err('productOther'))} aria-describedby={describedBy(`${ID}-productOther`, false, err('productOther'))} />
          </Field>
        ) : (
          <span />
        )}
      </div>
      <div className="iz-gr-pair">
        <Field id={`${ID}-name`} label={F.name} error={err('name')} optional>
          <input id={`${ID}-name`} className="iz-gr-input" type="text" autoComplete="name" maxLength={120} value={v.name} onChange={e => set('name', e.target.value)} aria-invalid={Boolean(err('name'))} aria-describedby={describedBy(`${ID}-name`, false, err('name'))} />
        </Field>
        <Field id={`${ID}-whatsapp`} label={F.whatsapp} hint={F.whatsappHint} error={err('whatsapp')} optional>
          <input id={`${ID}-whatsapp`} className="iz-gr-input" type="tel" inputMode="tel" autoComplete="tel" maxLength={24} value={v.whatsapp} onChange={e => set('whatsapp', e.target.value)} aria-invalid={Boolean(err('whatsapp'))} aria-describedby={describedBy(`${ID}-whatsapp`, true, err('whatsapp'))} />
        </Field>
      </div>
      <div className="iz-gr-field" data-invalid={err('consent') ? '' : undefined}>
        <label className="iz-gr-check">
          <input id={`${ID}-consent`} type="checkbox" checked={v.consent} onChange={e => set('consent', e.target.checked)} aria-invalid={Boolean(err('consent'))} aria-describedby={describedBy(`${ID}-consent`, false, err('consent'))} />
          <span>
            {F.consent} <Link href="/kebijakan-privasi#masukan">{WARRANTY_COPY.claim.consentLink}</Link>
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
        <button className="iz-btn iz-btn--primary iz-gr-submitbtn" type="submit" disabled={submitting}>
          {submitting ? F.submitting : F.submit}
        </button>
      </div>
    </form>
  );
}
