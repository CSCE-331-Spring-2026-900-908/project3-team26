import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="stack-page">
      <div className="surface-card">
        <p className="eyebrow">404</p>
        <h1>That page does not exist.</h1>
        <p className="page-copy">Use the main navigation to jump back into the demo flow.</p>
        <Link className="action-button" to="/">
          Return Home
        </Link>
      </div>
    </section>
  );
}
