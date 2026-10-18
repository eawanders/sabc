// /beta/flag: the OURCS Isis flag (read only, the same source as /api/flag-status), what it means for
// SABC outings, and when it was last set and by whom.
import type { Metadata } from 'next';
import { getFlagStatus } from '@/lib/flagStatus';
import {
  FLAG_RULES,
  FLAG_SWATCH,
  LOCKKEEPER,
  REGISTER_FORM_URL,
  flagColour,
  noticeList,
  setAtLabel,
  type FlagColour,
  type FlagData,
} from '../_lib/club-flag';
import '../_components/club/club.css';

export const metadata: Metadata = { title: 'Flag status' };
export const dynamic = 'force-dynamic';

const ORDER: FlagColour[] = ['Green', 'Light Blue', 'Dark Blue', 'Amber', 'Red', 'Black', 'Grey'];

export default async function BetaFlag() {
  let data: FlagData | null = null;
  try {
    data = (await getFlagStatus()) as FlagData;
  } catch {
    data = null;
  }
  const colour = flagColour(data?.status_text);
  const rules = colour ? FLAG_RULES[colour] : null;
  const notices = noticeList(data?.notices);
  const setAt = setAtLabel(data?.set_date);

  return (
    <div className="b-page c-detail">
      <header className="b-top">
        <div>
          <h1>
            Flag status<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">The Isis flag from OURCS, and what it means for our outings.</div>
        </div>
      </header>

      <div className="c-card">
        {!data ? (
          <p className="b-muted" style={{ margin: 0 }}>
            Couldn&apos;t reach OURCS for the flag. Refresh to try again, or check{' '}
            <a className="b-link" href="https://ourcs.co.uk/" target="_blank" rel="noopener noreferrer">
              ourcs.co.uk
            </a>
            .
          </p>
        ) : (
          <div className="c-flag">
            <span className="c-swatch" style={{ background: colour ? FLAG_SWATCH[colour] : 'var(--unk)' }} aria-hidden="true" />
            <div>
              <h2>{data.status_text ? `${data.status_text.replace(/\s*flag\s*$/i, '')} flag` : 'Unknown flag'}</h2>
              <div className="meta">
                {setAt ? `Set ${setAt}` : 'Set time unknown'}
                {data.set_by ? ` by ${data.set_by}` : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {data && (
        <div className="c-card">
          <div className="c-section">What it means for SABC outings</div>
          {rules ? (
            <>
              <p style={{ margin: '0 0 8px' }}>
                <span className="b-st">
                  <span className={`b-dot ${rules.crewsOut ? (colour === 'Green' ? 'ok' : 'maybe') : 'no'}`} />
                  {rules.crewsOut ? 'Crews may go out' : 'No crews out'}
                </span>
              </p>
              <p style={{ margin: 0 }}>{rules.summary}</p>
              <p className="b-muted" style={{ margin: '6px 0 0' }}>
                Bank rider: {rules.bankRider}
                {colour === 'Light Blue' || colour === 'Amber' ? ` Lockkeeper: ${LOCKKEEPER}.` : ''}
              </p>
              {rules.register && (
                <p style={{ margin: '8px 0 0' }}>
                  <a className="b-link" href={REGISTER_FORM_URL} target="_blank" rel="noopener noreferrer">
                    Register a novice-cox outing ↗
                  </a>
                </p>
              )}
            </>
          ) : (
            <p className="b-muted" style={{ margin: 0 }}>
              Requirements not available for this flag. Check with a coach before going out.
            </p>
          )}
        </div>
      )}

      {notices.length > 0 && (
        <div className="c-card">
          <div className="c-section">OURCS notices</div>
          <ul className="c-ul">
            {notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="c-card">
        <div className="c-section">All flags</div>
        <table className="c-rules">
          <tbody>
            {ORDER.map((c) => (
              <tr key={c} className={c === colour ? 'cur' : undefined} aria-current={c === colour ? 'true' : undefined}>
                <td>
                  <span className="c-mini" style={{ background: FLAG_SWATCH[c] }} />
                  {c}
                </td>
                <td>
                  {FLAG_RULES[c].summary}
                  <div className="br">Bank rider: {FLAG_RULES[c].bankRider}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="b-muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
          A water outing only auto-confirms when the flag is known and crews may go out, and, where a bank rider is
          required, one is signed up and available.
        </p>
      </div>
    </div>
  );
}
