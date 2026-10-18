// A Notion page or form embedded in a beta page (FAQs, feedback, membership), with a way out to
// open it full-size. The URLs are fixed constants, the same ones the current pages embed.
export function ClubEmbed(props: { title: string; sub: string; src: string; label: string; height?: number }) {
  return (
    <div className="b-page">
      <header className="b-top">
        <div>
          <h1>
            {props.title}
            <span className="b-tag">Beta</span>
          </h1>
          <div className="sub">{props.sub}</div>
        </div>
      </header>
      <div className="c-embed">
        <div className="c-embed-head">
          <span>{props.label}</span>
          <a className="b-link" href={props.src} target="_blank" rel="noopener noreferrer">
            Open in a new tab ↗
          </a>
        </div>
        <iframe src={props.src} height={props.height ?? 800} title={props.label} allow="fullscreen" loading="lazy" />
      </div>
    </div>
  );
}
