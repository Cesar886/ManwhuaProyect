import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { createPresenceServer } from '../index.js';

const secret = 'test-presence-secret-with-enough-entropy';

function connect(port, user) {
  const token = user ? jwt.sign(user, secret, { expiresIn: '5m' }) : '';
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}?token=${encodeURIComponent(token)}`);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function waitForPresence(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando presencia')), 1500);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'presence' && predicate(message)) {
        clearTimeout(timeout);
        socket.off('message', onMessage);
        resolve(message);
      }
    };
    socket.on('message', onMessage);
  });
}

test('muestra un lector logueado y uno anónimo, y mueve al anónimo entre capítulos', async (t) => {
  const { wss } = createPresenceServer({ port: 0, secret });
  await new Promise((resolve) => wss.once('listening', resolve));
  const port = wss.address().port;

  const first = await connect(port, { id: '1', username: 'ana', avatar: null });
  const second = await connect(port, null);
  const duplicateAnonymousTab = await connect(port, null);
  const chapterTwoObserver = await connect(port, { id: '2', username: 'luis', avatar: 'https://example.com/luis.png' });
  t.after(async () => {
    first.terminate();
    second.terminate();
    duplicateAnonymousTab.terminate();
    chapterTwoObserver.terminate();
    await new Promise((resolve) => wss.close(resolve));
  });

  first.send(JSON.stringify({ type: 'join', manhwa: 'solo-leveling', chapter: '1', anonId: 'ignored-for-user' }));
  const bothInOnePromise = waitForPresence(first, (message) => message.total === 2);
  second.send(JSON.stringify({ type: 'join', manhwa: 'solo-leveling', chapter: '1', anonId: 'visitor-123' }));
  const bothInOne = await bothInOnePromise;
  assert.deepEqual(bothInOne.users.map((user) => user.username), ['ana']);
  assert.equal(bothInOne.anonymous, 1);

  const deduplicatedAnonymous = waitForPresence(first, (message) => message.total === 2 && message.anonymous === 1);
  duplicateAnonymousTab.send(JSON.stringify({ type: 'join', manhwa: 'solo-leveling', chapter: '1', anonId: 'visitor-123' }));
  assert.equal((await deduplicatedAnonymous).anonymous, 1);
  const duplicateClosed = waitForPresence(first, (message) => message.total === 2 && message.anonymous === 1);
  duplicateAnonymousTab.close();
  await duplicateClosed;

  chapterTwoObserver.send(JSON.stringify({ type: 'join', manhwa: 'solo-leveling', chapter: '2', anonId: 'ignored-for-user' }));
  const leftChapterOne = waitForPresence(first, (message) => message.total === 1);
  const enteredChapterTwo = waitForPresence(chapterTwoObserver, (message) => message.total === 2);
  second.send(JSON.stringify({ type: 'join', manhwa: 'solo-leveling', chapter: '2', anonId: 'visitor-123' }));
  assert.equal((await leftChapterOne).users[0].username, 'ana');
  const chapterTwo = await enteredChapterTwo;
  assert.equal(chapterTwo.users[0].username, 'luis');
  assert.equal(chapterTwo.anonymous, 1);

  const removedAfterClose = waitForPresence(chapterTwoObserver, (message) => message.total === 1 && message.anonymous === 0);
  second.close();
  assert.equal((await removedAfterClose).total, 1);
});

test('marca el perfil como online al leer o abrir su propio perfil', async (t) => {
  const { wss } = createPresenceServer({ port: 0, secret });
  await new Promise((resolve) => wss.once('listening', resolve));
  const port = wss.address().port;

  const owner = await connect(port, { id: 'profile-1', username: 'ana', avatar: null });
  const watcher = await connect(port, null);
  t.after(async () => {
    owner.terminate();
    watcher.terminate();
    await new Promise((resolve) => wss.close(resolve));
  });

  watcher.send(JSON.stringify({ type: 'join-profile', userId: 'profile-1' }));
  const initialOffline = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando estado inicial')), 1500);
    watcher.once('message', (raw) => {
      clearTimeout(timeout);
      resolve(JSON.parse(raw.toString()));
    });
  });
  assert.equal(initialOffline.online, false);

  const wentOnline = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando perfil online')), 1500);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'profilePresence' && message.online) {
        clearTimeout(timeout);
        watcher.off('message', onMessage);
        resolve(message);
      }
    };
    watcher.on('message', onMessage);
  });
  owner.send(JSON.stringify({ type: 'join-profile', userId: 'profile-1' }));
  assert.equal((await wentOnline).online, true);

  const wentOffline = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando perfil offline')), 1500);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'profilePresence' && !message.online) {
        clearTimeout(timeout);
        watcher.off('message', onMessage);
        resolve(message);
      }
    };
    watcher.on('message', onMessage);
  });
  owner.close();
  assert.equal((await wentOffline).online, false);
});
