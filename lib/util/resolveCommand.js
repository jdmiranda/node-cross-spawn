'use strict';

const path = require('path');
const which = require('which');
const getPathKey = require('path-key');

// Performance optimization: Cache resolved commands
const resolveCache = new Map();
const MAX_CACHE_SIZE = 500;

function resolveCommandAttempt(parsed, withoutPathExt) {
    const env = parsed.options.env || process.env;
    const cwd = process.cwd();
    const hasCustomCwd = parsed.options.cwd != null;
    // Worker threads do not have process.chdir()
    const shouldSwitchCwd = hasCustomCwd && process.chdir !== undefined && !process.chdir.disabled;

    // If a custom `cwd` was specified, we need to change the process cwd
    // because `which` will do stat calls but does not support a custom cwd
    if (shouldSwitchCwd) {
        try {
            process.chdir(parsed.options.cwd);
        } catch (err) {
            /* Empty */
        }
    }

    let resolved;

    try {
        resolved = which.sync(parsed.command, {
            path: env[getPathKey({ env })],
            pathExt: withoutPathExt ? path.delimiter : undefined,
        });
    } catch (e) {
        /* Empty */
    } finally {
        if (shouldSwitchCwd) {
            process.chdir(cwd);
        }
    }

    // If we successfully resolved, ensure that an absolute path is returned
    // Note that when a custom `cwd` was used, we need to resolve to an absolute path based on it
    if (resolved) {
        resolved = path.resolve(hasCustomCwd ? parsed.options.cwd : '', resolved);
    }

    return resolved;
}

function resolveCommand(parsed) {
    // Performance optimization: Cache command resolution
    const env = parsed.options.env || process.env;
    const cwd = parsed.options.cwd || process.cwd();
    const cacheKey = `${parsed.command}:${cwd}:${env[getPathKey({ env })]}`;

    if (resolveCache.has(cacheKey)) {
        return resolveCache.get(cacheKey);
    }

    const resolved = resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);

    // Cache the result (limit cache size to prevent memory leaks)
    if (resolveCache.size >= MAX_CACHE_SIZE) {
        const firstKey = resolveCache.keys().next().value;

        resolveCache.delete(firstKey);
    }
    resolveCache.set(cacheKey, resolved);

    return resolved;
}

module.exports = resolveCommand;
