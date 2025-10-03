'use strict';

const path = require('path');
const resolveCommand = require('./util/resolveCommand');
const escape = require('./util/escape');
const readShebang = require('./util/readShebang');

const isWin = process.platform === 'win32';
const isExecutableRegExp = /\.(?:com|exe)$/i;
const isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;

// Performance optimization: Cache for parsed commands
const parseCache = new Map();
const MAX_CACHE_SIZE = 1000;

function detectShebang(parsed) {
    parsed.file = resolveCommand(parsed);

    const shebang = parsed.file && readShebang(parsed.file);

    if (shebang) {
        parsed.args.unshift(parsed.file);
        parsed.command = shebang;

        return resolveCommand(parsed);
    }

    return parsed.file;
}

function parseNonShell(parsed) {
    if (!isWin) {
        return parsed;
    }

    // Detect & add support for shebangs
    const commandFile = detectShebang(parsed);

    // We don't need a shell if the command filename is an executable
    const needsShell = !isExecutableRegExp.test(commandFile);

    // If a shell is required, use cmd.exe and take care of escaping everything correctly
    // Note that `forceShell` is an hidden option used only in tests
    if (parsed.options.forceShell || needsShell) {
        // Need to double escape meta chars if the command is a cmd-shim located in `node_modules/.bin/`
        // The cmd-shim simply calls execute the package bin file with NodeJS, proxying any argument
        // Because the escape of metachars with ^ gets interpreted when the cmd.exe is first called,
        // we need to double escape them
        const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);

        // Normalize posix paths into OS compatible paths (e.g.: foo/bar -> foo\bar)
        // This is necessary otherwise it will always fail with ENOENT in those cases
        parsed.command = path.normalize(parsed.command);

        // Escape command & arguments
        parsed.command = escape.command(parsed.command);
        parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));

        const shellCommand = [parsed.command].concat(parsed.args).join(' ');

        parsed.args = ['/d', '/s', '/c', `"${shellCommand}"`];
        parsed.command = process.env.comspec || 'cmd.exe';
        parsed.options.windowsVerbatimArguments = true; // Tell node's spawn that the arguments are already escaped
    }

    return parsed;
}

function parse(command, args, options) {
    // Normalize arguments, similar to nodejs
    if (args && !Array.isArray(args)) {
        options = args;
        args = null;
    }

    // Performance optimization: Fast path for Unix systems (skip Windows processing)
    // Only cache when not using shell and no custom options that affect parsing
    if (!isWin && (!options || !options.shell)) {
        const cacheKey = `${command}:${args ? args.join(':') : ''}:${options ? JSON.stringify(options) : ''}`;

        if (parseCache.has(cacheKey)) {
            const cached = parseCache.get(cacheKey);

            // Return a shallow copy to prevent mutation of cached objects
            return {
                command: cached.command,
                args: args ? args.slice(0) : [],
                options: Object.assign({}, options),
                file: cached.file,
                original: {
                    command,
                    args,
                },
            };
        }

        // For Unix, create simple parsed object without Windows complexity
        const parsed = {
            command,
            args: args ? args.slice(0) : [],
            options: Object.assign({}, options),
            file: undefined,
            original: {
                command,
                args,
            },
        };

        // Cache the result (limit cache size to prevent memory leaks)
        if (parseCache.size >= MAX_CACHE_SIZE) {
            const firstKey = parseCache.keys().next().value;

            parseCache.delete(firstKey);
        }
        parseCache.set(cacheKey, { command: parsed.command, file: parsed.file });

        return parsed;
    }

    args = args ? args.slice(0) : []; // Clone array to avoid changing the original
    options = Object.assign({}, options); // Clone object to avoid changing the original

    // Build our parsed object
    const parsed = {
        command,
        args,
        options,
        file: undefined,
        original: {
            command,
            args,
        },
    };

    // Delegate further parsing to shell or non-shell
    return options.shell ? parsed : parseNonShell(parsed);
}

module.exports = parse;
