import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Bookmark,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Eye,
  FileCheck2,
  Flag,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserCheck,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { PortalRole, properties, roleMeta } from './data';

const navByRole = {
  user: [
    ['Overview', LayoutDashboard],
    ['Saved properties', Bookmark],
    ['My requirements', Search],
    ['Site visits', CalendarDays],
    ['Messages', MessageCircle],
  ],
  broker: [
    ['Overview', LayoutDashboard],
    ['My properties', Building2],
    ['Property Reels', Video],
    ['Leads', UsersRound],
    ['Site visits', CalendarDays],
  ],
  admin: [
    ['Overview', LayoutDashboard],
    ['Moderation', ShieldCheck],
    ['Properties', Building2],
    ['Users', UsersRound],
    ['Reports', Flag],
  ],
} as const;

const portalStats = {
  user: [
    ['Saved properties', '12', Bookmark],
    ['Matching homes', '38', Sparkles],
    ['Open enquiries', '4', MessageCircle],
    ['Upcoming visits', '2', CalendarDays],
  ],
  broker: [
    ['Active listings', '24', Building2],
    ['New leads', '18', UsersRound],
    ['Scheduled visits', '7', CalendarDays],
    ['Reel views', '42.8K', Eye],
  ],
  admin: [
    ['Total users', '18,420', UsersRound],
    ['Active properties', '8,462', Building2],
    ['Pending reviews', '36', Clock3],
    ['Monthly revenue', '₹18.4 L', CircleDollarSign],
  ],
} as const;

