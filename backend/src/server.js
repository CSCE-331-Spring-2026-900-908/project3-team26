// Entry point: loads .env from several possible locations (repo root, backend root,
// or process CWD), then starts the Express server on PORT (default 4000).
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config({ path: new URL('../../.env', import.meta.url) });
dotenv.config({ path: new URL('../.env', import.meta.url) });
dotenv.config({ path: new URL('../env', import.meta.url) });
dotenv.config();

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
