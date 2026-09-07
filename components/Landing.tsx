'use client';

import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Bookmark,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  FileCheck2,
  Heart,
  Home,
  KeyRound,
  Landmark,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Play,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareStack,
  UserRound,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { properties, Property } from './data';

type ViewMode = 'list' | 'map' | 'video';

function Logo() {
  return (
    <Link className="brand" href="#top" aria-label="EASE HOME home">
      <span className="brand-mark"><Home size={18} strokeWidth={2.4} /></span>
      <span>EASE HOME</span>
    </Link>
  );
}

function Modal({ children, onClose, labelledBy }: { children: React.ReactNode; onClose: () => void; labelledBy: string }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        {children}
      </section>
    </div>
  );
}

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [purpose, setPurpose] = useState<'Buy' | 'Rent'>('Buy');
  const [query, setQuery] = useState('Chennai');
  const [type, setType] = useState('All');
  const [budget, setBudget] = useState('Any budget');
  const [view, setView] = useState<ViewMode>('list');
  const [saved, setSaved] = useState<string[]>(['porur-grandeur-plots']);
  const [liked, setLiked] = useState<string[]>([]);
  const [compared, setCompared] = useState<string[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const [visitProperty, setVisitProperty] = useState<Property | null>(null);
  const [visitSent, setVisitSent] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    const budgetLimit = budget === 'Below ₹60 L' ? 60 : budget === 'Below ₹1 Cr' ? 100 : Number.POSITIVE_INFINITY;
    return properties.filter((property) => {
      const queryMatch = !search || property.location.toLowerCase().includes(search) || property.locality.toLowerCase().includes(search);
      const purposeMatch = property.purpose === purpose;
      const typeMatch = type === 'All' || property.type === type;
      return queryMatch && purposeMatch && typeMatch && property.priceValue <= budgetLimit;
    });
  }, [budget, purpose, query, type]);

  function runSearch(event: FormEvent) {
    event.preventDefault();
    setSearchMessage('Showing ' + results.length + ' matching ' + (results.length === 1 ? 'property' : 'properties'));
    document.getElementById('search-marketplace')?.scrollIntoView({ behavior: 'smooth' });
  }

  function toggle(list: string[], setList: (value: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function submitVisit(event: FormEvent) {
    event.preventDefault();
    setVisitSent(true);
  }

  return (
    <main>
      <header className="site-header">
        <Logo />
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a className="active" href="#top">Home</a>
          <a href="#reels">Reels</a>
          <a href="#search-marketplace">Search</a>
          <a href="#post">Post</a>
          <a href="#services">Services</a>
        </nav>
        <div className="header-actions">
          <button className="header-link" type="button" aria-label="Notifications"><Bell size={18} /></button>
          <Link className="text-button" href="/login/broker">Post property</Link>
          <button className="primary-button compact" type="button" onClick={() => setLoginOpen(true)}>Sign in <ChevronDown size={15} /></button>
          <button className="icon-button mobile-menu-button" type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu /></button>
        </div>
      </header>

      {mobileOpen && (
        <aside className="mobile-drawer">
          <div><Logo /><button className="icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button></div>
          <nav>
            {['Home', 'Reels', 'Search', 'Post', 'Services'].map((item) => (
              <a key={item} onClick={() => setMobileOpen(false)} href={item === 'Home' ? '#top' : '#' + (item === 'Search' ? 'search-marketplace' : item.toLowerCase())}>{item}<ArrowRight size={17} /></a>
            ))}
          </nav>
          <button className="primary-button" onClick={() => { setMobileOpen(false); setLoginOpen(true); }}>Choose your portal</button>
        </aside>
      )}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> VIDEO-FIRST REAL ESTATE</p>
          <h1>Find a place that<br /><em>feels like yours.</em></h1>
          <p className="hero-lede">Watch verified property tours, compare every detail and book a site visit—without jumping between apps.</p>
          <form className="search-card" onSubmit={runSearch}>
            <div className="search-tabs" role="tablist" aria-label="Property purpose">
              {(['Buy', 'Rent'] as const).map((item) => (
                <button key={item} className={purpose === item ? 'selected' : ''} onClick={() => setPurpose(item)} type="button">{item}</button>
              ))}
            </div>
            <label><span>LOCATION</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search location" /></label>
            <label className="type-field"><span>PROPERTY TYPE</span><select aria-label="Property type" value={type} onChange={(event) => setType(event.target.value)}><option>All</option><option>Apartment</option><option>Villa</option><option>Plot / Land</option><option>Commercial</option></select></label>
            <button className="search-button" type="submit" aria-label="Search properties"><Search size={22} /></button>
          </form>
          <p className="form-notice" role="status">{searchMessage}</p>
          <div className="trust-row"><div><strong>8,400+</strong><span>verified listings</span></div><div><strong>1,200+</strong><span>video tours</span></div><div><strong>4.8/5</strong><span>buyer rating</span></div></div>
        </div>

        <div className="hero-visual">
          <div className="video-frame">
            <img src={properties[0].image} alt="Modern residential apartment towers" />
            <span className="reel-chip"><Video size={12} /> PROPERTY REEL</span>
            <button className="play-button" type="button" aria-label="Play featured property reel" onClick={() => document.getElementById('reels')?.scrollIntoView({ behavior: 'smooth' })}><Play size={24} fill="currentColor" /></button>
            <div className="reel-info">
              <span className="verified"><BadgeCheck size={13} /> EASE VERIFIED</span><h2>{properties[0].title}</h2><p><MapPin size={13} /> {properties[0].location}</p>
              <div><strong>{properties[0].price}</strong><button type="button" onClick={() => setSelected(properties[0])}>View property <ArrowRight size={14} /></button></div>
            </div>
          </div>
          <div className="floating-note"><span><CalendarDays size={17} /></span><div><strong>Site visit confirmed</strong><small>Saturday · 10:30 AM</small></div></div>
          <div className="floating-card"><strong>12</strong><span>matching Reels</span><button type="button" onClick={() => document.getElementById('reels')?.scrollIntoView({ behavior: 'smooth' })}>Watch now</button></div>
        </div>
      </section>

      <section className="journey-strip" aria-label="EASE HOME journey">
        {['Watch', 'Discover', 'Details', 'Connect', 'Site visit', 'Verify', 'Loan', 'Register'].map((step, index) => <span key={step}>{step}{index < 7 && <ArrowRight size={14} />}</span>)}
      </section>

      <section className="reels-section" id="reels">
        <div className="section-heading"><div><p className="eyebrow"><span /> DISCOVER IN MOTION</p><h2>Scroll less. <em>See more.</em></h2></div><p>Every Reel opens into a complete listing with price, approval, seller identity and the next action.</p></div>
        <div className="reel-grid">
          {properties.slice(0, 3).map((property, index) => (
            <article className={'reel-card reel-' + (index + 1)} key={property.id}>
              <img src={property.image} alt={property.title} /><div className="reel-shade" />
              <div className="reel-top"><span><Video size={12} /> 00:{20 + index * 7}</span>{property.verified && <span><BadgeCheck size={12} /> Verified</span>}</div>
              <button className="reel-main-play" type="button" aria-label={'Play reel for ' + property.title}><Play size={23} fill="currentColor" /></button>
              <div className="reel-actions">
                <button onClick={() => toggle(liked, setLiked, property.id)} className={liked.includes(property.id) ? 'is-active' : ''} aria-label="Like reel"><Heart size={19} fill={liked.includes(property.id) ? 'currentColor' : 'none'} /></button>
                <button onClick={() => toggle(saved, setSaved, property.id)} className={saved.includes(property.id) ? 'is-active' : ''} aria-label="Save reel"><Bookmark size={19} fill={saved.includes(property.id) ? 'currentColor' : 'none'} /></button>
                <button aria-label="Share reel"><Share2 size={19} /></button>
              </div>
              <div className="reel-bottom"><span>{property.seller} · {property.location}</span><h3>{property.title}</h3><p>{property.price} <small>· {property.area}</small></p><button onClick={() => setSelected(property)} type="button">View property <ArrowRight size={14} /></button></div>
            </article>
          ))}
          <div className="reel-explainer">
            <span className="round-icon"><Sparkles size={20} /></span><h3>Reels that answer real questions.</h3>
            <ul><li><Check /> Linked to structured property data</li><li><Check /> Searchable by location and budget</li><li><Check /> One tap to enquire or book a visit</li></ul>
            <button className="outline-button" onClick={() => { setView('video'); document.getElementById('search-marketplace')?.scrollIntoView({ behavior: 'smooth' }); }}>Watch matching properties <ArrowRight size={15} /></button>
          </div>
        </div>
      </section>

      <section className="marketplace" id="search-marketplace">
        <div className="section-heading compact-heading"><div><p className="eyebrow"><span /> MARKETPLACE</p><h2>Search with <em>clarity.</em></h2></div><p>Use structured filters, then switch the exact same results into video discovery.</p></div>
        <div className="filter-bar">
          <label><MapPin size={16} /><input aria-label="Filter by location" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label><Building2 size={16} /><select aria-label="Filter by property type" value={type} onChange={(event) => setType(event.target.value)}><option>All</option><option>Apartment</option><option>Villa</option><option>Plot / Land</option><option>Commercial</option></select></label>
          <label><CircleDollarSign size={16} /><select aria-label="Filter by budget" value={budget} onChange={(event) => setBudget(event.target.value)}><option>Any budget</option><option>Below ₹60 L</option><option>Below ₹1 Cr</option></select></label>
          <button className="filter-more" type="button"><SlidersHorizontal size={16} /> More filters</button><button className="primary-button" type="button" onClick={() => setSearchMessage(String(results.length) + ' refined matches')}>Show {results.length} results</button>
        </div>
        <div className="results-toolbar">
          <p><strong>{results.length}</strong> properties in {query || 'all locations'}</p>
          <div className="view-switcher" aria-label="Results view"><button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><SquareStack size={16} /> List</button><button className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}><Map size={16} /> Map</button><button className={view === 'video' ? 'selected' : ''} onClick={() => setView('video')}><Play size={16} /> Reels</button></div>
        </div>

        {view === 'map' ? (
          <div className="map-view">
            <div className="map-grid" aria-label="Map preview">{results.map((property, index) => <button className="map-pin-button" key={property.id} style={{ left: String(18 + index * 13) + '%', top: String(25 + (index % 3) * 23) + '%' }} onClick={() => setSelected(property)}>{property.price}</button>)}</div>
            <aside className="map-list">{results.map((property) => <article key={property.id}><img src={property.image} alt="" /><div><h3>{property.title}</h3><p>{property.location}</p><strong>{property.price}</strong></div></article>)}</aside>
          </div>
        ) : view === 'video' ? (
          <div className="matching-reels">
            <div><Play size={24} fill="currentColor" /><span>WATCH MATCHING PROPERTIES</span><strong>{results.length} Reels filtered to your search</strong></div>
            {results.slice(0, 3).map((property) => <button key={property.id} onClick={() => setSelected(property)}><img src={property.image} alt="" /><span>{property.price}<small>{property.location}</small></span><Play fill="currentColor" /></button>)}
          </div>
        ) : (
          <div className="property-grid">
            {results.length ? results.map((property) => (
              <article className="property-card" key={property.id}>
                <div className="property-image"><img src={property.image} alt={property.title} /><span>{property.verified ? <><BadgeCheck size={12} /> EASE VERIFIED</> : property.seller.toUpperCase()}</span><button className={saved.includes(property.id) ? 'is-active' : ''} aria-label={'Save ' + property.title} onClick={() => toggle(saved, setSaved, property.id)}><Bookmark size={18} fill={saved.includes(property.id) ? 'currentColor' : 'none'} /></button></div>
                <div className="property-body"><div><strong>{property.price}</strong><label><input type="checkbox" checked={compared.includes(property.id)} onChange={() => toggle(compared, setCompared, property.id)} /> Compare</label></div><h3>{property.title}</h3><p><MapPin size={13} /> {property.location}</p><small>{(property.bhk ? String(property.bhk) + ' BHK · ' : '') + property.area + ' · ' + property.status}</small><button type="button" onClick={() => setSelected(property)}>View details <ArrowRight size={14} /></button></div>
              </article>
            )) : <div className="empty-state"><Search /><h3>No exact matches yet</h3><p>Try Chennai, choose any property type or remove the budget limit.</p><button className="outline-button" onClick={() => { setQuery('Chennai'); setType('All'); setBudget('Any budget'); setPurpose('Buy'); }}>Reset filters</button></div>}
          </div>
        )}
      </section>

      {compared.length > 0 && <div className="compare-bar"><span><SquareStack size={18} /><strong>{compared.length}</strong> selected for comparison</span><div><button onClick={() => setCompared([])}>Clear</button><button className="primary-button" disabled={compared.length < 2}>Compare properties</button></div></div>}

      <section className="post-section" id="post">
        <div><p className="eyebrow"><span /> BUYER REQUIREMENTS</p><h2>Tell the market<br /><em>what you need.</em></h2><p>Post one clear requirement and let verified owners, brokers and builders respond with relevant matches.</p><Link className="primary-button inline-button" href="/login/user">Post your requirement <ArrowRight size={16} /></Link></div>
        <div className="requirement-card"><div><span className="avatar">AR</span><p><strong>Arun R.</strong><small>Buyer · Chennai</small></p><span className="match-chip">18 matches</span></div><h3>Looking for a ready-to-move 2 BHK in Medavakkam</h3><div className="requirement-meta"><span>₹50–60 L</span><span>2 BHK</span><span>Owner preferred</span><span>Ready to move</span></div><div className="requirement-journey"><span><Check /> Posted</span><i /><span><Sparkles /> Matched</span><i /><span><MessageCircle /> Connect</span><i /><span><CalendarDays /> Visit</span></div></div>
      </section>

      <section className="services-section" id="services">
        <div className="section-heading compact-heading"><div><p className="eyebrow"><span /> END-TO-END SUPPORT</p><h2>From interest to <em>ownership.</em></h2></div><p>Move forward with verified professional partners for the complex parts of a property decision.</p></div>
        <div className="service-grid"><article><span><FileCheck2 /></span><small>LEGAL SUPPORT</small><h3>Verify before you commit.</h3><p>Title opinion, EC verification, document review and agreement support.</p><button>Explore legal help <ArrowRight size={15} /></button></article><article><span><Landmark /></span><small>LOAN SUPPORT</small><h3>Understand what you can finance.</h3><p>Eligibility checks and guided support for home, plot and construction loans.</p><button>Check eligibility <ArrowRight size={15} /></button></article><article><span><KeyRound /></span><small>REGISTRATION</small><h3>Close with confidence.</h3><p>Document preparation, registration guidance and transaction assistance.</p><button>Get registration help <ArrowRight size={15} /></button></article></div>
      </section>

      <section className="portal-section">
        <div><p className="eyebrow"><span /> SEPARATE ROLE PORTALS</p><h2>One marketplace.<br /><em>Three focused views.</em></h2><p>Each portal keeps the right actions simple while sharing the same verified listings, enquiries and site-visit workflow.</p></div>
        <div className="portal-grid"><Link href="/login/user"><span><UserRound /></span><small>USER PORTAL</small><h3>Discover, save & visit</h3><p>Search, Reels, requirements, enquiries and visits.</p><ArrowRight /></Link><Link href="/login/broker"><span><UsersRound /></span><small>BROKER PORTAL</small><h3>List, promote & follow up</h3><p>Properties, Reel publishing, leads and visit schedules.</p><ArrowRight /></Link><Link href="/login/admin"><span><ShieldCheck /></span><small>ADMIN PORTAL</small><h3>Review, verify & grow</h3><p>Moderation, users, analytics, reports and approvals.</p><ArrowRight /></Link></div>
      </section>

      <footer><div><Logo /><p>Video-first property discovery backed by serious real estate information.</p></div><div><strong>Explore</strong><a href="#reels">Property Reels</a><a href="#search-marketplace">Search</a><a href="#services">Services</a></div><div><strong>Portals</strong><Link href="/login/user">User login</Link><Link href="/login/broker">Broker login</Link><Link href="/login/admin">Admin login</Link></div><div><strong>Trust</strong><span>Verified listings</span><span>Report fraud</span><span>Privacy & safety</span></div><p>© 2026 EASE HOME. Discover. Search. Connect. Visit. Verify. Finance. Register.</p></footer>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation"><a href="#top"><Home /><span>Home</span></a><a href="#reels"><Play /><span>Reels</span></a><a href="#search-marketplace"><Search /><span>Search</span></a><Link href="/login/broker"><Building2 /><span>Post</span></Link><button onClick={() => setLoginOpen(true)}><UserRound /><span>Profile</span></button></nav>

      {loginOpen && <Modal onClose={() => setLoginOpen(false)} labelledBy="portal-choice-title"><div className="portal-modal"><p className="eyebrow"><span /> SIGN IN</p><h2 id="portal-choice-title">Choose your portal</h2><p>Each role opens a workspace designed around its next actions.</p><div className="portal-choice-grid"><Link href="/login/user"><UserRound /><span><strong>User portal</strong><small>Buyers, owners and renters</small></span><ArrowRight /></Link><Link href="/login/broker"><UsersRound /><span><strong>Broker portal</strong><small>Listings, leads and visits</small></span><ArrowRight /></Link><Link href="/login/admin"><ShieldCheck /><span><strong>Admin portal</strong><small>Moderation and platform control</small></span><ArrowRight /></Link></div></div></Modal>}

      {selected && <Modal onClose={() => setSelected(null)} labelledBy="property-modal-title"><div className="property-modal"><img src={selected.image} alt={selected.title} /><div className="property-modal-content">{selected.verified && <span className="verified-dark"><BadgeCheck size={14} /> EASE VERIFIED</span>}<h2 id="property-modal-title">{selected.title}</h2><p className="location-line"><MapPin size={15} /> {selected.location}</p><strong className="modal-price">{selected.price}</strong><div className="spec-row"><span>{selected.type}</span><span>{selected.bhk ? String(selected.bhk) + ' BHK' : selected.area}</span><span>{selected.area}</span><span>{selected.status}</span></div><p>{selected.description}</p><div className="approval-box"><ShieldCheck /><span><strong>{selected.approval}</strong><small>{selected.rera ? 'RERA: ' + selected.rera : 'Verification documents available'}</small></span></div><div className="amenity-row">{selected.amenities.map((amenity) => <span key={amenity}><Check size={13} /> {amenity}</span>)}</div><div className="property-actions"><button className="outline-button"><MessageCircle size={16} /> Enquire</button><button className="primary-button" onClick={() => { setVisitProperty(selected); setSelected(null); setVisitSent(false); }}><CalendarDays size={16} /> Book site visit</button></div></div></div></Modal>}

      {visitProperty && <Modal onClose={() => setVisitProperty(null)} labelledBy="visit-title">{visitSent ? <div className="success-state"><span><Check /></span><h2 id="visit-title">Visit request sent</h2><p>The seller will confirm your preferred slot. We’ll notify you in the User portal.</p><button className="primary-button" onClick={() => setVisitProperty(null)}>Done</button></div> : <form className="visit-form" onSubmit={submitVisit}><p className="eyebrow"><span /> SITE VISIT</p><h2 id="visit-title">See it in person.</h2><p>{visitProperty.title}<br /><small>{visitProperty.location}</small></p><label><span>PREFERRED DATE</span><input required type="date" defaultValue="2026-08-29" /></label><label><span>PREFERRED SLOT</span><select defaultValue="10:30 AM – 12:00 PM"><option>10:30 AM – 12:00 PM</option><option>2:00 PM – 3:30 PM</option><option>4:30 PM – 6:00 PM</option></select></label><label><span>MOBILE NUMBER</span><input required type="tel" placeholder="+91 98765 43210" /></label><button className="primary-button" type="submit">Request site visit <ArrowRight size={15} /></button></form>}</Modal>}
    </main>
  );
}
