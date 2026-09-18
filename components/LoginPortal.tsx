import { ArrowLeft, ArrowRight, BadgeCheck, Eye, EyeOff, Home, KeyRound, LockKeyhole, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import { PortalRole, roleMeta } from './data';

const roleIcons = { user: UserRound, broker: UsersRound, admin: ShieldCheck };

export default function LoginPortal({ role }: { role: PortalRole }) {
  const meta = roleMeta[role];
  const Icon = roleIcons[role];
  const [email, setEmail] = useState<string>(meta.demoEmail);
  const [password, setPassword] = useState<string>(meta.demoPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email || password.length < 6) {
      setError('Enter a valid email and password.');
      return;
    }
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, portal: role }),
      });
      const result = await response.json() as {
        message?: string;
        token?: string;
        user?: { id: string; name: string; email: string; roles: PortalRole[] };
      };

      if (!response.ok || !result.token || !result.user) {
        throw new Error(result.message ?? 'Unable to sign in. Please try again.');
      }

      window.localStorage.setItem('ease-home-session', JSON.stringify({
        token: result.token,
        user: result.user,
        role,
        issuedAt: Date.now(),
      }));
      window.location.href = '/portal/' + role;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
      setBusy(false);
    }
  }

  return (
    <main className={'login-layout role-' + role}>
      <section className="login-brand-panel">
        <Link className="brand light-brand" to="/">
          <span className="brand-mark"><Home size={18} /></span><span>EASE HOME</span>
        </Link>
        <div>
          <span className="login-role-icon"><Icon /></span>
          <p className="eyebrow light-eyebrow"><span /> {meta.label.toUpperCase()} PORTAL</p>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
          <div className="login-assurances">
            <span><BadgeCheck /> Role-based access</span>
            <span><LockKeyhole /> Secure account data</span>
            <span><KeyRound /> Verified marketplace actions</span>
          </div>
        </div>
        <p>Discover · Search · Connect · Visit · Verify</p>
      </section>

      <section className="login-form-panel">
        <Link className="back-link" to="/"><ArrowLeft size={16} /> Back to marketplace</Link>
        <form className="login-form" onSubmit={submit}>
          <span className="login-kicker">WELCOME BACK</span>
          <h2>Sign in to the {meta.label} portal</h2>
          <p>Use the prefilled demo account to explore the portal.</p>
          <label><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span>Password</span><div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          <div className="login-help"><label><input type="checkbox" defaultChecked /> Remember me</label><button type="button">Forgot password?</button></div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? 'Opening portal…' : <>Sign in <ArrowRight size={17} /></>}</button>
          <div className="demo-box"><strong>Demo access</strong><span>{meta.demoEmail}</span><span>{meta.demoPassword}</span></div>
          <p className="switch-role">Need another portal? <Link to="/login/user">User</Link><Link to="/login/broker">Broker</Link><Link to="/login/admin">Admin</Link></p>
        </form>
      </section>
    </main>
  );
}
