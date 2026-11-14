import type { Metadata } from 'next';
import Link from 'next/link';
import type { ProductCard as ProductCardData } from '@nait/db';

import '@/styles/home.css';

import { Announcement } from '@/components/Announcement';
import { ProductCard } from '@/components/ProductCard';
import { StyleNote } from '@/components/StyleNote';
import { Glyph } from '@/components/SvgDefs';
import { Film } from '@/home/Film';
import { CollectionDoors } from '@/home/CollectionDoors';
import { FlaconTurn } from '@/home/FlaconTurn';
import { LoopVideo } from '@/home/HeroVideo';
import { NotesStack, type NoteText } from '@/home/NotesStack';
import { ReadPerfume, type StageText } from '@/home/ReadPerfume';
import { LOCALE_INFO, dirOf } from '@/i18n/config';
import { collectionName, getSettings, listCollections, listProducts } from '@/lib/data';
import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';

// Featured products show live stock: rendered on request, never at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[lang]'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, description: t('meta.desc') });
}

/** A few families from each collection in turn, so the selection shows the range of the house. */
function pickFeatured(products: ProductCardData[], order: string[], count: number): ProductCardData[] {
  const queues = order.map((slug) => products.filter((product) => product.collectionSlug === slug && product.inStock));
  const picked: ProductCardData[] = [];
  while (picked.length < count && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && picked.length < count) picked.push(next);
    }
  }
  return picked;
}

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang, t } = await pageContext(params);
  const [collections, products, settings] = await Promise.all([listCollections(), listProducts(), getSettings()]);
  const featured = pickFeatured(
    products,
    collections.map((collection) => collection.slug),
    8,
  );
  const collectionNames = new Map(collections.map((collection) => [collection.slug, collectionName(collection, lang, t)]));
  const to = (path = '') => localePath(lang, path);
  const side = dirOf(lang) === 'rtl' ? '-rtl' : '';

  const notes: NoteText[] = (['rose', 'blossom', 'cedar', 'amber', 'oud'] as const).map((key) => ({
    key,
    name: t(`${key}.name`),
    place: t(`${key}.place`),
    text: t(`${key}.text`),
  }));
  const stages: StageText[] = (['top', 'heart', 'base'] as const).map((key) => ({
    key,
    name: t(`${key}.name`),
    time: t(`${key}.time`),
    text: t(`${key}.text`),
  }));

  return (
    <>
      <section className="hero" id="top">
        {/* The house flacon, rendered for each theme; the picture's background is the section's own.
            Right-to-left pages get the picture with the flacon on the left (never a mirrored one: the logo is printed on it). */}
        <div className="hero__art" aria-hidden="true">
          {(['light', 'dark'] as const).map((mode) => (
            <picture key={mode} className={`hero__pic hero__pic--${mode}`}>
              <source media="(max-width: 899px)" type="image/webp" srcSet={`/media/flacon/hero-${mode}-portrait.webp`} />
              <source type="image/webp" srcSet={`/media/flacon/hero-${mode}${side}.webp`} />
              <img
                src={`/media/flacon/hero-${mode}${side}.jpg`}
                alt=""
                width={2000}
                height={1300}
                loading={mode === 'light' ? 'eager' : 'lazy'}
                fetchPriority={mode === 'light' ? 'high' : 'auto'}
                decoding="async"
              />
            </picture>
          ))}
          <FlaconTurn />
        </div>
        <div className="wrap hero__in">
          <h1 className="hero__lead">{t('hero.lead')}</h1>
          <p className="hero__sub">{t('hero.sub')}</p>
          <div className="hero__cta">
            <Link className="btn" href={to('/collections')}>
              {t('hero.cta')}
            </Link>
            <a className="tlink" href="#nom">
              {t('hero.cta2')}
            </a>
          </div>
        </div>
      </section>

      <Announcement text={settings.announcement} />

      {/* the name */}
      <section className="ch name" id="nom">
        <div className="wrap name__grid">
          <div className="name__viz">
            <div className="name__row" dir="ltr">
              <figure className="grp">
                <div className="grp__g" aria-hidden="true">
                  <Glyph name="n" className="foil" />
                </div>
                <figcaption>{t('ch1.n')}</figcaption>
              </figure>
              <figure className="grp">
                <div className="grp__g" aria-hidden="true">
                  <Glyph name="a" className="foil" />
                  <Glyph name="y" className="foil" />
                  <Glyph name="t" className="foil" />
                </div>
                <figcaption>{t('ch1.ayt')}</figcaption>
              </figure>
            </div>
            <p className="name__legend">{t('ch1.legend')}</p>
          </div>
          <div className="name__txt">
            <h2>{t('ch1.title')}</h2>
            {/* These three texts come from our own dictionaries; p1 and p2 carry <em> markup. */}
            <p dangerouslySetInnerHTML={{ __html: t('ch1.p1') }} />
            <p dangerouslySetInnerHTML={{ __html: t('ch1.p2') }} />
            <p>{t('ch1.p3')}</p>
          </div>
        </div>
      </section>

      {/* five notes */}
      <section className="notes" id="notes">
        <div className="wrap">
          <div className="ch__head">
            <h2>{t('ch2.title')}</h2>
            <p className="lede">{t('ch2.intro')}</p>
          </div>
        </div>
        <NotesStack notes={notes} />
        <p className="wrap notes__outro">
          <span>{t('ch2.outro')}</span>
          <Link className="tlink" href={to('/collections/arabisant')}>
            {t('col.see')}
          </Link>
        </p>
      </section>

      {/* the film */}
      <section className="ch film onyx" id="film">
        <div className="wrap">
          <div className="ch__head">
            <h2>{t('film.title')}</h2>
            <p className="lede">{t('film.sub')}</p>
          </div>
          <Film
            cut={LOCALE_INFO[lang].film}
            texts={{
              captions: [t('film.c1'), t('film.c2'), t('film.c3'), t('film.c4'), t('film.c5')],
              play: t('film.play'),
              pause: t('film.pause'),
              soundOn: t('film.soundOn'),
              soundOff: t('film.soundOff'),
              voice: t('film.voice'),
            }}
          />
        </div>
      </section>

      {/* reading a perfume */}
      <section className="ch read" id="lire">
        <ReadPerfume
          title={t('ch3.title')}
          intro={t('ch3.intro')}
          spray={t('ch3.spray')}
          sizes={t('ch3.sizes')}
          tip={t('ch3.tip')}
          stages={stages}
        />
      </section>

      {/* the collections */}
      <section className="ch col" id="collections">
        <div className="wrap">
          <div className="ch__head">
            <h2>{t('ch4.title')}</h2>
            <p className="lede">{t('ch4.intro')}</p>
          </div>
          <CollectionDoors
            doors={collections.map((collection) => ({
              slug: collection.slug,
              name: collectionName(collection, lang, t),
              count: collection.productCount > 0 ? t('fmt.families', { n: collection.productCount }) : t('card.soon'),
              href: to(`/collections/${collection.slug}`),
            }))}
          />
          {featured.length > 0 ? (
            <>
              <div className="grid">
                {featured.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    lang={lang}
                    t={t}
                    collection={collectionNames.get(product.collectionSlug)}
                  />
                ))}
              </div>
              <StyleNote t={t} />
              <p className="col__more">
                <Link className="btn" href={to('/collections')}>
                  {t('nav.allCollections')}
                </Link>
              </p>
            </>
          ) : null}
        </div>
      </section>

      {/* how ordering works */}
      <section className="ch online" id="en-ligne">
        <div className="wrap">
          <div className="ch__head">
            <h2>{t('ch5.title')}</h2>
            <p className="lede">{t('ch5.intro')}</p>
          </div>
          <ol className="steps">
            {(['s1', 's2', 's3', 's4'] as const).map((key, index) => (
              <li className="step" key={key}>
                <span className="step__n" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="step__t">{t(`${key}.t`)}</h3>
                <p className="step__d">{t(`${key}.d`)}</p>
              </li>
            ))}
          </ol>
          <p className="online__returns">
            {t('ch5.returns')}{' '}
            <Link className="tlink" href={to('/retours')}>
              {t('ch5.returnsLink')}
            </Link>
          </p>
          <div className="cta cham">
            <LoopVideo src="/media/amber.mp4" poster="/media/amber.jpg" />
            <h2>{t('cta.title')}</h2>
            <Link className="btn btn--dark" href={to('/collections')}>
              {t('cta.btn')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