export default function PortalDashboard({ role }: { role: PortalRole }) {
  const [active, setActive] = useState('Overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [approved, setApproved] = useState<string[]>([]);
  const meta = roleMeta[role];
  const nav = navByRole[role];

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function logout() {
    window.localStorage.removeItem('ease-home-session');
    window.location.href = '/';
  }

  return (
    <main className={'dashboard-shell dashboard-' + role}>
      <aside className={sidebarOpen ? 'dashboard-sidebar open' : 'dashboard-sidebar'}>
        <div className="dashboard-logo-row">
          <Link className="brand" to="/"><span className="brand-mark"><Home size={17} /></span><span>EASE HOME</span></Link>
          <button className="icon-button close-sidebar" onClick={() => setSidebarOpen(false)}><X /></button>
        </div>
        <p className="portal-badge">{meta.label.toUpperCase()} PORTAL</p>
        <nav>
          {nav.map(([label, Icon]) => (
            <button key={label} className={active === label ? 'active' : ''} onClick={() => { setActive(label); setSidebarOpen(false); }}>
              <Icon size={18} /><span>{label}</span>{label === 'Messages' && <em>3</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-profile">
          <span>{role === 'admin' ? 'AS' : role === 'broker' ? 'RK' : 'AP'}</span>
          <div><strong>{role === 'admin' ? 'Anita S.' : role === 'broker' ? 'Ravi Kumar' : 'Arun Prakash'}</strong><small>{meta.demoEmail}</small></div>
          <button onClick={logout} aria-label="Log out"><LogOut size={16} /></button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <button className="icon-button dashboard-menu" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div><p>{active}</p><small>Thursday, 27 August 2026</small></div>
          <label className="dashboard-search"><Search size={16} /><input placeholder="Search portal" /></label>
          <button className="icon-button notification-button"><Bell size={18} /><i /></button>
          <button className="dashboard-avatar">{role === 'admin' ? 'AS' : role === 'broker' ? 'RK' : 'AP'}<ChevronDown size={14} /></button>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-welcome">
            <div><p className="eyebrow"><span /> {meta.label.toUpperCase()} WORKSPACE</p><h1>{role === 'admin' ? 'Good afternoon, Anita.' : role === 'broker' ? 'Welcome back, Ravi.' : 'Good afternoon, Arun.'}</h1><p>{role === 'admin' ? '36 listings and videos need a decision today.' : role === 'broker' ? 'Six new buyer enquiries arrived since yesterday.' : 'Four new properties match your Medavakkam requirement.'}</p></div>
            {role === 'user' && <Link to="/#search-marketplace" className="primary-button inline-button"><Search size={16} /> Find properties</Link>}
            {role === 'broker' && <button className="primary-button inline-button" onClick={() => notify('New property form opened')}><Plus size={16} /> Add property</button>}
            {role === 'admin' && <button className="primary-button inline-button" onClick={() => setActive('Moderation')}><ShieldCheck size={16} /> Review queue</button>}
          </div>

          <div className="stats-grid">
            {portalStats[role].map(([label, value, Icon], index) => (
              <article key={label}><span><Icon size={18} /></span><p>{label}</p><strong>{value}</strong><small className={index === 2 ? '' : 'positive'}>{index === 2 ? 'Needs attention' : '↑ 8.4% this month'}</small></article>
            ))}
          </div>

          {role === 'user' && <UserOverview notify={notify} />}
          {role === 'broker' && <BrokerOverview notify={notify} />}
          {role === 'admin' && <AdminOverview approved={approved} setApproved={setApproved} notify={notify} />}
        </div>
      </section>

      {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
    </main>
  );
}

function UserOverview({ notify }: { notify: (message: string) => void }) {
  return (
    <>
      <div className="dashboard-two-col">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><h2>Matched for you</h2><p>Based on your Medavakkam requirement</p></div><Link to="/#search-marketplace">View all <ArrowRight size={14} /></Link></div>
          <div className="dashboard-property-list">
            {properties.slice(0, 3).map((property) => (
              <article key={property.id}><img src={property.image} alt="" /><div><span>{property.verified && <BadgeCheck size={13} />} {property.seller}</span><h3>{property.title}</h3><p>{property.location} · {property.area}</p><strong>{property.price}</strong></div><button onClick={() => notify('Property saved')}><Heart size={18} /></button></article>
            ))}
          </div>
        </section>
        <section className="dashboard-panel timeline-panel">
          <div className="panel-heading"><div><h2>Your next steps</h2><p>From shortlisted to site visit</p></div></div>
          <ol>
            <li className="done"><span><Check /></span><div><strong>Requirement posted</strong><small>2 BHK · ₹50–60 L · Medavakkam</small></div></li>
            <li className="done"><span><Check /></span><div><strong>18 properties matched</strong><small>Last updated 2 hours ago</small></div></li>
            <li className="current"><span><CalendarDays /></span><div><strong>Site visit this Saturday</strong><small>10:30 AM · Skyline Residences</small></div></li>
            <li><span><FileCheck2 /></span><div><strong>Legal verification</strong><small>Available after property selection</small></div></li>
          </ol>
        </section>
      </div>
      <section className="dashboard-panel upcoming-strip"><div><span><CalendarDays /></span><div><small>UPCOMING SITE VISIT</small><h3>Skyline Residences · Medavakkam</h3><p>Saturday, 29 August · 10:30 AM · Confirmed by seller</p></div></div><button className="outline-button">View details</button></section>
    </>
  );
}

function BrokerOverview({ notify }: { notify: (message: string) => void }) {
  const leads = [
    ['Arun Prakash', 'Skyline Residences', 'New', 'Today, 10:14'],
    ['Meena Ravi', 'Porur Grandeur Plots', 'Site visit', 'Today, 09:42'],
    ['S. Karthik', 'ECR Tropical Villa', 'Follow-up', 'Yesterday'],
    ['Priya N.', 'Ambattur Classique', 'Interested', 'Yesterday'],
  ];
  return (
    <div className="dashboard-two-col broker-cols">
      <section className="dashboard-panel">
        <div className="panel-heading"><div><h2>Lead pipeline</h2><p>18 active enquiries across your listings</p></div><button onClick={() => notify('Lead report exported')}>Export</button></div>
        <div className="pipeline"><span><i style={{ width: '28%' }} />New <strong>6</strong></span><span><i style={{ width: '48%' }} />Contacted <strong>5</strong></span><span><i style={{ width: '66%' }} />Interested <strong>4</strong></span><span><i style={{ width: '84%' }} />Visit planned <strong>2</strong></span><span><i style={{ width: '100%' }} />Negotiation <strong>1</strong></span></div>
        <div className="lead-list">{leads.map((lead) => <article key={lead[0]}><span className="avatar">{lead[0].split(' ').map((item) => item[0]).join('').slice(0, 2)}</span><div><strong>{lead[0]}</strong><small>{lead[1]}</small></div><em>{lead[2]}</em><time>{lead[3]}</time><button><ArrowRight size={15} /></button></article>)}</div>
      </section>
      <section className="dashboard-panel">
        <div className="panel-heading"><div><h2>Listing performance</h2><p>Views, saves and enquiries this month</p></div></div>
        <div className="mini-chart"><span style={{ height: '35%' }} /><span style={{ height: '52%' }} /><span style={{ height: '46%' }} /><span style={{ height: '72%' }} /><span style={{ height: '64%' }} /><span style={{ height: '91%' }} /><span style={{ height: '78%' }} /></div>
        <div className="performance-kpis"><div><strong>42.8K</strong><small>Reel views</small></div><div><strong>1,284</strong><small>Property saves</small></div><div><strong>218</strong><small>Enquiries</small></div></div>
        <button className="outline-button full-button" onClick={() => notify('Performance report opened')}><BarChart3 size={16} /> View full analytics</button>
      </section>
    </div>
  );
}

function AdminOverview({ approved, setApproved, notify }: { approved: string[]; setApproved: (value: string[]) => void; notify: (message: string) => void }) {
  const queue = [
    ['EH-4821', 'Lakeview 3 BHK', 'Builder', 'Property', '12 min ago'],
    ['EH-4820', 'OMR Plots Reel', 'Broker', 'Video', '24 min ago'],
    ['EH-4819', 'Green Acres Phase 2', 'Builder', 'Property', '41 min ago'],
    ['EH-4818', 'R. Mahendran KYC', 'Broker', 'Account', '1 hr ago'],
  ];
  function approve(id: string) {
    setApproved([...approved, id]);
    notify(id + ' approved and published');
  }
  return (
    <>
      <div className="dashboard-two-col admin-cols">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><h2>Moderation queue</h2><p>Properties, videos and account verification</p></div><button><SlidersHorizontal size={15} /> Filter</button></div>
          <div className="admin-table">
            <div className="table-row table-head"><span>ID</span><span>Submission</span><span>Type</span><span>Received</span><span>Action</span></div>
            {queue.map((item) => <div className={'table-row ' + (approved.includes(item[0]) ? 'approved-row' : '')} key={item[0]}><span>{item[0]}</span><span><strong>{item[1]}</strong><small>{item[2]}</small></span><span>{item[3]}</span><span>{item[4]}</span><span>{approved.includes(item[0]) ? <em><Check size={13} /> Approved</em> : <><button onClick={() => approve(item[0])}>Approve</button><button onClick={() => notify(item[0] + ' opened for review')}>Review</button></>}</span></div>)}
          </div>
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading"><div><h2>Marketplace health</h2><p>Last 30 days</p></div></div>
          <div className="health-score"><span>94<small>/100</small></span><div><strong>Excellent</strong><p>Trust and response metrics are above target.</p></div></div>
          <ul className="health-list"><li><span><UserCheck /> Verified users</span><strong>91%</strong></li><li><span><BadgeCheck /> Verified listings</span><strong>86%</strong></li><li><span><Clock3 /> Median response</span><strong>18 min</strong></li><li><span><Flag /> Fraud reports</span><strong className="warning">7 open</strong></li></ul>
        </section>
      </div>
      <section className="dashboard-panel trend-panel"><div><small>SEARCH TREND</small><h3>Medavakkam is up 28% this week</h3><p>Most searched: 2 BHK · Below ₹60 L · Ready to move</p></div><div className="trend-bars"><span style={{ height: '30%' }} /><span style={{ height: '42%' }} /><span style={{ height: '38%' }} /><span style={{ height: '55%' }} /><span style={{ height: '64%' }} /><span style={{ height: '71%' }} /><span style={{ height: '92%' }} /></div><button className="outline-button"><TrendingUp size={15} /> View search analytics</button></section>
    </>
  );
}
