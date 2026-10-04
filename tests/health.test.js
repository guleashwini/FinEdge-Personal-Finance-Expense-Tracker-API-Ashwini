import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

test('GET /health returns API health status', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'ok',
    service: 'FinEdge API',
  });
});

test('unknown routes return a consistent 404 error', async () => {
  const response = await request(app).get('/not-a-real-route');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: { message: 'Route not found: GET /not-a-real-route' },
  });
});
