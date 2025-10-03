'use strict';

// See http://www.robvanderwoude.com/escapechars.php
const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;

// Performance optimization: Cache escaped commands
const escapeCache = new Map();
const MAX_CACHE_SIZE = 500;

function escapeCommand(arg) {
    // Check cache first
    if (escapeCache.has(arg)) {
        return escapeCache.get(arg);
    }

    // Escape meta chars
    const escaped = arg.replace(metaCharsRegExp, '^$1');

    // Cache the result
    if (escapeCache.size >= MAX_CACHE_SIZE) {
        const firstKey = escapeCache.keys().next().value;

        escapeCache.delete(firstKey);
    }
    escapeCache.set(arg, escaped);

    return escaped;
}

function escapeArgument(arg, doubleEscapeMetaChars) {
    // Convert to string
    arg = `${arg}`;

    // Performance optimization: Check cache for common arguments
    const cacheKey = `${arg}:${doubleEscapeMetaChars}`;

    if (escapeCache.has(cacheKey)) {
        return escapeCache.get(cacheKey);
    }

    // Algorithm below is based on https://qntm.org/cmd
    // It's slightly altered to disable JS backtracking to avoid hanging on specially crafted input
    // Please see https://github.com/moxystudio/node-cross-spawn/pull/160 for more information

    // Sequence of backslashes followed by a double quote:
    // double up all the backslashes and escape the double quote
    arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');

    // Sequence of backslashes followed by the end of the string
    // (which will become a double quote later):
    // double up all the backslashes
    arg = arg.replace(/(?=(\\+?)?)\1$/, '$1$1');

    // All other backslashes occur literally

    // Quote the whole thing:
    arg = `"${arg}"`;

    // Escape meta chars
    arg = arg.replace(metaCharsRegExp, '^$1');

    // Double escape meta chars if necessary
    if (doubleEscapeMetaChars) {
        arg = arg.replace(metaCharsRegExp, '^$1');
    }

    // Cache the result
    if (escapeCache.size >= MAX_CACHE_SIZE) {
        const firstKey = escapeCache.keys().next().value;

        escapeCache.delete(firstKey);
    }
    escapeCache.set(cacheKey, arg);

    return arg;
}

module.exports.command = escapeCommand;
module.exports.argument = escapeArgument;
