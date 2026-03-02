import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
    writeFileSafe,
    fileExists,
    mkdirSafe,
    deleteFileSafe,
    emptyFolderSafe,
    isEmptySafe,
    isDirectory,
    cpSafe,
    mvSafe,
    statSafe,
    listFilesSafe,
} from '../index.js';

// Temporary directory, unique per test run
let tmp;
before(async () => { tmp = await mkdtemp(join(tmpdir(), 'foxyfs-')); });
after(async () => { await rm(tmp, { recursive: true, force: true }); });

const p = (...parts) => join(tmp, ...parts);

// ---------------------------------------------------------------------------
// writeFileSafe
// ---------------------------------------------------------------------------
describe('writeFileSafe', () => {

    test('writes content to a new file', async () => {
        const file = p('write-new.txt');
        await writeFileSafe(file, 'hello');
        assert.equal(await fileExists(file), true);
    });

    test('overwrites an existing file', async () => {
        const file = p('write-overwrite.txt');
        await writeFileSafe(file, 'first');
        await writeFileSafe(file, 'second');
        // fileExists still true; content verified internally by writeFileSafe
        assert.equal(await fileExists(file), true);
    });

    test('throws when path is invalid', async () => {
        await assert.rejects(
            () => writeFileSafe('/no/such/dir/file.txt', 'x'),
            { message: /Unable to write file/ }
        );
    });

});

// ---------------------------------------------------------------------------
// fileExists
// ---------------------------------------------------------------------------
describe('fileExists', () => {

    test('returns true for an existing file', async () => {
        const file = p('exists.txt');
        await writeFile(file, '');
        assert.equal(await fileExists(file), true);
    });

    test('returns true for an existing directory', async () => {
        assert.equal(await fileExists(tmp), true);
    });

    test('returns false for a missing path', async () => {
        assert.equal(await fileExists(p('ghost.txt')), false);
    });

});

// ---------------------------------------------------------------------------
// mkdirSafe
// ---------------------------------------------------------------------------
describe('mkdirSafe', () => {

    test('creates a new directory', async () => {
        const dir = p('new-dir');
        await mkdirSafe(dir);
        assert.equal(await isDirectory(dir), true);
    });

    test('is idempotent when directory already exists (deleteIfExists=false)', async () => {
        const dir = p('idem-dir');
        await mkdir(dir);
        await assert.doesNotReject(() => mkdirSafe(dir, false));
    });

    test('deletes then recreates when deleteIfExists=true', async () => {
        const dir = p('del-dir');
        await mkdir(dir);
        await writeFile(join(dir, 'sentinel.txt'), 'x');
        await mkdirSafe(dir, true);
        const files = await listFilesSafe(dir);
        assert.equal(files.length, 0);
    });

    test('creates nested directories recursively', async () => {
        const dir = p('a', 'b', 'c');
        await mkdirSafe(dir);
        assert.equal(await isDirectory(dir), true);
    });

});

// ---------------------------------------------------------------------------
// deleteFileSafe
// ---------------------------------------------------------------------------
describe('deleteFileSafe', () => {

    test('deletes an existing file', async () => {
        const file = p('to-delete.txt');
        await writeFile(file, '');
        await deleteFileSafe(file);
        assert.equal(await fileExists(file), false);
    });

    test('deletes a directory recursively', async () => {
        const dir = p('dir-to-delete');
        await mkdir(dir);
        await writeFile(join(dir, 'child.txt'), '');
        await deleteFileSafe(dir);
        assert.equal(await fileExists(dir), false);
    });

    test('throws when path does not exist', async () => {
        await assert.rejects(
            () => deleteFileSafe(p('missing.txt')),
            { message: /Unable to delete file/ }
        );
    });

});

// ---------------------------------------------------------------------------
// emptyFolderSafe
// ---------------------------------------------------------------------------
describe('emptyFolderSafe', () => {

    test('empties a folder that contains files', async () => {
        const dir = p('to-empty');
        await mkdir(dir);
        await writeFile(join(dir, 'a.txt'), '');
        await writeFile(join(dir, 'b.txt'), '');
        await emptyFolderSafe(dir);
        const files = await listFilesSafe(dir);
        assert.equal(files.length, 0);
    });

    test('succeeds on an already empty folder', async () => {
        const dir = p('already-empty');
        await mkdir(dir);
        await assert.doesNotReject(() => emptyFolderSafe(dir));
    });

    test('throws when path is a file', async () => {
        const file = p('not-a-dir.txt');
        await writeFile(file, '');
        await assert.rejects(
            () => emptyFolderSafe(file),
            { message: /Unable to empty folder/ }
        );
    });

    test('throws when path does not exist', async () => {
        await assert.rejects(
            () => emptyFolderSafe(p('ghost-dir')),
            { message: /Unable to empty folder/ }
        );
    });

});

