import { ZodError } from 'zod';

export function validate(schema, where = 'body') {
  return (req, res, next) => {
    const r = schema.safeParse(req[where]);
    if (!r.success) {
      return res.status(400).json({
        error: 'Please check the highlighted fields.',
        fields: Object.fromEntries(r.error.issues.map((i) => [i.path.join('.') || '_', i.message])),
      });
    }
    req.valid = r.data;
    return next();
  };
}

export function notFound(req, res) { res.status(404).json({ error: 'Not found.' }); }

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid input.' });
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', req.method, req.path, err);
  res.status(status).json({ error: status >= 500 && status !== 503 ? 'Something went wrong on the server.' : err.message, code: err.code });
}
