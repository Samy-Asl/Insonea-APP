import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newSession, record, average, points, timeAbove} from './script.js';

test('one hour of unequal levels preserves energy, threshold durations and peaks', () => {
    const session = newSession('Amphi A', 'Cours', 80);
    for (let block = 0; block < 14400; block++) {
        const decibels = block % 4 === 0 ? 90 : 60;
        record(session, 10 ** ((decibels - 94) / 10), 0.25);
    }
    const expected = 60 + 10 * Math.log10(250.75);
    assert.ok(Math.abs(average(session) - expected) < 1e-8);
    assert.equal(session.seconds, 3600);
    assert.equal(timeAbove(session, 80), 900);
    assert.equal(timeAbove(session, 91), 0);
    assert.equal(session.episodes, 3600);
    assert.deepEqual(points(session, true).at(-1), [3600, 90]);
    assert.equal(points(session).length, 720);
});

test('silence, a continuous crossing and a partial final bucket', () => {
    const session = newSession('Bibliothèque', '', 94);
    for (const power of [0, 1, 1, 0]) record(session, power, 0.25);
    assert.equal(session.episodes, 1);
    assert.equal(timeAbove(session, 94), 0.5);
    assert.equal(points(session).length, 1);
    assert.ok(session.name.startsWith('Bibliothèque · '));
    assert.deepEqual(points(session, true), [[1, 94]]);
});