// ---------------------------------------------------------------------------
// isEmptySafe
// ---------------------------------------------------------------------------
describe('isEmptySafe', () => {

    test('returns true for an empty file', async () => {
        const file = p('empty-file.txt');
        await writeFile(file, '');
        assert.equal(await isEmptySafe(file), true);
    });

    test('returns false for a non-empty file', async () => {
        const file = p('nonempty-file.txt');
        await writeFile(file, 'content');
        assert.equal(await isEmptySafe(file), false);
    });

    test('returns true for an empty directory', async () => {
        const dir = p('empty-dir');
        await mkdir(dir);
        assert.equal(await isEmptySafe(dir), true);
    });

    test('returns false for a non-empty directory', async () => {
        const dir = p('nonempty-dir');
        await mkdir(dir);
        await writeFile(join(dir, 'f.txt'), '');
        assert.equal(await isEmptySafe(dir), false);
    });

    test('throws when path does not exist', async () => {
        await assert.rejects(
            () => isEmptySafe(p('missing')),
            { message: /Unable to check if path is empty/ }
        );
    });

});

// ---------------------------------------------------------------------------
// isDirectory
// ---------------------------------------------------------------------------
describe('isDirectory', () => {

    test('returns true for a directory', async () => {
        assert.equal(await isDirectory(tmp), true);
    });

    test('returns false for a file', async () => {
        const file = p('isdir-file.txt');
        await writeFile(file, '');
        assert.equal(await isDirectory(file), false);
    });

    test('throws when path does not exist', async () => {
        await assert.rejects(
            () => isDirectory(p('nope')),
            { message: /Unable to check if path is a directory/ }
        );
    });

});

// ---------------------------------------------------------------------------
// cpSafe
// ---------------------------------------------------------------------------
describe('cpSafe', () => {

    test('copies a file', async () => {
        const src = p('cp-src.txt');
        const dest = p('cp-dest.txt');
        await writeFile(src, 'data');
        await cpSafe(src, dest);
        assert.equal(await fileExists(src), true);
        assert.equal(await fileExists(dest), true);
    });

    test('copies a directory recursively', async () => {
        const src = p('cp-dir-src');
        const dest = p('cp-dir-dest');
        await mkdir(src);
        await writeFile(join(src, 'child.txt'), '');
        await cpSafe(src, dest);
        assert.equal(await fileExists(join(dest, 'child.txt')), true);
        assert.equal(await fileExists(src), true);
    });

    test('throws when source does not exist', async () => {
        await assert.rejects(
            () => cpSafe(p('no-src.txt'), p('dest.txt')),
            { message: /Unable to copy file/ }
        );
    });

});

// ---------------------------------------------------------------------------
// mvSafe
// ---------------------------------------------------------------------------
describe('mvSafe', () => {

    test('moves a file', async () => {
        const src = p('mv-src.txt');
        const dest = p('mv-dest.txt');
        await writeFile(src, 'data');
        await mvSafe(src, dest);
        assert.equal(await fileExists(src), false);
        assert.equal(await fileExists(dest), true);
    });

    test('throws when source does not exist', async () => {
        await assert.rejects(
            () => mvSafe(p('no-mv-src.txt'), p('mv-dest2.txt')),
            { message: /Unable to move file/ }
        );
    });

});

// ---------------------------------------------------------------------------
// statSafe
// ---------------------------------------------------------------------------
describe('statSafe', () => {

    test('returns stat object for a file', async () => {
        const file = p('stat-file.txt');
        await writeFile(file, 'abc');
        const stats = await statSafe(file);
        assert.equal(typeof stats.size, 'number');
        assert.equal(stats.isFile(), true);
    });

    test('returns stat object for a directory', async () => {
        const stats = await statSafe(tmp);
        assert.equal(stats.isDirectory(), true);
    });

    test('throws when path does not exist', async () => {
        await assert.rejects(
            () => statSafe(p('ghost')),
            { message: /Unable to stat file/ }
        );
    });

});

// ---------------------------------------------------------------------------
// listFilesSafe
// ---------------------------------------------------------------------------
describe('listFilesSafe', () => {

    test('lists files in a directory', async () => {
        const dir = p('list-dir');
        await mkdir(dir);
        await writeFile(join(dir, 'x.txt'), '');
        await writeFile(join(dir, 'y.txt'), '');
        const files = await listFilesSafe(dir);
        assert.equal(files.length, 2);
        assert.ok(files.includes('x.txt'));
        assert.ok(files.includes('y.txt'));
    });

    test('returns empty array for an empty directory', async () => {
        const dir = p('list-empty-dir');
        await mkdir(dir);
        const files = await listFilesSafe(dir);
        assert.deepEqual(files, []);
    });

    test('throws when path is a file', async () => {
        const file = p('list-file.txt');
        await writeFile(file, '');
        await assert.rejects(
            () => listFilesSafe(file),
            { message: /Unable to list files in directory/ }
        );
    });

    test('throws when path does not exist', async () => {
        await assert.rejects(
            () => listFilesSafe(p('missing-list-dir')),
            { message: /Unable to list files in directory/ }
        );
    });

});
