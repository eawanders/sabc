// 404 for /beta/events/[slug], in the beta shell.
import Link from 'next/link';
import '../../_components/club/club.css';

export default function EventNotFound() {
  return (
    <div className="b-page c-detail">
      <div className="c-crumb">
        <Link href="/beta/events">Events</Link>
        <span>/</span>
        <span>Not found</span>
      </div>
      <div className="b-list b-empty">
        This event could not be found.{' '}
        <Link className="b-link" href="/beta/events">
          Back to events
        </Link>
      </div>
    </div>
  );
}
